# Consumer application flow — end-to-end

The headline diagram. Walks from "applicant clicks the link a coach
sent them" through "lender disburses funds to the coach's business
account."

**Latency budget:** intake submit → offers visible ≤ **8 seconds** p95.
**Everything in parallel** where it can be (the 4 lender quotes fan out
concurrently, not sequentially).
**Every external call is HMAC-signed** in both directions, with a
300-second timestamp replay window.
**Every state transition writes an audit row** to the hash-chained
audit outbox. The full lifecycle is auditable end-to-end.

```mermaid
sequenceDiagram
  autonumber
  actor Applicant
  participant CW as Browser<br/>(consumer-web)
  participant API as apps/api<br/>(NestJS + Fastify)
  participant HS as Highsale<br/>+ Pixie
  participant ORCH as Decision Engine<br/>services/orchestration
  participant L1 as US Bank
  participant L2 as Covered
  participant L3 as Engine.Tech
  participant L4 as Queen Street
  participant DS as DocuSign
  participant LDR as Winning lender<br/>(e.g. US Bank)

  rect rgb(240, 248, 255)
    Note over Applicant,CW: 1 — Intake
    Applicant->>CW: Land on /apply/coachpay/<token>
    CW->>API: GET /v1/applications/by-token/<token><br/>(prefill from coach's invite)
    API-->>CW: { coach, brand, loanAmountCents, purpose }
    CW->>Applicant: Render intake form
    Applicant->>CW: Fill name, contact, DOB, SSN-last-4,<br/>address, income, employment
    Applicant->>CW: Tick FCRA soft-pull consent
    CW->>API: POST /v1/applications<br/>(CSRF token, encrypted body)
    API->>API: Zod validate +<br/>PiiVault.sealOpaque(consumer data)
    API->>API: Insert Application<br/>state = submitted
    API->>API: Audit row: application.created
    API-->>CW: 201 { applicationId }
    CW->>CW: router.replace<br/>/apply/coachpay/processing?id=<id>
  end

  rect rgb(255, 248, 240)
    Note over CW,HS: 2 — Pre-qual + enrichment (Highsale)
    CW->>API: GET /v1/applications/<id>/status<br/>(poll every 2s)
    API-->>CW: { state: submitted }
    API->>HS: POST /v1/soft-pull<br/>{ applicationId, normalised PII }<br/>signed HMAC
    HS-->>API: 202 { highsaleRef }
    HS->>HS: Run Pixie<br/>(soft pull + financial data pull)
    HS->>API: POST /v1/webhooks/highsale<br/>{ snapshot, x-eazepay-signature, x-eazepay-timestamp }
    API->>API: Verify HMAC + replay window<br/>(SEC-034)
    API->>API: PiiVault.sealOpaque(snapshot.payload)
    API->>API: Denormalise creditTier onto Application
    API->>API: state = enriched
    API->>API: Audit row: highsale.snapshot.scored
  end

  rect rgb(245, 255, 245)
    Note over ORCH,L4: 3 — Parallel marketplace (decision engine)
    API->>ORCH: orchestrate(applicationId)
    ORCH->>ORCH: state = quoting
    par 4 lenders quoted concurrently (5s timeout each)
      ORCH->>L1: POST /quote (HMAC signed)
      L1-->>ORCH: { decision: approved,<br/>apr: 8.9%, term: 48mo, monthly: $498 }
    and
      ORCH->>L2: POST /quote
      L2-->>ORCH: { decision: declined,<br/>reason_code: dti_too_high }
    and
      ORCH->>L3: POST /quote
      L3-->>ORCH: { decision: approved,<br/>apr: 12.5%, term: 36mo, monthly: $670 }
    and
      ORCH->>L4: POST /quote
      L4-->>ORCH: { decision: approved,<br/>apr: 9.4%, term: 60mo, monthly: $420 }
    end
    ORCH->>ORCH: Rank by lowest total cost<br/>(Queen Street → US Bank → Engine.Tech)
    ORCH->>API: Write 3 Offer rows
    API->>API: state = offers_available
    API->>API: Audit row: application.offers_available
  end

  rect rgb(255, 245, 255)
    Note over CW,Applicant: 4 — Offer selection
    CW->>API: GET /v1/applications/<id>/status<br/>(next poll)
    API-->>CW: { state: offers_available,<br/>offers: [...] }
    CW->>CW: router.replace<br/>/apply/coachpay/offers?id=<id>
    CW->>Applicant: Render 3 ranked offer cards
    Applicant->>CW: Click "Accept" on Queen Street offer
    CW->>API: POST /v1/offers/<offerId>/accept<br/>(CSRF token)
    API->>API: state = offer_accepted<br/>idempotency-key bound to userId
    API->>API: Audit row: application.offer_accepted
  end

  rect rgb(255, 250, 235)
    Note over API,DS: 5 — e-Sign (DocuSign embedded)
    API->>DS: POST /v2/envelopes<br/>(loan agreement, TILA disclosure,<br/>e-sign disclosure)
    DS-->>API: { envelopeId, recipientViewUrl }
    API->>API: state = contract_pending
    API-->>CW: { signUrl: recipientViewUrl }
    CW->>Applicant: Load DocuSign embedded iframe
    Applicant->>DS: Sign in-app
    DS->>API: POST /v1/webhooks/esign/docusign<br/>{ envelopeId, status: completed, HMAC }
    API->>API: Verify HMAC + replay window
    API->>API: state = contracted
    API->>API: Audit row: application.contracted
  end

  rect rgb(245, 250, 255)
    Note over API,LDR: 6 — Disbursement
    API->>LDR: POST /v1/disburse<br/>{ loanId, merchantId, amount,<br/>paymentMethod (verified) }
    LDR-->>API: 202 { disbursementId }
    API->>API: state = funding_pending
    LDR->>LDR: Originate ACH to merchant<br/>(48–72hr)
    LDR->>API: POST /v1/webhooks/lender/<id>/funded<br/>{ disbursementId, fundedAt, HMAC }
    API->>API: Verify HMAC
    API->>API: state = funded
    API->>API: Audit row: payment.disbursed
    API->>CW: status update (next poll)
    CW->>Applicant: "You're funded. The coach has been paid."
  end
```

## Key invariants

- **Latency budget.** `submit → offers_available` ≤ 8s p95. The fan-out is parallel; the slowest lender bounds the total. 5s timeout per lender means worst-case 5–6s, plus 1–2s of Highsale and 1s of platform overhead.
- **Idempotency.** Every state-changing POST accepts an `Idempotency-Key` header (the consumer-web client mints a uuid v4 per logical action). Replays are bound to the userId so a guessed key cannot replay another consumer's action (SEC-014).
- **HMAC everywhere.** Every external call — outbound to Highsale and lenders, inbound from Highsale / lenders / DocuSign — carries `x-eazepay-signature: sha256=<hex>` and `x-eazepay-timestamp: <unix>`. The receiving end constant-time-compares + rejects timestamps outside a 300s window.
- **Audit chain.** Every state transition writes one row to `audit_outbox`. The drain ships hash-linked entries to the immutable sink. A regulator can replay the full lifecycle from cold.
- **PII boundary.** The full SSN, DOB, and address never leave `apps/api` to a lender. The lender adapters send a normalised subset: SSN-last-4, DOB year, address-zip. Full PII is decrypted JIT only at the moments the API itself needs it (Highsale soft-pull request).

## What this means for an on-call

- If status is stuck at `enriched`, Highsale fired but orchestration didn't kick off — check `services/orchestration` logs.
- If status is stuck at `quoting`, one or more lenders are slow — check per-lender span latency in OTEL.
- If status is `declined` and there's no AAN row, the AAN renderer cron has failed — check `services/compliance-doc`.
- If status is stuck at `funding_pending` past 72h, the lender funding webhook never arrived — fall back to the per-adapter status polling worker.
