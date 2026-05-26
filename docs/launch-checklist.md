# Launch checklist — first lender demo + first pilot merchant

> The single doc to walk through before any "go live" moment. Owners
> are named. Effort estimates assume a clean run — actual time depends
> on what surfaces during the walkthrough.

> The checklist has four sections. Engineering must be green before
> Operations starts. Compliance + Commercial run in parallel.

---

## 1. Engineering (must be green first)

### Code state

- [ ] **`pnpm test` green** — full repo. Owner: Brodie. Effort: 1m.
- [ ] **`pnpm typecheck` clean** — every package. Owner: Brodie.
      Effort: 1m.
- [ ] **`pnpm lint` clean** — at least error-level. Owner: Brodie.
      Effort: 1m.
- [ ] **Iteration 3 branch merged to `main`** — and main is deployed.
      Owner: Brodie. Effort: depends on review.
- [ ] **k6 baseline (`tests/load/k6/applications.js`)** — passes
      against staging, all thresholds green. Owner: Brodie. Effort:
      15m run + review.

### Infrastructure state

- [ ] **All migrations applied** in prod. Owner: Brodie. Effort: 5m
      (`pnpm migrate:status` confirms).
- [ ] **Env vars set in prod** — see `docs/runbooks/local-development.md`
      for the canonical list. Owner: Brodie. Effort: 30m if any are
      missing.
- [ ] **BullMQ workers running** — `webhook-processor`, `provisioning`,
      `migrations`. Confirm via the Railway service dashboard. Owner:
      Brodie. Effort: 5m.
- [ ] **Redis connection healthy** — `/api/admin/observability/snapshot`
      shows queue depths instead of "queue substrate offline". Owner:
      Brodie. Effort: 1m.
- [ ] **DLQ empty** at launch — see `docs/runbooks/webhook-dlq.md`.
      Owner: Brodie. Effort: 5m.

### Monitoring

- [ ] **`/admin/observability` accessible** — operator session lands
      and sees live counters. Owner: Brodie. Effort: 1m.
- [ ] **`/admin/observability/slo` accessible** — SLO board renders
      every catalogued SLO. Yellow/red banner if any are already
      burning. Owner: Brodie. Effort: 1m.
- [ ] **OTel pipeline wired** to a sink (Grafana Cloud or self-hosted).
      DEFERRED — current observability is single-replica counters.
      Owner: Brodie. Effort: 1d (separate task).
- [ ] **Railway alerting** — at least basic uptime alerting to
      `brodie@amalafinance.com.au`. Owner: Brodie. Effort: 30m.

### Performance baselines

- [ ] **k6 applications.js** passes against staging at 1500 VUs.
      Owner: Brodie. Effort: 15m.
- [ ] **k6 decision-engine.js** passes at 500 RPS. Owner: Brodie.
      Effort: 5m.
- [ ] **k6 webhook-inbox.js** passes at 100 events/sec. Owner: Brodie.
      Effort: 5m.
- [ ] **k6 auth-guard.js** passes — confirms guards stay fast under
      enumeration. Owner: Brodie. Effort: 3m.

---

## 2. Operations

### Incident response

- [ ] **On-call rota named** — even if solo, the rota explicitly says
      "Brodie, 24/7, single point of contact" until headcount lands.
      Document in `docs/runbooks/incident-response.md`. Owner: Brodie.
      Effort: 30m.
- [ ] **Pager wired** — Railway alerts route to Brodie's phone (SMS or
      Pushover). Owner: Brodie. Effort: 30m.
- [ ] **Incident comms templates** copied to a single doc —
      acknowledgement, update, resolution, post-mortem. Templates
      already exist in `docs/runbooks/incident-response.md`; copy to
      a Google Doc so they're easy to grab during an incident.
      Owner: Brodie. Effort: 30m.
- [ ] **Status page set up** — public-facing, even if minimal. Use
      Better Uptime or Atlassian Statuspage. URL communicated to
      lenders + pilot merchant. Owner: Brodie. Effort: 2h.
- [ ] **Runbooks audited** — each runbook in `docs/runbooks/*` opens,
      points to current file paths, and the linked SLO matches the
      catalogue. Owner: Brodie. Effort: 1h.

### Operational readiness

- [ ] **Backup verified** — Postgres backups restore-tested in the
      last 30 days. Railway snapshots are weekly; we manually trigger
      one ahead of launch. Owner: Brodie. Effort: 30m.
- [ ] **Disaster recovery plan documented** — RTO + RPO targets, who
      to call, where backups live. Owner: Brodie. Effort: 2h.
- [ ] **Vendor escalation list** — who to call at MiCamp, HighSale,
      Plaid, ez-Check, Trutopia when their integration breaks at 2am.
      Phone + email per partner. Owner: Brodie. Effort: 1h (gather
      info from existing partner contracts).

---

## 3. Compliance

### FCRA

- [ ] **Consent flow verified end-to-end** in staging — consumer
      submits, receipt stored, prequal accepts, soft-pull recorded.
      Owner: Brodie. Effort: 30m.
- [ ] **Disclosure version locked** — `SOFT_PULL_DISCLOSURE_VERSION`
      in `lib/consumer-consent.ts` matches the disclosure text
      reviewed by counsel. Owner: Brodie + legal. Effort: 1h.
- [ ] **Adverse action notices wired** — for the decline path, the
      consumer receives an adverse-action notice with the Reg B
      reason codes. Today this is logged but not emailed — DEFERRED
      to v2; document the gap in the lender demo. Owner: Brodie.
      Effort: depends.
- [ ] **Permissible purpose declared** — `604(a)(3)(A)` in the
      prequal payload, validated server-side. Owner: Brodie. Effort:
      1m to verify.

### Audit + retention

- [ ] **Audit log spot-check** — pick 5 recent admin actions in
      `/admin/audit`; each has `actor`, `action`, `targetType`,
      `targetId`, `ipAddress`, `userAgent`. Owner: Brodie. Effort:
      15m.
- [ ] **Retention policy documented** — what we keep, how long, where.
      Today: audit_log retained 7 years (matches SOC2 + FCRA
      §609(c)(2)(A)); webhook_inbox retained 90 days; application
      PII retained 7 years post-disposition. Document in
      `docs/compliance/retention.md`. DEFERRED — file doesn't exist
      yet. Owner: Brodie. Effort: 2h.
- [ ] **Right to be forgotten (RTBF)** procedure documented — what
      we delete on consumer request, what we don't (audit log is
      append-only by FCRA requirement). Owner: Brodie. Effort: 1h.

### Multi-tenant

- [ ] **Cross-tenant smoke test** — log in as partner A, attempt to
      fetch partner B's application by URL guessing. Confirms the
      `assertPartnerOwnership` gate works in prod. Owner: Brodie.
      Effort: 15m.

### Pen-test posture

- [ ] **Pen-test booked** — see `docs/pen-test-prep.md`. Target:
      within 30 days of pilot go-live, ideally before the first real
      consumer applies. Owner: Brodie. Effort: 2 weeks lead time on
      firm booking.

---

## 4. Commercial

### Lender demo

- [ ] **NDA template ready** — counsel-reviewed, signed-as-Brodie
      ready to send. Owner: Brodie. Effort: counsel timeline.
- [ ] **Demo script rehearsed** — walk through end-to-end at least
      twice on a fresh staging env. Includes: consumer apply, offer
      surface, partner-portal application detail, the audit log,
      `/admin/observability`. Owner: Brodie. Effort: 2h.
- [ ] **Demo data seeded** — pilot lender's brand exists, partner
      account exists, sample applications are in the funnel.
      Owner: Brodie. Effort: 30m.
- [ ] **Lender contacts confirmed** — names, emails, NDAs sent.
      Owner: Brodie. Effort: 30m per lender.

### Pilot merchant

- [ ] **Pilot merchant agreement signed** — counsel-reviewed.
      Owner: Brodie. Effort: counsel timeline.
- [ ] **Pricing locked** — origination fees, lender splits, payout
      schedule documented in `lib/lender-economics.ts` matches the
      signed agreement. Owner: Brodie. Effort: 30m.
- [ ] **Merchant onboarding rehearsed** — full provisioning
      flow end-to-end on staging. Owner: Brodie. Effort: 1h.
- [ ] **Merchant support channel agreed** — Slack Connect, email,
      or phone? Document in the merchant agreement. Owner: Brodie.
      Effort: 15m.

---

## 5. Go / no-go gate

Run a final go / no-go meeting (just Brodie until headcount lands):

- [ ] All "must be green first" items in section 1 are green.
- [ ] At least 90% of section 2 + 3 + 4 are green.
- [ ] Items marked DEFERRED have either been done OR have a
      documented next-step and an estimated date.
- [ ] Any RED-level SLO burning on the board has been addressed.

If any of these are red, defer launch by one cycle (2 weeks).

---

## 6. Post-launch first-72-hours

The "we just shipped" watch.

- [ ] Hour 1: monitor `/admin/observability` every 10m. Confirm
      counters are moving in the expected direction.
- [ ] Hour 1: monitor `/admin/observability/slo`. Confirm no SLO
      flipped yellow within the first hour.
- [ ] Hour 4: review error logs. Anything unexpected → file in a
      "first 72h findings" doc.
- [ ] Hour 24: write a one-paragraph day-1 retrospective. Send to
      lender + pilot merchant.
- [ ] Day 3: write a longer retrospective. Distribute to engineering + commercial.
- [ ] Day 7: first weekly SLO review. Document in
      `docs/runbooks/slo-reviews/YYYY-WW.md`.
