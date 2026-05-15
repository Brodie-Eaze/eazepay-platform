# EazePay CTO Architecture & Execution Blueprint

**Status:** Built and deployed. `partner-portal` is in production at https://eazepay-platform-production.up.railway.app. Backend is 13 services implemented as a modular monolith composed in `apps/api`. Mobile and secondary web apps are scaffolded, run locally, and target a future deploy. **This foundation document remains the single source of architectural truth; deltas from it must be documented per ADR in [`adr/`](adr/).**
**Author role:** Acting CTO / Principal Architect
**Date:** 2026-05-02 (foundation) · last status refresh 2026-05-15
**Primary jurisdiction:** United States only. Federal regime: BSA/USA PATRIOT Act (FinCEN), OFAC sanctions, TILA/Reg Z, ECOA/Reg B, FCRA, GLBA + Safeguards Rule, EFTA/Reg E, UDAAP (CFPB), MLA, SCRA, E-SIGN/UETA. State regime: state-by-state consumer lending licensing OR bank-partner model (Cross River / WebBank / Celtic Bank / FinWise) with True Lender doctrine + Madden risk addressed. Privacy: GLBA federal floor + CCPA/CPRA (CA), CDPA (VA), CPA (CO), CTDPA (CT), UCPA (UT), and the broader state privacy patchwork. Architecture is portable to other regions, but every concrete provider, rail, and disclosure in this document is US-spec.

> **Reading note.** This document is written to survive scrutiny from a Series A CTO, a CFPB exam team, a bank-partner compliance officer, a state regulator, an external SOC 2 auditor, and a sceptical lender partner's risk team simultaneously. It is a blueprint, not a pitch.

---

## What is built today (2026-05-15)

A delta layer on top of the original foundation document. Everything below this section reflects the original blueprint — read it for the "why". This section reflects the "what's actually in the repo right now".

### Deployed

- **`apps/partner-portal`** is live on Railway at https://eazepay-platform-production.up.railway.app. It hosts every public-facing surface AND the authenticated portals on one Next.js service.
  - Public: `/landing/{medpay,tradepay,coachpay}`, `/apply/{brand}`, `/lenders`, `/lenders/[id]`, `/docs`, `/sign-in`, `/welcome`.
  - Brand-scoped merchant portals: `/v/{brand}/{applications,insights,settlements,transactions,send-link,submit,team,settings,api-keys,integrations}`.
  - Master operator: `/`, `/insights`, `/partners`, `/applications`, `/lender-marketplace`, `/lender-marketplace/access`, `/marketplaces`, `/control-panel`, `/onboarding-pipeline`, `/approvals`, `/payouts`, `/reports`, `/events`, `/dead-letter`, `/webhooks`, `/admin`, `/eaze-ai`.
  - Build path: repo-root `Dockerfile` (3-stage standalone) + `railway.toml`. See [`runbooks/railway-deploy.md`](runbooks/railway-deploy.md).

### Implemented (in repo, not deployed)

- **`apps/api`** — NestJS BFF + public API, composes every `@eazepay/service-*` module. Runs locally on `:3000`, Swagger at `/docs`.
- **`apps/webhooks`** — inbound webhook receiver (`:3010`), kept separate for blast-radius isolation.
- **`apps/consumer-web`** (`:3001`), **`apps/merchant-dashboard`** (`:3002`), **`apps/admin-console`** (`:3003`) — Next.js sibling surfaces, run locally.
- **`apps/consumer-mobile`** — React Native (Expo). EAS Build target.
- **13 services**: `auth`, `user`, `merchant`, `application`, `orchestration`, `lender`, `payment`, `notification`, `compliance-doc`, `risk`, `audit`, `webhook`, `admin`. Each is a NestJS module with its own README.
- **4 libs**: `shared-types` (Money/BigInt cents, branded IDs, `BRANDS` registry), `shared-utils` (Problem details, AES-GCM + envelope encryption, ObjectStorage port + LocalFs adapter, idempotency decorator), `api-client` (framework-free fetch client), `ui` (tokens + web component library).
- **Infra**: Terraform modules + per-env composition in `infra/terraform/` — composed, not applied. Railway is today's deploy target.
- **Docs**: this blueprint, 17 ADRs, runbooks (local-development, incident-response), BFF contract, INDEX.

### Agentic decisioning layer (added since the foundation document)

Seven named software agents wrap the orchestration engine. Each is a discrete service with a typed contract, an "ONLINE/DEGRADED/OFFLINE" health state, and a streaming last-action log surfaced in the operator console. Pattern modelled on AUREAN AI's named-agent architecture — explicit, observable, instrumented.

| #   | Agent      | Role                                                                                                                                                                                                                          | Where it lives                               |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 01  | **PRISM**  | Intake Agent — reshapes apply-form question order based on partial answers; learns which sequences convert per traffic source                                                                                                 | `services/application` + apply-flow client   |
| 02  | **VEGA**   | Enrichment Agent — orchestrates 12 enrichment providers in parallel, fallback + dedupe                                                                                                                                        | `services/orchestration`                     |
| 03  | **ORACLE** | Scoring Agent — calibrated propensity model trained on closed-won outcomes, nightly retrain on dispositions                                                                                                                   | `services/risk` + `services/orchestration`   |
| 04  | **HELIX**  | Routing Agent — matches qualified leads to right rep, capacity-aware, learns rep-tier fit                                                                                                                                     | `services/admin` + `services/orchestration`  |
| 05  | **NEXUS**  | Lender Marketplace Agent — 52-lender parallel waterfall, prime → subprime, soft pull only, real-time stip-rate awareness                                                                                                      | `services/orchestration` + `services/lender` |
| 06  | **FLUX**   | Funding Agent — disbursement orchestration, retries, reconciliation back to ad campaigns. (Previously labelled "Payment Agent" — the platform does not process payments; FLUX orchestrates the lender → merchant funds path.) | `services/payment`                           |
| 07  | **ECHO**   | Attribution Agent — holds pixel events until lead clears qualification, fires weighted conversions to Meta + Google CAPI, uploads closed-won as offline conversions                                                           | `services/webhook` + `services/notification` |

The agent layer is the operator-facing abstraction over the underlying services. It is visible in three places:

- **Public landing pages** — `apps/partner-portal/app/landing/{medpay,tradepay,coachpay}/page.tsx` — marketing view of what each agent does, with live "last action" cards.
- **Operator insights** — `apps/partner-portal/app/insights/page.tsx` (cross-brand) and `apps/partner-portal/app/v/[brand]/insights/page.tsx` (brand-scoped) — institutional decisioning dashboard with per-agent health, throughput, drift, and audit-grade history.
- **Underlying services** — split across `orchestration`, `risk`, `lender`, `payment`, `application`, `admin`, `webhook`, `notification`.

The fair-routing default ([ADR-0013](adr/0013-fair-routing-default.md)) sits inside NEXUS; the immutable audit outbox ([ADR-0011](adr/0011-immutable-audit-via-outbox.md)) backs the streaming last-action log; the JIT PII unmask ([ADR-0017](adr/0017-jit-pii-unmask.md)) governs what operators see in HELIX's queue.

### Three brand verticals

All three are first-class on `BrandCode` in `libs/shared-types/src/brands.ts` and carried on Merchant, LenderProduct, LenderConnection, and Application rows:

- **MedPay** — dental / medical / vet / fertility / cosmetic. $1.5k – $50k tickets.
- **TradePay** — roofing / HVAC / solar / home-improvement / contractor. $3k – $150k tickets.
- **CoachPay** — high-ticket coaches / consultants / course creators / certifications / masterminds. $5k – $50k programs.

All three share the same orchestration engine, the same 52-lender marketplace, the same bank-partner originated structure, and the same compliance posture (FCRA / ECOA / TILA / Reg B + E). What differs per brand: landing copy, apply prompts, merchant portal navigation, lender mix (some lenders prefer one vertical), and ECHO's attribution weighting.

### What this platform is NOT

- **Not a payment processor.** No card rails, no MDR/interchange capture, no merchant acquiring. Section 12 / 13 / §15 of this document originally drew from the broader "embedded finance + payments" framing — the executed product is the financing + orchestration half only. FLUX (the funding agent) handles lender → merchant disbursement, not consumer card payments.
- **Not a single lender.** BuzzPay is one of 52 in the marketplace; routing default is fair, not revenue-optimal ([ADR-0013](adr/0013-fair-routing-default.md)).
- **Not a referral broker.** EazePay is the system of record for the application, the offer set, the e-contract event, the disbursement instruction, and the post-funding consumer relationship. The bank-partner / lender is the true lender of record on every approved loan.

---

## Context

EazePay is being built as embedded financial infrastructure that unifies payments and finance at point of checkout, plus a consumer-direct surface for self-originated finance applications. There are two adjacent but distinct revenue surfaces — consumer (retail borrower) and merchant (acquiring + finance distribution). EazePay also wraps a private-equity-backed in-house lender product — **BuzzPay**, built by the TrueTopia team — inside a multi-lender orchestration layer, similar in shape to Skeps or ChargeAfter.

The blueprint below is the foundation that was built before code was written. It locked scope, regulatory posture, domain model, repo topology, and the Claude Code build sequence so the team could execute deterministically across mobile, web, backend, infra, and design. The "What is built today" section above captures the delta between this blueprint and the executed product as of 2026-05-15.

---

## 1. Product Vision

### 1.1 What EazePay is

EazePay is a two-sided embedded finance and payments platform. On one side, **consumers** apply for finance — directly through the EazePay app or via a merchant link — and EazePay routes their application across an internal PE-backed lender, BNPL providers, prime/near-prime/subprime partners, and category-specialist lenders. On the other side, **merchants** integrate EazePay at checkout (link, widget, SDK, or API), accept finance-backed sales, settle funds, and manage the customer relationship through a dashboard.

EazePay is not a single lender, not a single payments rail, and not a referral broker. It is a **lender orchestration + payments + merchant operating system** — a vertical fintech stack where the lending decision, the payment flow, the merchant settlement, and the consumer relationship all live under one roof.

### 1.2 Consumer route

A consumer downloads EazePay → KYCs → tells us what they need finance for (auto, home improvement, medical, retail goods, debt consolidation, personal) → completes a soft-pull / affordability layer → EazePay's orchestration engine evaluates the case across internal + external lenders → presents ranked offers → consumer accepts → docs are signed → funds disburse → consumer manages repayments and unlock future offers in-app.

### 1.3 Merchant route

A merchant onboards → KYB → connects payments and selects which finance products to offer → generates application links, QR codes, or embeds a widget at checkout → customer applies → EazePay underwrites and routes → merchant is notified of approval → merchant fulfills the sale → EazePay disburses to the merchant and collects from the consumer over time. Merchant gets a dashboard of applications, conversion, settlements, chargebacks, and lender mix.

### 1.4 Why EazePay becomes the operating layer

Because **the same orchestration brain** serves both surfaces. A consumer who applies direct can later be routed into a merchant offer; a merchant-referred consumer becomes an EazePay account holder for life. EazePay sits between capital (PE-backed internal book + lender partners), distribution (merchants), and demand (consumers). That three-sided position is what makes this defensible — anyone can build a checkout button; very few teams can run the orchestration, the underwriting, the merchant economics, and the consumer relationship simultaneously.

### 1.5 Why the mobile app matters

The mobile app is the **consumer system of record**. Repayments, KYC re-verification, push notifications for offers, document collection, support, future cross-sell — all gravitate to the app. Without it, EazePay is a referral funnel; with it, EazePay owns the lifetime value. The app also unlocks biometric auth, device-bound risk signals, and a much lower fraud rate than browser-only flows.

### 1.6 Why the merchant platform matters

Merchant distribution is what makes the unit economics work. Direct-to-consumer customer acquisition cost in lending is brutal ($150-$400 per funded loan in AU). Merchant-embedded financing gets us applications at near-zero CAC because the merchant is paying for the customer. The merchant platform is also where we earn MDR (merchant discount rate), subscription fees, and per-application fees — three revenue lines that don't depend on us holding lending risk.

### 1.7 PE-backed in-house lender (BuzzPay, built by TrueTopia) inside the ecosystem

BuzzPay is treated as **just another lender** at the orchestration layer — except it gets first-look priority where it's economically optimal and within risk appetite. This matters legally and architecturally:

- **Legally:** BuzzPay (built by the TrueTopia team) must operate under one of two recognised US models — (a) a **bank-partner model** where a chartered bank (e.g. Cross River, WebBank, FinWise, Celtic, Lead Bank) is the true lender of record and BuzzPay/TrueTopia services and/or purchases receivables under a bank-service-provider agreement, or (b) a **state-licensed lender model** with consumer lending / installment / sales-finance licences in each state of operation. Pick one explicitly; do not blur. Most modern fintech lenders run (a) for nationwide reach with (b) as a fallback in states where bank-partner economics fail. Underwriting decisions for BuzzPay must be independently auditable, and the "true lender" must own the credit decision in form and substance — Madden + True Lender doctrines apply.
- **Architecturally:** BuzzPay exposes the same `LenderProduct` interface as external lenders. Orchestration logic does not branch on "internal vs external" — it branches on price, eligibility, risk-adjusted return, and capital availability. This keeps us honest about whether we're routing fairly and gives us a defensible UDAAP and Reg B story.

### 1.8 Lender orchestration / waterfalling

The orchestration engine evaluates each application against a configurable decision graph:

1. Hard knockouts (sanctions, age, residency, fraud).
2. Soft eligibility (each lender's published criteria).
3. Soft-pull / bureau enrichment.
4. Affordability (income vs commitments vs requested amount).
5. Lender ranking (best risk-adjusted yield + approval probability + consumer-facing rate).
6. Parallel quote where APIs support it; sequential waterfall where they don't.
7. Offer aggregation, dedupe, ranking.
8. Fallback (manual review, alternative product, decline + reasons).

### 1.9 Direct vs merchant-referred consumers

Both flows produce the same `Application` entity — only the `originationChannel` and `merchantContext` differ. This means a consumer onboarded via a merchant link automatically has an EazePay account, can repay through the app, and can apply for a future unrelated loan without re-KYCing. The merchant's attribution and economics persist on the original application but don't lock the consumer in.

---

## 2. Platform Overview

EazePay is built as a service-oriented backend (modular monolith at MVP, breaking into services as load demands), a shared design system, three frontend surfaces (iOS, Android, web), three back-office surfaces (merchant dashboard, admin/ops console, lender partner portal), and an integration layer for third-party providers (KYC, bureau, payments, banking data, e-sign, comms).

---

## 3. User Personas

| Persona                                                      | Goals                                                                 | Pain points                                                | Required surfaces                               | Required data                                                    | Permissions                                    | Security concerns                             | Success metrics                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| **Direct consumer borrower**                                 | Get finance fast, see real offers, repay easily                       | Hidden fees, slow approvals, declined without reason       | iOS/Android app, web fallback                   | Own profile, applications, offers, repayments, docs              | Self-service only                              | Account takeover, SIM swap, phishing          | Time-to-offer, approval rate, NPS, on-time repayment        |
| **Merchant-referred consumer**                               | Buy the thing, finance painless                                       | Too many redirects, app installs forced                    | Mobile web → optional app, app deep link        | As above + merchant context                                      | Self-service only                              | Same as above + merchant impersonation        | Conversion, application start→submit, AOV uplift            |
| **Merchant owner**                                           | More sales, predictable settlement, low risk                          | Chargebacks, finance partner integration pain, opaque fees | Merchant dashboard (web), mobile web            | Own merchant, all applications referred, settlements, team       | Full merchant admin, billing                   | Credential theft, key leakage, internal fraud | GMV, finance attach rate, settlement-to-payout time         |
| **Merchant admin/staff**                                     | Operate day-to-day                                                    | Cluttered UI, can't find applications                      | Merchant dashboard                              | Scoped: applications, customers, transactions                    | Configurable RBAC                              | Over-permissioning, exfiltration              | Operational throughput                                      |
| **EazePay internal ops**                                     | Process applications, resolve exceptions                              | Manual data hunting, tool sprawl                           | Admin console                                   | All applications, all merchants, masked PII unless purpose-bound | Role-based + just-in-time elevation            | Insider risk, PII exposure                    | Time-to-decision, exception backlog                         |
| **Underwriting team**                                        | Make sound credit decisions, defend them                              | Inconsistent data, no audit trail                          | Underwriting console                            | Application + bureau + bank + docs                               | UW role + approval limits                      | Data leakage, bias                            | Default rate by cohort, decision SLA                        |
| **Compliance/risk team**                                     | Stay on the right side of CFPB / state regulators / partner-bank exam | Fragmented evidence, late audit prep                       | Compliance console, audit log viewer            | Read-most, cannot mutate financial state                         | Audit-only + reviewer                          | Tampering, log gaps                           | Findings closed, complaint SLA, reportable-event timeliness |
| **Lender partner**                                           | See routed applications, manage limits, pull data                     | Manual reconciliation, no real-time view                   | Lender partner portal + API + webhooks          | Only own routed cases                                            | Partner-scoped                                 | Cross-tenant data leakage                     | Approval rate, funded volume, dispute rate                  |
| **PE / internal capital team (TrueTopia + EazePay capital)** | Track BuzzPay book performance                                        | No real-time book view                                     | Capital dashboard (subset of admin)             | Aggregated BuzzPay loan tape, risk metrics                       | Read-only + report export                      | Material non-public info                      | Yield, default, vintage curves                              |
| **Support team**                                             | Resolve tickets fast                                                  | Switching tools, no context                                | Support console + ticketing integration         | Customer + application + masked PII per ticket                   | Scoped to active ticket (purpose-bound access) | Social engineering                            | First-response time, CSAT                                   |
| **Sales/onboarding**                                         | Land merchants, get them transacting                                  | Slow KYB, drop-off in setup                                | Internal sales console + merchant impersonation | CRM + merchant pipeline                                          | Scoped + impersonation with consent            | Impersonation abuse                           | Time-to-first-transaction                                   |
| **Developer/integration partner**                            | Integrate widget/API/SDK                                              | Bad docs, sandbox parity gaps                              | Developer portal, sandbox, API keys             | Own integration, test data                                       | API-key scoped                                 | Key leakage, prod misuse                      | Integration time, sandbox→prod conversion                   |

---

## 4. Product Surface Map

| Surface                        | Description                                                                             | Primary tech                                                                           | Auth model                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| iOS app                        | Consumer system of record                                                               | React Native (recommended — see §10) over Swift bridges for biometrics, secure enclave | OAuth2 + biometric + device-bound refresh token                          |
| Android app                    | Same as iOS                                                                             | React Native + native KeyStore bridges                                                 | Same                                                                     |
| Consumer web                   | Fallback for merchant-referred non-app users; full feature parity for desktop borrowers | Next.js (App Router) + TS                                                              | OAuth2 + WebAuthn                                                        |
| Merchant dashboard             | Web app for merchants                                                                   | Next.js + TS                                                                           | OAuth2 + WebAuthn + optional SSO (SAML/OIDC)                             |
| Admin/ops console              | EazePay internal                                                                        | Next.js + TS, separate auth domain                                                     | Internal SSO (Okta/Google Workspace) + step-up MFA + just-in-time access |
| Underwriting console           | Subset of admin, specialised UI                                                         | Same codebase, role-gated routes                                                       | UW role + approval limits                                                |
| Lender partner portal          | External partner web                                                                    | Next.js + TS, separate tenancy                                                         | OAuth2 + per-partner SSO                                                 |
| Public API                     | Versioned REST + webhooks                                                               | NestJS (Node) — see §10                                                                | API key (HMAC-signed) + OAuth2 client credentials                        |
| Checkout widget                | Drop-in JS for merchant checkouts                                                       | Vanilla TS bundle, ~30KB gzipped target                                                | Public publishable key + server-side session                             |
| Application link flow          | Hosted application web flow opened from a merchant link                                 | Next.js, optimised for mobile web                                                      | Stateless link token (signed, expiring)                                  |
| Embedded merchant finance flow | iframe + postMessage SDK                                                                | Same as widget                                                                         | Same                                                                     |
| Consumer direct loan flow      | App + web                                                                               | App / Next.js                                                                          | OAuth2                                                                   |
| Merchant onboarding flow       | Web + email + e-sign                                                                    | Next.js + DocuSign/equivalent                                                          | Magic link + password + MFA                                              |
| Settlement tracking            | Merchant dashboard module                                                               | Same                                                                                   | Same                                                                     |
| Notification system            | Push (APNs/FCM), email (SES/SendGrid), SMS (Twilio), in-app                             | Notification service                                                                   | Internal                                                                 |
| Support system                 | In-app chat + ticketing (Zendesk or Intercom)                                           | Embed + backend bridge                                                                 | Customer auth + agent SSO                                                |
| Compliance review tools        | Admin module                                                                            | Same admin app                                                                         | Compliance role                                                          |
| Risk monitoring tools          | Admin module + alerting                                                                 | Same                                                                                   | Risk role                                                                |
| Developer portal               | Docs + sandbox + API keys                                                               | Next.js + Mintlify or similar                                                          | Developer account                                                        |

---

## 5. Consumer Journey (Direct)

```
App store discovery  →  Install
Open app  →  Splash  →  Welcome carousel (3 screens, value prop + trust)
Sign up  →  email OR phone  →  OTP
Create profile  →  legal name, DOB, address (Google Places autocomplete + manual fallback)
KYC  →  ID document capture (Persona / Socure / Jumio behind Alloy) + liveness selfie + SSN
        →  background: OFAC SDN, PEP, address verification, IRS TIN match where applicable, FCRA Identity Theft Red Flags check
Home dashboard  →  "What do you need finance for?"
Choose category  →  auto, home improvement, medical, retail, personal, consolidation
Application form  →  amount, term preference, purpose detail
Income/employment  →  employer, role, frequency, net pay
Bank connection  →  Plaid (Auth + Identity + Income + Transactions)  OR  payslip + bank statement upload fallback
Soft-pull consent  →  explicit, separated screen, plain-English disclosure, e-signature event recorded
Eligibility/affordability  →  background: bureau soft pull, affordability calc, knockouts
Offer loading  →  animated, with honest expected duration
Offer results  →  ranked list with APR, total cost, monthly, term, lender name (or "EazePay Finance" for BuzzPay)
Offer comparison  →  side-by-side, key facts highlighted, "this is more expensive overall" flags
Offer detail  →  full TILA disclosure: APR, finance charge, amount financed, total of payments, payment schedule, fees, lender of record (partner bank), servicer, complaints info (CFPB + state AG)
Accept offer  →  confirm, e-sign credit contract, e-sign direct debit authority
Document upload (if required)  →  bank statements, payslip, ID re-capture
Approval screen  →  congrats + next steps
Funding status  →  "funds on the way" with ETA
Repayment dashboard  →  next payment, upcoming, history, payoff quote
Notifications  →  payment reminders, approval changes, offers
Profile/settings  →  PII edit (with re-verification), close account, data download (Privacy Act request)
Support  →  chat, FAQ, CFPB + state AG complaint references, payment-assistance / hardship pathway
Future offers  →  pre-qualified offers based on repayment behavior + consent
```

**Critical journey rules:**

- Soft pull consent screen is its own step. Never bundled with terms acceptance. Auditable E-SIGN-compliant consent event written before any bureau call. FCRA permissible purpose recorded.
- Offer screen never re-orders by EazePay revenue without user-visible disclosure. Default sort is "lowest total cost" for UDAAP defensibility and to avoid steering claims under ECOA.
- Decline path delivers a **FCRA + ECOA-compliant Adverse Action Notice** with specific principal reasons, credit score disclosure where applicable, bureau contact info, and ECOA non-discrimination notice. Delivered in-app + email within 30 days.
- Hardship / payment assistance pathway is reachable from every repayment screen in 1 tap (UDAAP + state UDAP + CFPB supervisory expectations).
- Pre-contract TILA disclosures (Reg Z box) shown before offer accept; final TILA disclosures + payment schedule + Schumer box where applicable shown at signing.

---

## 6. Merchant Journey

### 6.1 Merchant generates and sends a link

```
Merchant logs into dashboard
→ "Create application link" → choose product, amount, optional pre-fill (sale value, item description, customer email)
→ Link generated: eazepay.com/apply/<merchant>/<token>   (signed, expiring, scoped)
→ Copy / SMS / email / QR
Customer opens link on mobile web
→ Merchant brand + product context displayed (verified, not user-supplied)
→ Same KYC / eligibility flow as direct (single codebase)
→ Application tied to merchant via signed token
→ Lender route runs
→ Approval → e-sign → optional "create EazePay account" CTA (not mandatory at MVP)
→ Funds disbursed to merchant (T+0 / T+1 depending on product)
→ Merchant dashboard updates in near real-time via webhook + UI poll
→ Customer receives EazePay app prompt for repayment management
```

### 6.2 Merchant onboarding

```
Sign up (email + password + MFA enrol)
→ Business details (legal name, EIN, DBA, formation state, industry, website)
→ KYB: EIN / IRS TIN match, Secretary of State good-standing, beneficial owners (≥25%) + control person per FinCEN BOI rule, OFAC + PEP screen on entity + every BO + signers
→ Beneficial owner KYC for each
→ Bank account for settlement (PennyDrop / verified deposit)
→ Risk checks: industry blocklist (gambling, crypto except licensed, adult, weapons, MLM), AVS, fraud signals
→ Payment processing onboarding (if accepting cards): Stripe Connect / Adyen MarketPay / direct acquirer
→ Finance product selection: which lender products this merchant can offer
→ Pricing agreement (MDR, application fee, settlement terms)
→ Contract e-sign (master services + finance distribution + privacy)
→ API/widget/link setup: publishable key, secret key (shown once), webhook endpoints
→ Dashboard activated
→ "Send your first application" guided flow
```

### 6.3 KYB depth (US)

EIN verification (IRS TIN match where eligible), Secretary of State good-standing check (state-specific), beneficial ownership per **FinCEN CTA / Beneficial Ownership Information rule** (≥25% owners + control persons), CIP per BSA, OFAC SDN + consolidated screen on entity + every BO + every authorized signer, MCC / NAICS classification, prohibited-merchant blocklist (firearms outside FFL, gambling without licence, marijuana including state-legal MRBs unless we explicitly stand up an MRB program, adult, MLM, debt collection, deceptive marketing), bank account verification via Plaid + micro-deposit fallback. Ongoing: OFAC re-screen on any roster change + monthly batch, periodic refresh (annual for low-risk, semi-annual+ for elevated).

---

## 7. Admin / Ops Journey (Underwriting & Risk)

```
Application lands in queue (auto-routed by orchestration; manual review only on exception)
→ UW console opens application detail
   - Applicant summary (masked, unmask requires reason code, logged)
   - Bureau report (soft / hard depending on stage)
   - Bank data + affordability calc with drill-down
   - Document set (with OCR + flags)
   - Risk flags (velocity, device, IP, fraud signals, sanctions hits)
   - Lender route history (which lenders evaluated, decisions, latencies)
→ Decision: approve / decline / counter-offer / request docs / escalate
   - Approve within authority limit; above limit routes to senior UW
   - Decline requires reason codes mapped to the **Reg B / FCRA Adverse Action reason taxonomy** (specific principal reasons, no generic "credit policy"). UW console enforces minimum-2 reason codes and blocks vague entries.
   - Counter-offer (different amount/term) requires re-disclosure
   - Request docs sends typed list to consumer with deadline (clock paused per Reg B 30-day rules)
→ All actions write to immutable audit log (append-only, hash-chained)
→ Decision returns to orchestration; consumer/merchant notified
→ Quality assurance sample: 5% of approvals + 100% of overrides reviewed by QA reviewer
```

---

## 8. Figma Design System Plan

### 8.1 File structure (Figma)

```
EazePay /
├── 00 — Brand Foundations
├── 01 — Tokens (colors, typography, spacing, radius, elevation, motion)
├── 02 — Primitives (icons, illustrations, logo)
├── 03 — Components / Mobile
├── 04 — Components / Web Dashboard
├── 05 — Components / Marketing
├── 06 — Patterns (forms, lists, cards, empty/error/loading, disclosures)
├── 07 — Flows / Consumer App
├── 08 — Flows / Merchant Dashboard
├── 09 — Flows / Admin Console
├── 10 — Flows / Application Link
├── 11 — Prototypes
└── 12 — Handoff (annotations, redlines, dev notes)
```

### 8.2 Tokens (recommended)

- **Color:** semantic tokens (`color/bg/default`, `color/text/primary`, `color/intent/success/bg`, etc.) — never raw hex referenced from screens. Two themes: light + dark, AA-contrast-compliant minimum, AAA on body text.
- **Typography:** Inter or SF Pro Text/Display + a numerical-preferred font for amounts (e.g. SF Pro Mono tabular figures) to keep currency aligned. Type scale: 12 / 14 / 16 / 18 / 20 / 24 / 32 / 40.
- **Spacing:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 80.
- **Radius:** 4 / 8 / 12 / 16 / 999 (pill).
- **Elevation:** 0 / 1 / 2 / 3 with semantic naming (`elevation/card`, `elevation/modal`, `elevation/popover`).
- **Motion:** durations 100 / 200 / 320 / 500ms; easings `standard`, `emphasized`, `decelerate`, `accelerate`.

Tokens live in Figma Variables and are exported to `eazepay-design-system` repo via Style Dictionary into platform formats: CSS vars, RN StyleSheet, iOS asset catalog, Android resources.

### 8.3 Component library (priority order)

**Atoms:** Button (primary, secondary, tertiary, destructive, ghost; loading; disabled), Input (text, number, currency, password, masked), Select, Checkbox, Radio, Switch, Chip, Tag, Badge, Avatar, Icon, Divider, Spinner, Skeleton.

**Molecules:** Form Field (label + input + helper + error), Card, ListItem, Disclosure (compliance), DataRow (key/value), OfferCard, RepaymentCard, KycStepCard, Modal, Sheet, Toast, Banner, Alert, Tooltip, Popover, Tabs, Stepper, ProgressBar, Pagination.

**Organisms:** TopBar, BottomTabBar, NavSidebar, AppShell, OfferComparison, ApplicationSummary, DocumentUploader, BankConnectionFlow, OtpInput, SignatureCapture.

**Empty / error / loading states:** every list, every dashboard widget, every async surface ships with all four states (default, empty, error, loading) before it merges.

**Compliance / trust UI:** standardised disclosure pattern — `<DisclosurePanel>` with title, plain-English summary, expandable full text, "I have read" checkbox where required, audit hook that fires the consent event on tick.

### 8.4 Accessibility

- WCAG 2.1 AA minimum; AAA for credit disclosure copy.
- All interactive elements ≥44×44pt touch target (mobile).
- Focus visible on all controls, keyboard-operable on web.
- Dynamic type support on iOS (scale to 200%); Material font scaling on Android.
- Screen reader labels reviewed with VoiceOver/TalkBack on every flow.
- No information conveyed by color alone (decline reasons must include icon + text).

### 8.5 Naming conventions

`Component / Variant / State` — e.g. `Button / Primary / Default`, `Button / Primary / Loading`, `OfferCard / Recommended / Default`. Code Connect mappings exported so `eazepay-design-system` React components match Figma component names 1:1.

### 8.6 Prototype flows

For sign-off, prototypes for: full consumer onboarding, full merchant onboarding, application link customer flow, offer accept + e-sign, repayment management, hardship request, merchant generate-link → settlement, admin underwriting decision.

---

## 9. Screen Inventory

### Consumer app (mobile)

1. Splash
2. Welcome (3 carousel)
3. Sign up — choose method
4. Sign up — email/phone entry
5. OTP verification
6. Create profile — name/DOB
7. Create profile — address
8. Biometric enrolment opt-in
9. KYC intro / consent
10. ID document type select
11. ID document capture (front)
12. ID document capture (back)
13. Liveness selfie
14. KYC processing
15. KYC success / failure / manual review
16. Home dashboard (no application yet)
17. Home dashboard (active application)
18. Home dashboard (active loan)
19. Choose financing category
20. Application — amount + term
21. Application — purpose
22. Application — income
23. Application — employment
24. Application — expenses
25. Application — bank connection consent
26. Bank connection (Plaid Link + FCRA-style consent for derived data use)
27. Bank connection success / fallback to upload
28. Soft-pull consent
29. Application review + submit
30. Offer loading
31. Offer results (list)
32. Offer comparison (2-up)
33. Offer detail
34. Pre-contract disclosure
35. Accept offer + e-sign credit contract
36. Direct debit authority e-sign
37. Document upload (conditional)
38. Approval / final decision
39. Funding status
40. Repayment dashboard
41. Repayment detail / payoff quote
42. Make extra repayment
43. Hardship request flow (3 screens)
44. Notifications inbox
45. Profile
46. Settings (security, biometrics, notifications, data download, close account)
47. Support — chat + FAQ
48. Legal / disclosures hub (privacy, terms, target market determination)
49. Decline screen with FCRA + ECOA Adverse Action Notice (specific reasons, bureau info, ECOA non-discrimination notice, complaint contacts)
50. Account locked / fraud hold

### Merchant dashboard (web)

1. Login
2. MFA challenge
3. Onboarding — business details
4. Onboarding — owners (repeating)
5. Onboarding — KYB status
6. Onboarding — settlement bank
7. Onboarding — payment processing setup (if applicable)
8. Onboarding — finance product selection
9. Onboarding — contract e-sign
10. Onboarding — integration (link / widget / API choice)
11. Dashboard home (KPIs)
12. Generate application link
13. Application links list
14. Applications list (filterable)
15. Application detail
16. Customer detail (within merchant scope)
17. Transactions
18. Settlements
19. Settlement detail / payout breakdown
20. Disputes / chargebacks
21. Analytics (conversion, attach rate, lender mix)
22. Webhooks management
23. API keys management
24. Team & permissions
25. Billing & pricing
26. Compliance docs (KYB evidence, contracts)
27. Support
28. Settings (org profile, branding for hosted flow)

### Admin / ops console

1. Login (SSO)
2. Step-up MFA
3. Application queue (filters: status, age, risk, lender, merchant)
4. Application detail (UW view)
5. Customer profile (full, with masking)
6. Merchant profile (full)
7. Risk flags dashboard
8. Lender routing inspector (decision graph for an application)
9. Manual review workspace
10. Document review (with OCR + flags)
11. Approve / decline action panel
12. Audit log viewer
13. Support tickets
14. System health (service status, queue depths, lender SLAs)
15. Lender performance (approval rate, decision latency, default rate by vintage)
16. Configuration: rules engine, lender priorities, knockout rules
17. User & role management
18. Just-in-time access requests
19. Compliance reports (SAR queue, OFAC hits, Adverse Action audit, payment-assistance register, CFPB complaint register, state AG complaint register, fair-lending monitoring, partner-bank MIS pack)
20. Capital dashboard (BuzzPay / TrueTopia book performance — gated)

---

## 10. Technical Architecture

### 10.1 Mobile: React Native (recommended)

**Decision: React Native (Expo bare workflow or RN CLI) + TypeScript.**

| Option                | Pros                                                                                                                                    | Cons                                                                                                                                  | Verdict                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Native Swift + Kotlin | Best perf, full platform access                                                                                                         | 2x build cost, 2x team, slower iteration                                                                                              | Reject for MVP. Revisit only if RN bottlenecks emerge. |
| Flutter               | Good perf, single codebase                                                                                                              | Dart ecosystem smaller, fintech library gaps (Plaid, Persona, Stripe SDKs all JS/Swift/Kotlin first), narrower US fintech hiring pool | Reject.                                                |
| **React Native + TS** | Shares logic with web, mature US fintech library coverage (Plaid, Stripe, Persona/Socure/Jumio, Sift), easy native bridges where needed | Bridge maintenance, perf ceiling on heavy animations                                                                                  | **Accept.**                                            |

Native bridges required: biometrics (Keychain / KeyStore), secure enclave for refresh token, camera + ML Kit for ID capture, Apple Pay / Google Pay (V2), push (APNs / FCM), App Attest / Play Integrity for device attestation.

State: React Query + Zustand. Navigation: React Navigation. Forms: React Hook Form + Zod. Crypto: native bridges only — never JS-side crypto for sensitive material.

### 10.2 Web frontend

**Next.js 14+ (App Router) + TypeScript + Tailwind + shadcn/ui base, themed with EazePay design tokens.**

- Server components by default, client components only where needed.
- Route handlers for BFF aggregation against the public API.
- Strict CSP, Trusted Types, SRI on third-party scripts.
- Three Next apps: `consumer-web`, `merchant-dashboard`, `admin-console`. Same monorepo, separate deployments, separate auth domains.

### 10.3 Backend

**Decision: NestJS (Node 20 LTS) + TypeScript for primary services. Go for the orchestration engine and decisioning service if/when latency demands.**

| Option               | Pros                                                               | Cons                                                            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| **NestJS**           | Strong DI, TS shared with FE, fintech ecosystem, fast hiring in AU | Single-threaded; not ideal for CPU-heavy decisioning at scale   |
| Go                   | Excellent perf + concurrency for orchestration, single binary      | Smaller AU talent pool, more boilerplate for CRUD services      |
| Java/Kotlin (Spring) | Mature, regulated-industry pedigree                                | Heavy, slower iteration, smaller cultural fit for our team size |

**Recommendation:** NestJS for everything at MVP. Carve out the orchestration engine into Go in V1 if benchmarks demand (target P99 orchestration call < 800ms including external lender calls, which means our internal logic budget is ~150ms — Node will hold this).

**Datastores:**

- **PostgreSQL 16** (Aurora PostgreSQL on AWS) — primary OLTP. Multi-AZ. Logical replication to a read replica + analytics warehouse.
- **Redis (ElastiCache)** — sessions, rate limiting, idempotency keys, short-TTL caches. Never source-of-truth.
- **DynamoDB** — high-write append-only audit log (cheaper at scale than Postgres for this workload).
- **S3** — documents (KMS-encrypted, object lock for retention).
- **OpenSearch** — application + audit search.
- **Snowflake / Redshift / BigQuery** — warehouse (decision deferred until V1; Snowflake on AWS US-East is the default for fintech tooling alignment).

**Event bus: Amazon EventBridge for domain events + SQS for work queues + SNS for fanout. Kafka (MSK) only if event volume justifies it (V2+).**

**Object storage:** S3 with separate buckets per data class: `eazepay-documents-prod` (KMS, object lock, no public access), `eazepay-public-assets-prod` (CloudFront-fronted), `eazepay-exports-prod` (signed URLs, 1h TTL).

**Secrets:** AWS Secrets Manager + Parameter Store. No secret in env files in prod. Rotation enforced per type (DB creds 30d, API keys 90d, KMS data keys hourly).

**API gateway:** AWS API Gateway (HTTP API) → ALB → ECS Fargate services. Public widget + webhooks path goes through CloudFront → API Gateway with WAF (AWS Managed Rules + custom rate limit + geofence).

### 10.4 Service decomposition (modular monolith → services)

Single deployable NestJS app (`apps/api`) with internal module boundaries enforced by Nx project graph. 13 services composed in.

```
auth            — registration, login, OTP, sessions, MFA, device binding
user            — consumer profiles, PII vault, consents
merchant        — merchants, businesses, beneficial owners, brand membership
application     — application lifecycle, XState v5 state machine
orchestration   — lender routing, waterfall, offer aggregation (NEXUS lives here)
lender          — lender registry, lender adapters (BuzzPay + external mocks)
payment         — disbursement, repayment, collection cron (FLUX lives here)
notification    — push/email/SMS/in-app dispatch + in-app inbox
compliance-doc  — Adverse Action Notice renderer + Document store
risk            — fraud signals, velocity, device, composite scoring (feeds ORACLE)
audit           — AuditOutbox drain → hash-chained immutable sink
webhook         — outbound merchant webhooks + dispatcher cron
admin           — admin queue + decline override + JIT PII unmask + ops console BFF
```

Each module exposes a typed in-process interface today; each can be extracted to its own service tomorrow without contract change. Boundaries enforced by ESLint rules + Nx module dependency graph ([ADR-0010](adr/0010-modular-monolith-with-extraction-paths.md)).

### 10.5 Cloud topology (AWS, US — `us-east-1` primary, `us-west-2` DR)

```
Internet
  → CloudFront (static + API edge)
  → WAF (AWS Managed + custom)
  → API Gateway (public APIs)
  → ALB (private)
  → ECS Fargate (services)
  → Aurora PostgreSQL (private subnets, multi-AZ)
  → ElastiCache Redis (private)
  → S3 (private, VPC endpoint)
  → DynamoDB (VPC endpoint)
  → KMS (envelope encryption everywhere)

Out of band:
  → SES (email), SNS (SMS), Pinpoint (push), Secrets Manager, EventBridge, SQS
```

VPC: 3 AZ in `us-east-1`, mirror in `us-west-2` for DR (warm-standby Aurora Global Database). Public subnets only for ALB + NAT, private subnets for compute, isolated subnets for DB. VPC Flow Logs on. GuardDuty + Security Hub + Config + CloudTrail enabled in a separate audit account. AWS Organizations multi-account: `prod`, `staging`, `dev`, `sandbox`, `audit`, `security`, `shared-services`. All processing inside US regions; cross-border data transfer disabled by SCP. FedRAMP-aligned services preferred where the same primitive exists.

**Auth provider:** AWS Cognito for the heavy lifting (user pool, OAuth2, MFA, OIDC federation for merchant SSO) augmented with our own session service for device binding, refresh rotation, and risk-based step-up. We do not roll our own password hashing or OAuth — too much regulated risk for too little upside. Auth0 is a viable alternative but more expensive at scale; reject.

### 10.6 Observability

- **Logs:** structured JSON, OpenTelemetry, centralised in Datadog or Grafana Loki. PII scrubbing pipeline before egress.
- **Metrics:** OpenTelemetry → Datadog / Prometheus + Grafana.
- **Traces:** OpenTelemetry, all external lender calls instrumented with vendor + product + decision dimensions.
- **Alerting:** SLOs defined per critical user journey (sign-up success rate, time-to-offer, approval webhook delivery). Burn-rate alerts.
- **Synthetics:** every critical journey hit every 5min from 2 regions.

---

## 11. Repo Strategy

**Decision: Hybrid — one Nx-managed monorepo for product code, separate repos for infra and design system.**

### 11.1 Repos

#### `eazepay/platform` (monorepo, Nx + pnpm)

This is the executed topology — see the root [`README.md`](../README.md) for the full URL taxonomy of `partner-portal`, port assignments, and per-app responsibilities.

```
apps/                              # 7 boundary processes
  api/                             # NestJS BFF + public API (:3000)
  partner-portal/                  # Next.js — main deployed app (:3004, Railway)
                                   #   hosts landings, apply flows, lender hub,
                                   #   brand-scoped merchant portals, master operator
  consumer-web/                    # Next.js consumer apply (:3001)
  merchant-dashboard/              # Next.js merchant portal (:3002)
  admin-console/                   # Next.js internal ops + compliance (:3003)
  consumer-mobile/                 # React Native (Expo), iOS + Android
  webhooks/                        # Inbound webhook receiver (:3010)
services/                          # 13 NestJS module packages, modular monolith
  auth/                            # Cognito + custom session/device layer
  user/                            # ConsumerProfile + PII vault (envelope encryption)
  merchant/                        # KYB + beneficial owners + application links
  application/                     # Lifecycle state machine (XState v5)
  orchestration/                   # Lender waterfall + decisioning + risk gate (NEXUS lives here)
  lender/                          # LenderAdapter port + adapter registry
  payment/                         # Disbursement + repayment + collection cron (FLUX lives here)
  notification/                    # Multi-channel dispatch + in-app inbox
  compliance-doc/                  # Adverse Action Notice renderer + Document store
  risk/                            # Composite risk scoring + RiskFlag taxonomy
  audit/                           # AuditOutbox drain → hash-chained immutable sink
  webhook/                         # Outbound merchant webhooks + dispatcher cron
  admin/                           # Admin queue + decline override + JIT PII unmask
libs/                              # 4 shared packages
  shared-types/                    # Money (BigInt cents), branded IDs, Zod primitives, BRANDS
  shared-utils/                    # RFC 7807 Problem, AES-GCM + envelope encryption,
                                   #   ObjectStorage port, ULID, idempotency decorator
  api-client/                      # Framework-free fetch client + TokenStore
  ui/                              # Tokens + Tailwind preset + web component lib
                                   #   (@eazepay/ui/web; native bindings stubbed)
tools/
  generators/                      # Nx generators (reserved)
  scripts/                         # Repo scripts (reserved)
docs/
  ARCHITECTURE.md                  # This document
  INDEX.md                         # Docs navigation
  bff-contract.md                  # BFF / API contract
  adr/                             # 17 ADRs + template (0001 → 0017)
  runbooks/                        # local-development, incident-response
infra/
  terraform/modules/               # network, aurora, ecs-service, kms, s3-bucket,
                                   #   cloudfront-waf, redis
  terraform/envs/                  # dev / staging / prod (composed, not applied)
  runbooks/                        # terraform-bootstrap
.github/workflows/                 # CI
Dockerfile                         # partner-portal 3-stage standalone build
railway.toml                       # Railway deploy config
docker-compose.yml                 # Local Postgres + Redis
nx.json · pnpm-workspace.yaml · tsconfig.base.json · package.json
README · HANDOFF · CONTRIBUTING · CHANGELOG · LICENSE · SECURITY · RAILWAY_DEPLOY
```

**Why monorepo:** shared types between FE/BE, atomic cross-cutting changes, single CI policy, single security baseline. **Why Nx:** project graph, affected-builds, code generators, opinionated scaling.

#### `eazepay/design-system`

Standalone repo — design tokens (Style Dictionary), Figma plugin/sync, React + RN component packages, Storybook. Published to GitHub Packages and consumed by `platform` via `@eazepay/ui`.

#### `eazepay/infra`

Terraform (AWS) + GitHub Actions OIDC. Separate state per environment. Atlantis or Terraform Cloud for plan/apply. **Never** in the product monorepo — different review cadence, different approvers, different blast radius.

#### `eazepay/integrations`

Reference SDKs and example integrations for merchants. Also where we publish the public widget bundle and the JS/Python/PHP SDKs. Public repo (V1).

#### `eazepay/sdk` (V1)

Public-facing language SDKs (TS, Python, PHP, Ruby first). Auto-generated from OpenAPI + handwritten ergonomics layer. Public.

#### `eazepay/admin` — **collapsed into platform monorepo** as `apps/admin-console`. Resist the urge to split.

#### `eazepay/docs`

Public docs site (Mintlify). Source for developer.eazepay.com.

### 11.2 Per-repo policies

| Repo          | Visibility | CI required                                                                    | Review                                       | Branch protection                              | Secrets                    |
| ------------- | ---------- | ------------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------- | -------------------------- |
| platform      | private    | lint, typecheck, unit, integration, e2e (smoke), security scan, container scan | 2 reviewers, 1 codeowner from affected scope | main protected, signed commits, linear history | OIDC to AWS, no long-lived |
| design-system | private    | lint, typecheck, unit, visual regression (Chromatic)                           | 1 reviewer                                   | main protected                                 | npm token via OIDC         |
| infra         | private    | terraform fmt, validate, plan, tfsec, checkov                                  | 2 reviewers incl. infra owner                | main protected, manual apply gate              | OIDC to AWS                |
| integrations  | public     | lint, typecheck, build, e2e against sandbox                                    | 1 reviewer                                   | main protected                                 | public, no secrets         |
| sdk           | public     | per-language CI                                                                | 1 reviewer                                   | main protected                                 | npm/PyPI via OIDC          |
| docs          | private    | build, link check                                                              | 1 reviewer                                   | main protected                                 | none                       |

### 11.3 Branching

Trunk-based. Short-lived feature branches (≤2 days). Required PR. Squash-merge to main. Release branches only for mobile (one per app store submission).

---

## 12. Backend Domain Model

Below: entities with key fields, relationships, indexes, sensitivity, encryption, audit.

> Notation: `🔒 PII`, `🔐 sensitive (financial)`, `🛡 secret`, `📜 audit-required` (every mutation logged).

### 12.1 Identity & users

- **User** — `id (uuid)`, `email 🔒`, `phone 🔒`, `passwordHash 🛡`, `mfaSecret 🛡`, `createdAt`, `status`, `kycStatus`, `riskLevel`. Index: `email unique`, `phone unique`. 📜
- **ConsumerProfile** — `userId fk`, `legalName 🔒`, `dob 🔒`, `address 🔒`, `taxResidency`, `pepStatus`, `sanctionsLastChecked`. Encrypted at column level via KMS-wrapped data keys. 📜
- **MerchantUser** — `id`, `merchantId fk`, `userId fk`, `role`, `permissions[]`, `lastLoginAt`. 📜
- **Session** — `id`, `userId`, `deviceId`, `refreshTokenHash 🛡`, `ip`, `userAgent`, `expiresAt`, `revokedAt`. Hot in Redis, persisted in PG for forensics.

### 12.2 Merchant

- **Merchant** — `id`, `legalName`, `dba`, `ein 🔒`, `formationState`, `entityType`, `industry (NAICS + MCC)`, `riskTier`, `status`, `kybStatus`, `createdAt`, `mdrBps`, `applicationFeeCents`, `settlementBankAccountId`. 📜
- **Business** (1:1 with Merchant for AU; allows multi-entity in future) — `abn`, `asicExtractRef`, `incorporatedDate`.
- **BeneficialOwner** — `id`, `merchantId`, `legalName 🔒`, `dob 🔒`, `address 🔒`, `ownershipPct`, `isControlling`, `kycStatus`. 📜

### 12.3 Application & lending

- **Application** — `id`, `consumerId`, `merchantId nullable`, `originationChannel`, `requestedAmountCents 🔐`, `category`, `purpose`, `status`, `submittedAt`, `decisionAt`, `riskScore 🔐`, `affordabilityResult 🔐`. Index: `consumerId,createdAt`, `merchantId,createdAt`, `status`. 📜
- **LoanRequest** — `applicationId fk`, `amountCents 🔐`, `termMonths`, `purposeDetail`.
- **UnderwritingData** — `applicationId fk`, `bureauReportRef`, `bankDataRef`, `incomeMonthlyCents 🔐`, `expensesMonthlyCents 🔐`, `existingDebtCents 🔐`, `creditScore 🔐`. Encrypted column-level. 📜
- **Offer** — `id`, `applicationId fk`, `lenderProductId fk`, `amountCents 🔐`, `termMonths`, `aprBps 🔐`, `comparisonRateBps`, `feesCents`, `totalRepayableCents 🔐`, `expiresAt`, `status`, `rank`. 📜
- **Lender** — `id`, `legalName`, `aclNumber`, `status`, `priority`, `slaP95Ms`. 📜
- **LenderProduct** — `id`, `lenderId fk`, `name`, `category`, `minAmount`, `maxAmount`, `minTerm`, `maxTerm`, `minScore`, `maxDti`, `eligibilityRulesJson`, `pricingFormula`, `enabled`. 📜
- **LenderRoute** — `id`, `applicationId`, `lenderProductId`, `evaluationOrder`, `evaluatedAt`, `evaluationLatencyMs`, `outcome (eligible|ineligible|approved|declined|error)`, `reasonCode`, `rawResponseRef`. Append-only. 📜
- **DecisionResult** — `applicationId`, `decision`, `decidedBy (system|userId)`, `decidedAt`, `reasonCodes[]`, `policyVersion`, `evidenceRefs[]`. Append-only. 📜
- **Loan** — `id`, `offerId fk`, `consumerId`, `principalCents 🔐`, `aprBps 🔐`, `termMonths`, `disbursedAt`, `firstPaymentDate`, `status`, `lenderId`. 📜
- **Repayment** — `id`, `loanId`, `dueDate`, `amountDueCents 🔐`, `amountPaidCents 🔐`, `paidAt`, `status`. 📜

### 12.4 Documents, consents, contracts

- **Document** — `id`, `ownerType (consumer|merchant|application)`, `ownerId`, `type`, `s3Key`, `sha256`, `mimeType`, `uploadedAt`, `ocrResultRef`, `retentionUntil`. 🔒 📜
- **Consent** — `id`, `userId`, `type (soft_pull|hard_pull|cdr|marketing|terms|privacy)`, `version`, `grantedAt`, `revokedAt`, `evidenceRef (signed event hash)`, `ipAddress`, `userAgent`. Append-only. 📜
- **Contract** — `id`, `parties[]`, `type`, `version`, `signedAt`, `signatureProvider`, `envelopeId`, `documentId fk`. 📜

### 12.5 Payments & money

- **PaymentMethod** — `id`, `userId`, `type (bank|card)`, `tokenRef 🛡` (no PAN/PCI; tokenised in PSP), `last4`, `status`. 📜
- **Transaction** — `id`, `loanId nullable`, `merchantId nullable`, `direction`, `amountCents 🔐`, `currency`, `status`, `providerRef`, `occurredAt`. 📜
- **Settlement** — `id`, `merchantId`, `periodStart`, `periodEnd`, `grossCents`, `feesCents`, `netCents`, `payoutAt`, `status`. 📜

### 12.6 Risk, compliance, ops

- **RiskFlag** — `id`, `subjectType`, `subjectId`, `flagType`, `severity`, `evidenceJson`, `raisedAt`, `resolvedAt`. 📜
- **ComplianceReview** — `id`, `subjectType`, `subjectId`, `reason`, `status`, `assignedTo`, `outcome`, `outcomeAt`, `reportableMatterRef`. 📜
- **AuditLog** — `id`, `actorType`, `actorId`, `action`, `targetType`, `targetId`, `before`, `after`, `ip`, `userAgent`, `at`, `prevHash`, `hash`. Append-only, hash-chained. Immutable storage (S3 Object Lock + DynamoDB).
- **SupportTicket** — `id`, `userId`, `topic`, `status`, `assignedTo`, `createdAt`, `slaDueAt`. 📜
- **Notification** — `id`, `userId`, `channel`, `template`, `payloadHash`, `status`, `sentAt`. 📜

### 12.7 Integrations

- **APIKey** — `id`, `merchantId`, `prefix`, `hash 🛡`, `scopes[]`, `lastUsedAt`, `revokedAt`. 📜
- **Integration** — `id`, `merchantId`, `type`, `config` (encrypted), `status`. 📜
- **WebhookEndpoint** — `id`, `merchantId`, `url`, `secret 🛡`, `events[]`, `status`. 📜
- **WebhookEvent** — `id`, `endpointId`, `eventType`, `payload`, `attempts`, `nextRetryAt`, `deliveredAt`. 📜

### 12.8 Cross-cutting standards

- All money in **integer cents (BigInt)**. Never floats.
- All timestamps **UTC, ISO 8601, microsecond precision**.
- All FKs enforced; no orphans.
- Soft delete only via `status = 'archived'`, never `DELETE` on regulated rows (retention obligations).
- All **NPI / PII columns encrypted application-side** with KMS-wrapped data keys (envelope encryption); searchable PII (email, phone, EIN, hashed-SSN-last-4) uses deterministic encryption with per-tenant pepper to allow lookup without leaking plaintext. Full SSN held only in tokenisation vault.
- All **audit-required tables** have `created_at`, `updated_at`, `created_by`, `updated_by`. Triggers fire `AuditLog` writes via outbox pattern.

---

## 13. API Specification

### 13.1 Conventions

- REST, JSON, versioned in URL: `/v1/...`. New version when breaking.
- Auth: `Authorization: Bearer <jwt>` (consumer/merchant user) OR `X-Api-Key: <key>` + `X-Signature: <hmac>` (server-to-server).
- Idempotency: `Idempotency-Key` header required on all POST that creates money or applications. 24h TTL.
- Pagination: cursor-based (`?cursor=...&limit=50`), max 100.
- Errors: RFC 7807 Problem Details. Stable `code` field for clients. Never leak internal errors.
- Rate limits: per-key (merchants), per-user (consumers), per-IP fallback. Returned in `X-RateLimit-*` headers.
- All endpoints log to audit with actor + target + before/after hash.

### 13.2 Auth

```
POST /v1/auth/register
  body: { email | phone, password, marketingConsent: bool }
  → 201 { userId, requiresVerification: 'email'|'phone' }
  errors: 409 already_exists, 400 invalid_input

POST /v1/auth/login
  body: { identifier, password, deviceId }
  → 200 { accessToken, refreshToken, mfaRequired: bool }

POST /v1/auth/verify-otp
  body: { challengeId, code }
  → 200 { accessToken, refreshToken }

POST /v1/auth/refresh
  body: { refreshToken, deviceId }
  → 200 { accessToken, refreshToken }   # rotates refresh
```

### 13.3 Consumer

```
GET  /v1/me
PATCH /v1/me
POST /v1/applications
  body: { category, requestedAmountCents, termMonths, purpose, merchantContext? }
  → 201 { applicationId, status: 'draft' }
  Idempotency-Key required.
GET  /v1/applications
GET  /v1/applications/:id
POST /v1/applications/:id/submit
GET  /v1/applications/:id/offers
POST /v1/offers/:id/accept
POST /v1/documents/upload  (presigned URL flow)
GET  /v1/repayments
POST /v1/repayments/:id/payoff-quote
POST /v1/payment-assistance  (UDAAP / CFPB-aligned hardship + SCRA pathways)
```

### 13.4 Merchant

```
POST  /v1/merchants
GET   /v1/merchants/:id
PATCH /v1/merchants/:id
POST  /v1/merchants/:id/application-links
  body: { amountCents?, productId?, customerEmail?, customerPhone?, expiresInMinutes? }
  → 201 { linkId, url, expiresAt }
GET   /v1/merchants/:id/applications
GET   /v1/merchants/:id/transactions
GET   /v1/merchants/:id/settlements
POST  /v1/merchants/:id/api-keys
GET   /v1/merchants/:id/webhooks
POST  /v1/merchants/:id/webhooks
```

### 13.5 Admin (internal)

```
GET  /v1/admin/applications
GET  /v1/admin/applications/:id
POST /v1/admin/applications/:id/review
POST /v1/admin/applications/:id/approve
POST /v1/admin/applications/:id/decline
GET  /v1/admin/risk-flags
GET  /v1/admin/audit-logs
POST /v1/admin/jit-access  # request just-in-time elevation
```

### 13.6 Lender orchestration (server-to-server)

```
POST /v1/orchestration/evaluate
  body: { applicationId }
  → 200 { evaluationId, eligibleProducts[] }
POST /v1/orchestration/route
  body: { applicationId, mode: 'parallel'|'waterfall' }
  → 200 { routeId, decisions[] }
GET  /v1/orchestration/:applicationId/result
```

### 13.7 Webhooks (inbound)

```
POST /v1/webhooks/lenders/:lender   # signature-verified per lender
POST /v1/webhooks/payments/:provider
POST /v1/webhooks/kyc/:provider
POST /v1/webhooks/banking/:provider
POST /v1/webhooks/esign/:provider
```

### 13.8 Webhooks (outbound to merchants)

Events: `application.created`, `application.submitted`, `application.approved`, `application.declined`, `offer.accepted`, `loan.funded`, `repayment.due`, `repayment.paid`, `repayment.failed`, `merchant.settlement.created`, `kyb.status_changed`. HMAC-SHA256 signed with per-endpoint secret. Retry: exponential backoff up to 24h, then dead-letter. Replayable from dashboard.

### 13.9 Per-endpoint requirements

For every endpoint we document: request schema (Zod), response schema, error codes, auth model, RBAC scopes, rate limit class, idempotency, audit fields, PII fields, retention, sandbox parity. Generated into OpenAPI 3.1 from code (NestJS + nestjs-zod + @anatine/zod-openapi). Single source of truth, no hand-written specs.

---

## 14. Lender Orchestration / Waterfall Engine

### 14.1 Inputs

- Normalized application + applicant + bureau + bank data + risk score + merchant context (if any).
- Lender registry (active products, eligibility rules, capacity, current-window approval rate, latency p95).
- Capital constraints (BuzzPay book exposure caps, vintage limits).
- Compliance constraints (responsible lending, target market determinations).

### 14.2 Routing modes

- **Parallel:** dispatch to all eligible lenders supporting parallel quote APIs, aggregate within timeout (5s soft, 8s hard).
- **Waterfall:** sequential, ranked by expected value × approval probability × consumer benefit.
- **Hybrid (default):** parallel within tier, waterfall across tiers.

### 14.3 Tier definitions

1. **Tier 0 — Internal (BuzzPay, by TrueTopia)** — first look if eligible AND risk-adjusted return positive AND book capacity available.
2. **Tier 1 — Prime partners** — strong credit, low APR.
3. **Tier 2 — Near-prime / specialist** — by category (auto, medical, home improvement).
4. **Tier 3 — BNPL / installment** — small ticket, short term.
5. **Tier 4 — Subprime / last resort** — only if explicit consumer consent + responsible lending check passes.
6. **Fallback** — manual review, alternative product, decline with adverse action.

### 14.4 Decision graph (pseudo-code)

```typescript
async function orchestrate(appId: string): Promise<OrchestrationResult> {
  const ctx = await buildContext(appId); // application + bureau + bank + risk

  // Hard knockouts (always)
  const ko = await runKnockouts(ctx);
  if (ko.failed) return decline(appId, ko.reasonCodes);

  // Affordability
  const aff = await affordability(ctx);
  if (!aff.passes) return decline(appId, ['affordability_fail', ...aff.reasons]);

  // Build candidate set
  const candidates = await lenderRegistry.eligibleProducts(ctx);
  if (candidates.length === 0) return manualReview(appId, 'no_eligible_lender');

  // Rank: expected risk-adjusted value to consumer first, then to EazePay
  const ranked = rankCandidates(candidates, ctx, {
    consumerWeight: 0.6, // consumer-best default — UDAAP + ECOA defensibility
    eazepayWeight: 0.4,
  });

  // Tiered hybrid execution
  const offers: Offer[] = [];
  for (const tier of groupByTier(ranked)) {
    const tierResults = await Promise.allSettled(
      tier.map((p) => callLender(p, ctx, { timeoutMs: 5000 })),
    );
    offers.push(...collectApprovals(tierResults));
    if (offers.length >= MIN_OFFERS_TO_PRESENT) break; // usually 3
  }

  if (offers.length === 0) {
    if (anyRetriable(ranked)) return retryLater(appId);
    return decline(appId, aggregateReasons(ranked));
  }

  // Compliance filter: state APR caps, MLA 36% MAPR for covered borrowers,
  // state license/eligibility, partner-bank-permitted-state, prior-decline cooldowns,
  // SCRA flags, prohibited-purpose checks
  const compliant = await filterCompliant(offers, ctx);

  // Present
  return present(appId, compliant.sort(byConsumerBest));
}
```

### 14.5 Lender adapter interface

```typescript
interface LenderAdapter {
  id: LenderProductId;
  isEligible(ctx: ApplicationContext): Promise<EligibilityResult>;
  quote(ctx: ApplicationContext, opts: QuoteOpts): Promise<QuoteResult>;
  bind(offerId: OfferId): Promise<BindResult>; // accept the offer
  fund(loanId: LoanId): Promise<FundResult>;
  status(externalRef: string): Promise<LenderStatus>;
  webhookVerify(req: IncomingRequest): Promise<WebhookEvent>;
}
```

Each external lender + BuzzPay implements the same adapter. Adapter registry is config-driven so adding a lender = ship a new adapter + DB row, not a code change in orchestration.

### 14.6 Operational concerns

- **Lender outage:** circuit breaker per adapter (Hystrix-style). Open after 50% error in 1min window over 20+ calls. Half-open after 30s. Open lender excluded from routing automatically; on-call paged.
- **SLA tracking:** every adapter call timed; p50/p95/p99 per lender per hour. Dashboards in admin.
- **Approval-rate optimization:** continuous A/B of ranking weights with bandit (controlled experiment, not silent ML). Always shadow first; promote with explicit approval.
- **Yield optimization:** never override consumer-best presentation. Influence which lenders we onboard, not which offers we hide.
- **Compliance constraint:** orchestration NEVER hides a cheaper offer for the consumer behind a more profitable one for EazePay. This is hard-coded, monitored, and audited.

---

## 15. Decisioning & Intelligence Layer

### 15.1 Components

1. **Rules engine** — declarative (e.g. `json-rules-engine`, or a custom DSL with versioning). All decision rules versioned in DB; every decision records `policyVersion`. Rule changes go through PR + compliance review + canary.
2. **Affordability model (Ability-to-Repay)** — deterministic calculation: `(net income − fixed commitments − essential expenses − this loan repayment) ≥ buffer`. Inputs from Plaid (cashflow underwriting), with fallback to user-declared + payslip + uploaded bank statements. Output: pass/fail + buffer dollars + sensitivity (what if income drops 10%). DTI computed and stored.
3. **Risk scoring** — gradient boosted model trained on (application features, bureau, bank cashflow features) → probability of default at 12 months. **Explainability mandatory**: SHAP values stored per decision; top-5 contributors surfaced to UW console.
4. **Fraud detection** — ensemble: device fingerprint (Sift/Castle/SEON), velocity rules, link analysis (same device → multiple identities), document tampering detection (provider native + our checks), email/phone risk scores.
5. **Merchant risk score** — chargeback rate, dispute rate, KYB freshness, industry tier, transaction velocity anomalies.
6. **Conversion analytics** — per-step drop-off, time-on-step, error rates. Surfaces where flow is failing.
7. **Approval likelihood** — pre-submit estimator surfaced to consumer to reduce wasted hard pulls.

### 15.2 AI / ML guardrails (mandatory)

- **Human in the loop** for any decline based on a model output until model is post-deployment validated for ≥ 12 months AND covered by a formal model risk policy.
- **Adverse action reasons** are model-aware: every decline has at least 2 specific reasons mapped to consumer-readable statements. Model contributors must map to a regulator-acceptable taxonomy (we maintain this mapping).
- **No protected-attribute features.** No proxies allowed without statistical bias testing (disparate impact, equalised odds) on protected attributes (age, gender, postcode-as-race-proxy). Quarterly bias review by compliance.
- **No black-box decisions.** A decision must be reproducible from the stored input snapshot + policy version.
- **Model registry** — every model version has owner, training data ref, validation results, shadow period, rollout %, kill switch.
- **AI assistants** (operations copilot, merchant insights, support, compliance review) can summarize and suggest but cannot mutate financial state. Every AI suggestion is a draft for a human action.

---

## 16. Security, Compliance & Risk

### 16.1 Federal lending & consumer-finance obligations

- **Lending model** — choose ONE explicitly: (a) bank-partner / true-lender model with a chartered partner bank (Cross River, WebBank, FinWise, Celtic Bank, Lead Bank), or (b) state-by-state consumer lending / installment / sales-finance licences (NMLS-registered). Document the choice in a board-approved policy. Build the platform so the "true lender" attribute on `Loan` is structural, not cosmetic — the lender of record owns the credit decision in form and substance.
- **TILA / Regulation Z** — APR computed and disclosed with the federally-prescribed methodology; pre-contract disclosures + final disclosures + payment schedule + right of rescission for closed-end loans secured by principal dwelling (likely N/A for unsecured personal loans but the engine handles it). Schumer-box-style summary for any open-end or credit-card-like product. Advertising rules (triggering terms) enforced at marketing surface.
- **ECOA / Regulation B** — non-discrimination across protected classes; **specific** Adverse Action Notice within 30 days of decision (notice of incompleteness within 30 days; counter-offers tracked); spousal/joint applicant handling; appraisal/valuation rules where applicable; data retention 25 months for declined apps (12 months for businesses where applicable). Reason-code library is mapped to Reg B examples, never generic.
- **FCRA / FACTA** — permissible purpose recorded before any pull; user-initiated soft pulls explicitly consented; hard pulls only at offer-accept or per documented policy; **risk-based pricing notice** (Reg V) or credit score disclosure exception notice as appropriate; Adverse Action Notice when consumer report is a factor; furnisher accuracy + dispute handling (FCRA §623) for any data we report to bureaus; identity-theft red flags + Identity Theft Prevention Program; address-discrepancy procedures.
- **GLBA + Safeguards Rule (FTC, updated 2023)** — written information security program (WISP), CISO appointed, risk assessment, encryption of NPI in transit and at rest, MFA, access controls, secure development, vendor oversight, IR plan, board reporting, annual penetration test + biannual vulnerability assessment, log monitoring, training. Privacy Notice (initial + annual) with opt-out for data sharing where applicable.
- **EFTA / Regulation E** — for ACH debits + repayments + any prepaid functionality: written authorisation for recurring debits (Nacha + Reg E), error-resolution procedures (60-day window), unauthorised transaction liability framework, consumer disclosures.
- **UDAAP (Dodd-Frank §1031, 1036)** — every consumer-facing surface, marketing claim, disclosure, and dark-pattern review filtered through UDAAP. CFPB has supervisory + enforcement reach over EazePay if we hit "larger participant" status or via service-provider authority over our bank partner.
- **Military Lending Act (MLA)** — covered borrower check at application (DoD MLA database) for any closed-end consumer credit; 36% MAPR cap + prohibited terms enforced at orchestration filter.
- **Servicemembers Civil Relief Act (SCRA)** — servicing-side obligations: 6% rate cap on pre-service obligations, foreclosure/eviction protections, default judgment protections.
- **CFPB complaint handling** — public-facing complaint channels, CFPB Consumer Complaint Database response workflow (15-day initial, 60-day final), complaint metrics tracked.
- **State usury + licensing** — under bank-partner model, partner bank's home-state usury applies (subject to current True Lender / Madden risk). Under direct model, per-state APR caps + licensure (NMLS) required. Maintain a **state-rules matrix** in the rules engine; orchestration filters offers per applicant state.

### 16.2 BSA / AML / Sanctions

- **BSA / FinCEN registration** — consumer lending alone is not a "financial institution" under BSA in the same way as money transmitters, but if EazePay touches money movement, holds funds, issues a prepaid product, or operates as MSB-adjacent we register as MSB and align with FinCEN expectations. Clarify scope with counsel before launch (open question in §22). Bank-partner model typically inherits the bank's BSA program but EazePay still needs a service-provider AML program.
- **AML Program** — written, board-approved: designated BSA/AML Officer, risk assessment, CIP, ongoing monitoring, **SAR** filing workflow (30-day rule from detection), CTR if MSB scope ever applies, independent testing annually, training. SARs are filed via FinCEN's BSA E-Filing.
- **CIP / KYC** — IDV via Alloy / Persona / Socure / Jumio with liveness; SSN verification; OFAC screen; PEP screen via WorldCheck/ComplyAdvantage/LexisNexis; CIP record retained ≥5 years post-account-closure.
- **OFAC** — SDN + Consolidated Sanctions screen at onboarding + on every roster change + scheduled rescreen (daily for high-risk, weekly otherwise). 314(a) and 314(b) workflows. Blocked-property freeze procedure documented.
- **CTA / FinCEN Beneficial Ownership** — for merchant entities, collect BOI per the post-2024 FinCEN BOI rule and our CIP. Beneficial owners ≥25% + control person.
- **Travel Rule** — N/A unless we enter funds-transfer scope; flag and reassess at V2.

### 16.3 Privacy

- **GLBA Privacy Rule** — initial Privacy Notice at relationship start; annual notice (or annual-notice exception if conditions met); opt-out for data sharing with non-affiliated third parties for marketing.
- **State privacy laws** — CCPA/CPRA (CA), CDPA (VA), CPA (CO), CTDPA (CT), UCPA (UT), and the rapidly growing list (TX, OR, MT, IA, DE, IN, TN, NJ, NH, KY, MN, MD, RI). Build a **single rights-management platform** (right-to-know, right-to-delete, right-to-correct, right-to-portability, opt-out of sale/sharing/targeted ads, sensitive PI controls) that satisfies the strictest state. Honor Global Privacy Control (GPC) signal where required. Track applicability per resident state.
- **Children's privacy** — block <18 at sign-up; no COPPA scope intended.
- **Health data** — if we ever finance medical procedures and ingest medical data, HIPAA may apply to our merchant-side handling; current scope assumes we receive only the _amount and category_, not protected health information. Contractually prohibit merchants from sending PHI.
- **Data residency** — US regions only (`us-east-1` primary, `us-west-2` DR). SCP-enforced. Cross-border processor use requires DPA + assessment.
- **Breach notification** — patchwork of 50 state laws + GLBA + FTC Health Breach Notification Rule (if in scope). Maintain breach-response matrix that maps incident type → notice obligations + timelines per state. Notify state AGs / regulators per statute.

### 16.4 PCI & money handling

- **PCI DSS** — tokenizing PSP path (Stripe / Adyen / Finix) so PAN never touches our systems → **SAQ A**. iframes / hosted fields only. Never log card data; never store CVV; never accept raw PAN over our APIs.
- **ACH (Nacha)** — Originator obligations: Nacha Operating Rules compliance, WEB debit account validation (commercial reasonable methods, e.g. Plaid Auth, micro-deposits, Nacha-validated DB), return rate monitoring (Unauthorized ≤0.5%, Administrative ≤3%, Overall ≤15%), authorization retention. Use an ODFI partner (the bank partner or Modern Treasury / Column / Increase / Stripe Treasury).
- **Card payments for repayments** — debit card preferred (Reg E coverage); credit card disallowed for loan repayments (CFPB stance).
- **RTP / FedNow** — V1 capability for instant disbursement to merchants. Wire fallback for high-value.
- **Money handling segregation** — funding accounts, operating accounts, and reserves segregated. For-benefit-of (FBO) account architecture if we hold consumer funds (likely N/A at MVP; revisit at wallet/V2).

### 16.5 SOC 2 + bank-partner readiness from day one

- SOC 2 Type I within 9 months, Type II within 18 (bank partners will require this). Map controls to AICPA TSC. Vanta or Drata for evidence collection.
- **Bank-partner oversight** — partner banks (Cross River et al) impose their own program: written policies, risk and compliance committee, MRM (model risk), complaints, marketing review, change management, audit rights, MIS reporting cadence (often monthly), exam cooperation. Build the **bank-partner reporting pack** as a first-class artifact.
- **Model Risk (SR 11-7 / OCC 2011-12)** — partner banks expect SR 11-7-aligned MRM for any model that influences credit, fraud, or pricing. Inventory, validation, ongoing monitoring, independent review. (See §15.2.)
- **NYDFS Part 500** — if we operate in or with NY consumers/partners, the NYDFS cybersecurity regulation applies to us as a covered entity or service provider. CISO certification, incident reporting (72 hours), MFA, encryption, access reviews.

### 16.3 Card & money

- **PCI DSS** — we will use a tokenizing PSP (Stripe/Adyen) with iframe/redirect collection so PAN never touches our systems. Target SAQ A. Never log card data. Never store CVV.
- **Money handling** — settlement bank accounts segregated. Reconciliation daily. Trust account treatment if/when applicable.

### 16.4 SOC 2 readiness from day one

Type I within 12 months, Type II within 24. Controls library mapped to AICPA TSC. Evidence collection automated where possible (Vanta/Drata) — evaluate at MVP+3 months.

### 16.5 Encryption & key management

- **In transit** — TLS 1.3, mTLS for service-to-service in VPC, Cloudfront-managed certs at edge.
- **At rest** — AES-256-GCM, envelope via AWS KMS CMKs. Per-tenant data keys for largest customers (V1).
- **Field-level** — Postgres `pgcrypto` for non-searchable PII; deterministic AES-SIV via app-layer for searchable PII.
- **Documents** — S3 SSE-KMS + Object Lock for retention; signed URLs (≤15min) for access.
- **Secrets** — Secrets Manager + automatic rotation; no secret in env files in prod.
- **Tokenisation** — PII tokenisation vault for analytics (Skyflow-style or self-hosted) — V1.

### 16.6 Identity & access

- **Workforce** — SSO (Okta/Google), MFA everywhere, hardware keys for admin roles, just-in-time elevation for prod data access (every prod read of customer PII has a ticket reason + time-boxed).
- **Customer auth** — OAuth2 + OIDC via Cognito; passwords with Argon2id; MFA via TOTP + SMS (SMS only as fallback); WebAuthn V1; biometrics on mobile.
- **Service-to-service** — IAM roles + STS, no long-lived keys. mTLS within mesh.
- **RBAC + ABAC** — roles map to coarse permissions; attribute checks (e.g. merchant scope) enforced server-side every request.
- **Session security** — refresh rotation, device binding, anomaly detection (impossible travel, new device step-up).

### 16.7 Application security

- Threat modelling per service (STRIDE) before merge.
- SAST (Semgrep), DAST (OWASP ZAP), dependency (Snyk/Dependabot), container (Trivy), IaC (tfsec/checkov), secret scanning (Gitleaks). All in CI; blocking on high.
- Penetration testing pre-launch then annually + after material change. CVD program live at launch.
- Secure SDLC: PR template includes security checklist; security champion per service.

### 16.8 Incident response

- 24/7 on-call rotation. Severity matrix (SEV1-SEV4) with response SLAs.
- Runbooks per critical service.
- Forensics: CloudTrail in audit account (write-once), VPC Flow Logs, GuardDuty + Security Hub.
- Breach response: legal + comms + regulator playbooks. **NYDFS 72-hour notification**, **state breach laws** (50 distinct timelines + AG notice rules), **GLBA Safeguards** notification (FTC, 30-day rule for breaches involving ≥500 consumers), bank-partner notification per service agreement (often within hours). Maintain a per-state notification matrix.
- Tabletop exercises quarterly.

### 16.9 Vendor / third-party risk

- Vendor questionnaire + SOC 2 Type II / ISO 27001 evidence + DPA + data flow mapping for every vendor handling NPI or money. Annual review. **Interagency Guidance on Third-Party Relationships (June 2023)** is the bar for bank-partner-facing vendor management.
- Lender / partner due diligence: licensing (state NMLS or charter), CFPB enforcement history, complaints history, financial soundness, BSA/AML program, dispute mechanism, security posture.

### 16.10 US fintech security & compliance checklist (concise)

- [ ] Lending model decided (bank-partner vs state-licensed) + board-approved policy
- [ ] Bank-partner agreement signed with full Interagency-Guidance-aligned program (or NMLS state licences in scope states)
- [ ] BSA/AML Program written, board-approved; BSA Officer designated; SAR workflow live
- [ ] OFAC + PEP screening at onboarding + scheduled rescreen
- [ ] CIP/KYC live (Alloy/Persona/Socure) with provider failover
- [ ] FinCEN BOI collection for merchant entities
- [ ] TILA/Reg Z disclosures live and APR-engine-tested
- [ ] ECOA/Reg B Adverse Action Notice generation + reason taxonomy + 30-day timer
- [ ] FCRA permissible-purpose enforcement, risk-based pricing notice / score-disclosure exception, IT Red Flags Program
- [ ] MLA covered-borrower check + 36% MAPR cap enforcement
- [ ] SCRA servicing handlers (rate cap, default protections)
- [ ] CFPB complaint workflow + 15/60-day SLAs
- [ ] State-rules matrix in rules engine (APR caps, license-requirement gating, prohibited products)
- [ ] GLBA Privacy Notice (initial + annual), Safeguards Rule WISP signed by CISO
- [ ] State privacy rights portal (CCPA/CPRA + multi-state) with GPC honor
- [ ] Breach notification matrix (50 states + GLBA + NYDFS + bank-partner)
- [ ] PCI SAQ A path (tokenizing PSP, no PAN touch)
- [ ] Nacha Originator program: WEB debit validation, return-rate monitoring, authorisation retention
- [ ] All NPI columns encrypted; AWS KMS with rotation
- [ ] WAF + rate limit + bot mitigation on public surfaces
- [ ] mTLS internal; TLS 1.3 external
- [ ] SSO + MFA + hardware keys for admin + JIT prod access
- [ ] CloudTrail to write-once audit account; centralised log pipeline with NPI scrubbing
- [ ] Append-only audit log, hash-chained, retention per record class (FCRA 25-mo declined apps, BSA 5-yr CIP, etc.)
- [ ] Backups encrypted, tested restore quarterly, cross-region copy (US only)
- [ ] DR runbook tested; RTO ≤4h, RPO ≤15min for critical
- [ ] Pen test pre-launch + annually; vulnerability assessment biannually (Safeguards Rule)
- [ ] CVD / responsible disclosure program public
- [ ] Threat model per service; SAST/DAST/SCA/IaC scans blocking in CI
- [ ] Incident response plan + tabletop quarterly + 72-hour NYDFS notice path
- [ ] Vendor risk register with annual reviews (Interagency-Guidance-aligned)
- [ ] SR 11-7-aligned model risk management for credit/fraud/pricing models
- [ ] Bias testing (disparate impact, equalised odds) on decisioning models quarterly + ECOA fair-lending review
- [ ] Adverse action reasons reproducible to policy version + input snapshot
- [ ] SOC 2 Type I within 9 months; Type II within 18

---

## 17. Data Architecture

### 17.1 Topology

```
OLTP (Aurora PG)
  → CDC via DMS / Debezium → S3 (raw)
  → dbt models in BigQuery / Snowflake (warehouse, AU region)
  → Looker / Mode / Metabase (analytics)
  → Reverse ETL (Hightouch) for back-office surfaces

Events (EventBridge)
  → Kinesis Firehose → S3 (events raw, partitioned by date+type)
  → warehouse via dbt
  → product analytics (Amplitude / Mixpanel) — PII-safe payloads only

Audit log
  → DynamoDB (hot 90d) + S3 Object Lock (cold, 7y retention)
```

### 17.2 Data domains

- **Operational** (PG): real-time, transactional, source of truth.
- **Audit** (DynamoDB + S3): append-only, hash-chained, immutable.
- **Analytics warehouse**: dimensionally modelled, daily/streaming load, ML feature store (V1).
- **Document lake** (S3): originals, encrypted, retention-tagged.
- **Reporting layer**: pre-aggregated marts for merchant/lender/internal dashboards.

### 17.3 Event taxonomy (initial)

```
user.registered
user.kyc.started, user.kyc.completed, user.kyc.failed
user.profile.updated
merchant.onboarded
merchant.kyb.completed
application.started, application.submitted, application.cancelled
application.lender.evaluation.started, .completed
application.lender.approved, .declined
application.offer.viewed, .compared, .accepted, .expired
application.contract.signed
application.funding.initiated, .completed, .failed
loan.repayment.due, .paid, .failed, .late
loan.hardship.requested, .granted
merchant.application_link.created
merchant.settlement.created, .paid
webhook.outbound.sent, .delivered, .failed
support.ticket.created, .resolved
risk.flag.raised, .resolved
compliance.review.opened, .closed
```

Every event includes: `eventId`, `eventType`, `eventVersion`, `occurredAt`, `actor`, `subject`, `payload (PII-redacted)`, `correlationId`, `causationId`.

### 17.4 PII in analytics

Either tokenise at the boundary (preferred) or strict allow-list of de-identified fields into the warehouse. No raw PII in BI tools. Joins back to PII only via vault lookups with logged access.

---

## 18. Infrastructure & DevOps

### 18.1 Environments

| Env     | Purpose                         | Data                                   | Auth               |
| ------- | ------------------------------- | -------------------------------------- | ------------------ |
| local   | Dev laptops                     | Synthetic                              | Local Cognito mock |
| dev     | Shared dev                      | Synthetic                              | Cognito dev pool   |
| staging | Pre-prod, prod-like             | Synthetic + sanitised prod-like volume | Cognito staging    |
| sandbox | Public dev sandbox for partners | Synthetic                              | Sandbox keys       |
| prod    | Live                            | Real                                   | Prod Cognito       |

### 18.2 IaC

Terraform (preferred over CDK for hireability + tooling maturity). Modules per concern. Remote state in S3 + DynamoDB lock per env, with KMS encryption. PR-driven plan, manual-approved apply (Atlantis).

### 18.3 CI/CD

GitHub Actions with OIDC to AWS — no long-lived deployment keys. Pipeline:

```
PR opened
  → lint + typecheck + unit + affected-build
  → security: SAST, secrets, deps
  → preview deploy (ephemeral env per PR for FE; per-feature flag for BE)
  → e2e smoke
PR merged → main
  → build images + sign (cosign)
  → push to ECR
  → deploy staging (blue/green via ECS, automated)
  → e2e full + load test smoke
  → manual gate
  → deploy prod canary 5% → 25% → 100% with auto-rollback on SLO breach
```

### 18.4 Release strategy

- Backend: trunk-based, deploy multiple times per day, feature-flagged, canary.
- Mobile: weekly release train. EAS Build (Expo) or Fastlane. Phased rollout (1% → 10% → 100%) on both stores. Forced upgrade path for security fixes via remote config.
- Web: continuous on merge.

### 18.5 Monitoring & alerting

SLOs per critical journey. Burn-rate alerts. PagerDuty rotation. Status page (Statuspage.io). Synthetics on top 5 journeys every 5 min from 2 regions. Real-user monitoring on web + mobile (Datadog RUM or Sentry Performance).

### 18.6 Backups & DR

Aurora automated backups + cross-region snapshot copy. RPO 15 min, RTO 4 h for critical. Quarterly restore drill (recorded). DR plan documented per service. Multi-AZ for everything stateful.

### 18.7 Cost guardrails

Tag every resource (`env`, `service`, `owner`, `costCenter`). Monthly cost review per service owner. Anomaly detection alerts. Right-sizing review quarterly.

---

## 19. Testing Strategy

### 19.1 Pyramid

- **Unit** (Vitest/Jest, RN: Jest + React Native Testing Library): ≥80% on services, ≥70% on UI. Fast, parallel.
- **Integration:** services + real Postgres (Testcontainers) + mocked third-parties. Catch contract bugs.
- **Contract** (Pact): every external integration (lender, KYC, payment) has a contract test.
- **E2E mobile:** Detox on iOS + Android emulators in CI. Top 8 journeys.
- **E2E web:** Playwright. Top 12 journeys per app.
- **API E2E:** dredd/schemathesis against OpenAPI in CI.
- **Load:** k6 against staging for top endpoints + orchestration. Targets: 1k applications/min sustained, 100k concurrent dashboard users.
- **Security:** SAST, DAST (ZAP) in CI, manual pen test annually, ad hoc on material change.
- **Accessibility:** axe-core in component tests + manual VoiceOver/TalkBack pass per release.
- **Compliance test cases:** golden-path test files covering: soft-pull consent flow, FCRA/ECOA Adverse Action generation (timing + content), TILA disclosure rendering, MLA covered-borrower gating, SCRA flag handling, state APR cap enforcement, payment-assistance flow, CFPB complaint reference shown, KYC failure handling.
- **Lender sandbox:** every lender adapter has sandbox tests covering eligible/ineligible/approve/decline/timeout/error and webhook verification.
- **Regression:** visual regression on design system (Chromatic).

### 19.2 UAT

Two-week UAT before any new lender goes live. UAT sign-off required from: Product, Risk, Compliance, Engineering. UAT environment uses synthetic but realistic data. UAT script library maintained.

---

## 20. MVP / V1 / V2 Roadmap

### 20.1 MVP (Months 0–6) — "Loan in the box"

**Goal:** end-to-end loan, one merchant beta, one external lender + BuzzPay, single category.

- Consumer mobile app (RN, iOS + Android)
  - Sign up, KYC, profile
  - Single category application (e.g. retail goods)
  - Affordability + soft pull
  - Offers (BuzzPay + 1 external)
  - Accept + e-sign + funding
  - Repayment dashboard + push reminders
  - Payment-assistance flow, FCRA/ECOA Adverse Action notices, CFPB complaint refs
- Consumer web (Next.js) — application link flow only
- Merchant dashboard (Next.js)
  - Onboarding, KYB, contract
  - Generate application links
  - Applications + settlements list
- Admin console
  - Application queue, UW workspace, manual approve/decline, audit log viewer
- Backend (NestJS modular monolith)
  - Auth, user, merchant, application, orchestration (basic waterfall), decision (rules engine), BuzzPay adapter, 1 external lender adapter, payment (disbursement + repayment), notification, document, compliance (KYC/KYB orchestration + sanctions), risk (basic), audit, webhook
- Integrations: **Alloy** (KYC/KYB orchestration) → Persona/Socure/Jumio (IDV), **Plaid** (bank data, Auth, Identity, Income), **Experian / Equifax / TransUnion** (bureau — soft + hard pulls + Risk-Based Pricing notice data), **Stripe** (debit card on file for repayments via SAQ A) + **Modern Treasury** or **Column** (ACH origination + RTP/FedNow) — final pick depends on bank-partner choice, **DocuSign** or **Dropbox Sign** (E-SIGN/UETA-compliant e-sign), **Twilio** (SMS + 10DLC registration), **SES / SendGrid** (email), **APNs/FCM** (push), **ComplyAdvantage** or **LexisNexis Bridger** (sanctions/PEP), **DoD MLA** API (covered-borrower check)
- Infra: Terraform, AWS `us-east-1` + `us-west-2` DR, Aurora PG, ECS Fargate, Cognito, KMS, WAF, CloudTrail, GuardDuty
- Compliance: bank-partner agreement OR initial state licences via NMLS, written AML Program + BSA Officer, GLBA WISP signed by CISO, Privacy Notice + state-rights portal, Reg B/Z/E + FCRA workflows live, MLA + SCRA gates live, CFPB complaint channel
- Observability: Datadog, OpenTelemetry, status page
- CI/CD with canary, IaC, secret scanning, dep scanning, SAST

### 20.2 V1 (Months 6–12) — "Real product"

- Full mobile app polish + WebAuthn + biometrics V2 + offline mode for repayment screens
- Production merchant dashboard (analytics, team management, branding, API keys, webhooks)
- 3–5 lender integrations across tiers
- Parallel orchestration + circuit breakers + capacity-aware routing
- Bureau hard pull at offer-accept + advanced cashflow underwriting via Plaid (and optionally MX/Finicity for redundancy)
- Repayment automation (direct debit, default flow, hardship)
- Advanced analytics (consumer, merchant, lender performance)
- AI assistants: ops copilot, merchant insights (read-only), support draft
- Public API + webhooks GA + developer portal + sandbox + SDKs (TS, Python, PHP)
- Improved decisioning: model V1 with explainability, shadow-then-promote, ECOA fair-lending bias testing
- SOC 2 Type I + bank-partner audit pack

### 20.3 V2 (Months 12–24) — "Platform"

- Drop-in checkout widget GA + iframe SDK
- Lender marketplace (self-onboarding for partners with our review)
- Wallet / payments features (BNPL self-issued, virtual card V1)
- Embedded merchant financing (white-label)
- Geographic expansion: add states under direct-licensing model where bank-partner economics fail; evaluate CA DFPI, NY DFS-licensed lender, TX OCCC carefully
- Decisioning v2 (real-time features, on-device fraud signals)
- Capital markets module: securitisation reporting (Reg AB II if applicable), vintage cuts, ABS-ready loan tape
- SOC 2 Type II + ISO 27001 + NIST CSF mapping
- Developer platform: connect-style flows, partner marketplace

---

## 21. Claude Code Build Plan

Tasks below are **atomic, ordered, and Claude-Code executable**. Each task name is a directive — Claude Code can execute them sequentially or in parallel where dependencies allow.

### Phase A — Foundations (Week 1–2)

1. **Init `eazepay/infra` repo.** Terraform skeleton, AWS Organizations, accounts (`dev`, `staging`, `prod`, `audit`, `security`, `shared-services`), OIDC GitHub federation, baseline guardrails (Config, GuardDuty, CloudTrail to audit account).
2. **Init `eazepay/platform` Nx monorepo.** pnpm, TypeScript strict, ESLint, Prettier, commitlint, Husky, conventional commits, GitHub Actions CI skeleton.
3. **Init `eazepay/design-system`.** Style Dictionary, Storybook, RN + React component packages, GitHub Packages publish.
4. **Networking + base services in `infra`.** VPCs (3 AZ) per env, Aurora PG cluster, ElastiCache, ECR, ECS cluster, ALB, API Gateway, Cognito user pool, KMS CMKs, S3 buckets per data class, SES domain, Secrets Manager.
5. **Observability baseline.** Datadog or OTel collector, log pipeline with PII scrubber, dashboards skeletons, status page.

### Phase B — Backend skeleton (Week 2–4)

6. **Scaffold `apps/api` NestJS app.** Health, auth stub, OpenAPI generator, Zod everywhere, Pino logging, OpenTelemetry, Postgres connection via Prisma or TypeORM (recommend **Prisma** for DX).
7. **Scaffold internal modules** under `services/` matching §10.4: empty modules with typed interfaces and DI registration.
8. **Database schema v0.** Prisma schema covering §12 entities. Migrations checked in. Seed scripts for synthetic data.
9. **Audit log service.** Outbox pattern → DynamoDB stream → S3 Object Lock writer. Hash-chain implementation. Query API.
10. **Auth module.** Registration, login, OTP via Twilio + SES, refresh rotation, device binding, MFA (TOTP). Cognito integration.
11. **User + ConsumerProfile module.** PII vault pattern, KMS envelope encryption helper, CRUD with audit.
12. **Merchant + KYB module.** EIN / IRS TIN match, Secretary of State good-standing adapters, FinCEN BOI-aligned beneficial owner sub-resource, prohibited-MCC blocklist.
13. **Document service.** Presigned upload, virus scan (ClamAV via Lambda), OCR via Textract, retention tagging.
14. **Notification service.** Push (APNs/FCM), email (SES), SMS (Twilio + 10DLC registration), in-app. Templating + i18n stub (en-US first; es-US V1 — Spanish-language ECOA/Reg B copy maintained).

### Phase C — Application & orchestration (Week 4–8)

15. **Application module + state machine.** XState-based machine: draft → submitted → underwriting → offers_presented → accepted → contracted → funding → active. Strict transitions, audit on each.
16. **Lender adapter framework.** Interface from §14.5, registry, circuit breaker (opossum), shared HTTP client with mTLS support, sandbox/prod URL switch, signature verification helpers.
17. **BuzzPay adapter.** First implementation against BuzzPay sandbox API (mock with Mockoon/MSW with realistic latency until live). Wire the bank-partner-of-record metadata into every approved Loan record.
18. **One external lender adapter.** Pick a US partner with a sandbox (e.g. Upgrade, Upstart, LendingPoint, Affirm Pay-in-N, Sezzle, Klarna — depends on V1 partner choice).
19. **Decisioning module.** json-rules-engine wrapper, policy versioning, affordability calculator, knockouts, reason-code taxonomy, decision result writer.
20. **Risk module v0.** Velocity rules, device fingerprint stub (Sift or Castle integration), email/phone risk score (Emailage / Telesign).
21. **KYC integration.** Alloy orchestration adapter wrapping Persona/Socure/Jumio + ComplyAdvantage (sanctions/PEP) + DoD MLA covered-borrower API. Webhook receiver. Status sync to ConsumerProfile.
22. **Bureau integration.** Experian/Equifax/TransUnion adapter (start with one, pick based on partner-bank preference). Soft-pull at offer-presentation, hard-pull only at offer-accept with separated FCRA consent. Risk-Based Pricing notice generator wired in.
23. **Bank data integration.** Plaid adapter — Auth (account verification for ACH), Identity (KYC reinforcement), Income, Assets, Transactions. Consent flow + token storage + transaction normalization. Plaid Signal optional for fraud signal.
24. **Orchestration engine.** Implement §14.4 pseudo-code. Hybrid mode default. Tier groups configurable.
25. **Offer module.** Generation, ranking, expiry, accept flow with e-sign integration.
26. **Payment module.** Stripe (debit card on file via tokenisation, SAQ A path) for repayments; ACH origination via Modern Treasury / Column / Increase or directly through partner bank for both repayment debits (Reg E + Nacha-compliant authorisation flow, return-rate monitoring) and disbursements. RTP / FedNow path for instant disbursement at V1. Wire fallback for high-value.
27. **Webhook outbound service.** HMAC signing, retry with backoff + DLQ, replay UI in admin.

### Phase D — Mobile app (Week 6–12, parallel with C)

28. **Init `apps/consumer-mobile`** RN + TS + Expo bare. Native bridges: Keychain/KeyStore, secure refresh-token storage, biometrics, App Attest / Play Integrity, deep link handling for application links.
29. **Auth + onboarding screens.** Sign up, OTP, profile, biometric enrol. Wired to API.
30. **KYC flow.** ID capture, liveness, SSN entry, processing, success/fail/manual-review states. Persona / Socure / Jumio SDK behind Alloy orchestration.
31. **Application flow.** Category select, amount, purpose, income, employment, expenses, bank connect, soft-pull consent, review, submit.
32. **Offers + accept flow.** Loading, list, comparison, detail, e-sign, funding status.
33. **Repayment dashboard + hardship flow.**
34. **Notifications, profile, support, legal hub, decline screen.**
35. **Accessibility pass + dark mode + dynamic type.**
36. **Detox E2E for top 8 journeys.**

### Phase E — Web surfaces (Week 8–14)

37. **Application link hosted flow** (`apps/consumer-web`). Same component library as mobile (RN-Web where feasible) or web-native React. Mobile-first, optimised for cold-start <1s on 4G.
38. **Merchant dashboard.** Onboarding flow, KYB status, link generator, applications list/detail, settlements, API keys, webhooks, team.
39. **Admin console.** Application queue, UW workspace, audit log viewer, lender perf dashboard, configuration.
40. **Developer portal** (Mintlify). API docs auto-generated from OpenAPI, sandbox keys.

### Phase F — Compliance & launch hardening (Week 12–18)

41. **AML Program artefacts.** Written AML Program board-approved, BSA Officer designated, SAR workflow + FinCEN E-Filing path, integrated checks (OFAC, PEP, sanctions, MLA, SCRA queue UI).
42. **CFPB complaint workflow + state-rights portal.** UI + workflow + 15/60-day SLA tracking; CCPA/CPRA + multi-state DSAR portal with GPC honoring.
43. **Disclosure machinery.** TILA / Reg Z box generator (pre-contract + final), ECOA Adverse Action Notice generator with reason taxonomy, FCRA Risk-Based Pricing / Score Disclosure exception, GLBA Privacy Notice (initial + annual) — all template-versioned and testable.
44. **Privacy artefacts.** Privacy Notice (GLBA), state privacy notices, Safeguards Rule WISP signed by CISO, data subject rights workflow (know / delete / correct / portability / opt-out), retention enforcement jobs (FCRA 25-mo, BSA 5-yr).
45. **Pen test (external)** — Safeguards-Rule-aligned. Fix high/critical before launch. Lock biannual vulnerability assessment cadence.
46. **Load test to MVP target** (100 apps/min sustained).
47. **DR drill.** Restore Aurora from snapshot in `us-west-2`; document RTO/RPO actuals.
48. **Bug bounty / CVD program** live (HackerOne or Bugcrowd).
49. **Bank-partner go-live audit.** Deliver bank-partner audit pack (policies, SOC 2, MIS reports, model docs, complaint metrics). Pass partner pre-launch review.
50. **Soft launch with one beta merchant + 100 consumer waitlist** (start in 1–3 states permitted under partner-bank export footprint to limit blast radius).

### Phase G — Iterate to V1

51. Add lenders, parallel orchestration, hard pull at accept, repayment automation, public API GA, SDKs, SOC 2 Type I, expanded state coverage.

---

## 22. Open Questions

These need explicit decisions before or during MVP build. Each has an owner and a deadline target.

1. **Lending model.** Bank-partner (Cross River / WebBank / FinWise / Celtic / Lead) vs state-by-state licensing (NMLS) vs hybrid. (Owner: Founder + outside fintech counsel. Deadline: pre-MVP. Single biggest gating decision.)
2. **BuzzPay (TrueTopia) structure.** Bank-partner-issued + EazePay/TrueTopia purchases receivables, or direct-licensed lender, or marketplace-style funding. Funding source: warehouse facility, whole-loan sales to PE investor, or balance-sheet from PE capital — and at what advance rate. Clarify legal entity: does TrueTopia issue under EazePay, alongside, or as a wholly-owned sub.
3. **Lender partner #1 (external).** Upgrade, Upstart, LendingPoint, Affirm/Klarna/Sezzle (BNPL), or vertical specialist (auto, medical, home improvement). Drives whether parallel quote APIs exist for MVP.
4. **Bank data provider.** Plaid is default; Finicity/MX as backup. Do we need both for redundancy at MVP?
5. **ACH origination path.** Direct via partner bank vs Modern Treasury vs Column vs Increase vs Stripe Treasury. Affects cost, latency, and engineering complexity.
6. **Mobile framework final call.** RN confirmed, but native modules required for biometrics + secure enclave + App Attest / Play Integrity — confirm iOS/Android engineers or contractors lined up.
7. **Decisioning model V0.** Heuristic rules only at MVP, or shadow ML from day one? Either way, ECOA fair-lending review of variables before any model trains.
8. **Insurance.** Cyber, E&O, D&O, fidelity bond, lender liability. Broker engaged.
9. **MSB / FinCEN scope.** Does our fund-flow architecture pull us into MSB territory (especially if we hold consumer funds, settle for merchants, or issue prepaid/wallet)? Decide MVP fund-flow before scope is forced on us.
10. **AI provider data path.** AWS Bedrock (Anthropic Claude / Titan, all in-region) vs OpenAI / Anthropic direct with DPA + zero-retention. NPI must never train external models.
11. **SOC 2 / compliance automation vendor** — Vanta vs Drata vs Secureframe vs in-house. Bank partner due-diligence will ask for this in month 1.
12. **State coverage at launch.** Which states are in scope for MVP under the chosen lending model? Each state opens regulatory surface (state AG, state DFI exam authority).
13. **Settlement latency target** for merchants — instant via RTP/FedNow, same-day ACH, or T+1 — drives bank-partner choice and reserve requirements.
14. **Hard-pull timing UX.** Single-step at accept (cleaner, lower funnel cost) vs separated screen (safer for FCRA defensibility). Default to separated.
15. **Brand / lender-of-record presentation.** "Loan made by [Partner Bank], serviced by EazePay" must appear on offer + agreement. How prominent on offer card without crushing conversion?
16. **NYDFS Part 500** — will we serve NY consumers at MVP? If yes, CISO certification + 72-hour notice path live by launch.
17. **Marijuana-related and high-risk merchant policy.** Default deny at MVP; revisit V1 with explicit MRB program if commercially material.

---

## 23. Immediate Next Actions

In execution order. Targets the next 2 weeks.

1. **Engage US fintech counsel** (Mayer Brown / Manatt / Sidley / Goodwin / Cooley fintech practice) to lock the lending model: bank-partner introductions + term sheets, OR NMLS state-licensing roadmap. Block on this before any production data is touched.
2. **Open conversations with 2–3 partner banks** in parallel (e.g. Cross River, Lead Bank, FinWise) given 6–12 month onboarding timelines.
3. **Spin up `eazepay/infra` and `eazepay/platform` repos** under a new `eazepay` GitHub organisation. Configure branch protection, codeowners, OIDC.
4. **Stand up AWS Organizations** with the 6 accounts in §10.5 (`us-east-1` primary, `us-west-2` DR). Enable Control Tower baseline + SCP banning non-US regions.
5. **Approve domain model** in §12 — pay particular attention to lender-of-record fields, FCRA permissible-purpose tracking, ECOA reason codes, MLA / SCRA flags. Freeze v0 schema.
6. **Pick MVP providers:** lender partner (external), KYC orchestrator (Alloy default), IDV (Persona/Socure/Jumio), bureau (one of three), bank data (Plaid default), e-sign (DocuSign), comms (Twilio + SES), ACH path (Modern Treasury vs partner bank direct), card PSP (Stripe). Each is a hard external dependency.
7. **Draft AML Program + WISP (GLBA Safeguards) + Privacy Notice + state DSAR procedures.** Engage AML / compliance consultant if not in-house.
8. **Engage Figma design lead** to start §8 file structure with brand foundations + token system.
9. **Stand up `eazepay/design-system` repo** and ship the token export pipeline before any UI is built.
10. **Write ADRs** for: monorepo, NestJS, RN, Aurora PG, Cognito, Terraform, hybrid orchestration, bank-partner architecture, ACH origination path. (`docs/adr/` in `platform`.)
11. **Define MVP success metrics** — funded loans, time-to-offer, approval rate, default rate threshold by vintage, complaint rate (CFPB/state AG ratio), NPS, merchant attach rate. Without these, "MVP done" is undefined.
12. **Hire or contract:** 1 backend lead (Node/TS), 1 mobile lead (RN + native bridges), 1 product designer, fractional **CCO + BSA Officer** (US fintech compliance), fractional CISO, 1 SRE/platform engineer. This is the minimum to execute Phases A–F in parallel.
13. **Procure SOC 2 readiness vendor** (Vanta / Drata) on day 1 — partner banks will ask in month 1.
14. **Schedule a 2-day architecture deep-dive** with the team + counsel to ratify this document, capture deltas, and convert each open question in §22 into an owned decision.

---

## Appendix A — Decisions made in this document (single page)

| #   | Area                | Decision                                                                                                                                                                                                                                         |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Mobile              | React Native + TS, native bridges where required                                                                                                                                                                                                 |
| 2   | Web                 | Next.js App Router + TS + Tailwind + design system                                                                                                                                                                                               |
| 3   | Backend             | NestJS modular monolith on Node 20; Go for orchestration only if benchmarks demand                                                                                                                                                               |
| 4   | Datastore           | Aurora PostgreSQL 16, Redis, DynamoDB (audit), S3 (docs)                                                                                                                                                                                         |
| 5   | Cloud               | AWS `us-east-1` primary + `us-west-2` DR, multi-account, OIDC-only deploys, US-only SCP                                                                                                                                                          |
| 6   | Auth                | Cognito + custom session/device layer                                                                                                                                                                                                            |
| 7   | Repos               | Hybrid: Nx monorepo for product, separate infra + design-system + sdk + integrations + docs                                                                                                                                                      |
| 8   | Orchestration       | Hybrid (parallel within tier, waterfall across tiers) with adapter interface                                                                                                                                                                     |
| 9   | BuzzPay (TrueTopia) | Same `LenderAdapter` interface as externals; first-look only when economically optimal AND eligible. Lender-of-record (partner bank) carried structurally on every Loan                                                                          |
| 10  | Decisioning         | Rules engine + deterministic affordability at MVP; shadow ML thereafter; SR 11-7 model risk + ECOA fair-lending review mandatory                                                                                                                 |
| 11  | Compliance          | Lending model (bank-partner vs state-licensed) locked pre-MVP. Federal: BSA, OFAC, TILA/Reg Z, ECOA/Reg B, FCRA, GLBA + Safeguards, EFTA/Reg E, UDAAP, MLA, SCRA, E-SIGN. State privacy patchwork (CCPA/CPRA + others). CFPB complaint workflow. |
| 12  | Security            | Cognito + WebAuthn V1, KMS envelope, mTLS internal, append-only audit, JIT prod access, SOC 2 Type I within 9mo, NYDFS Part 500 readiness if NY-in-scope                                                                                         |
| 13  | CI/CD               | GitHub Actions OIDC, Terraform, canary deploys, Detox/Playwright E2E                                                                                                                                                                             |
| 14  | Money               | Integer cents, BigInt; never floats                                                                                                                                                                                                              |
| 15  | PII                 | Column-level encryption; deterministic AES-SIV for searchable PII; tokenisation vault by V1                                                                                                                                                      |

---

## Appendix B — Risks and blind spots (called out, not hidden)

1. **Solo founder + ambitious scope.** Even with this blueprint, MVP delivery realistically needs 5–7 people. Hiring is the gating risk, not technology.
2. **Bank-partner timeline.** Partner-bank diligence + onboarding is 6–12 months, not weeks. Start now even if MVP code isn't ready. State-licensing alternative is 12–18+ months for nationwide coverage.
3. **True Lender / Madden risk.** Recent state AG actions (esp. CO, NY, DC, IL) and bank-partner program scrutiny mean the bank must actually own the credit decision in substance, not just form. Architecture and governance must reflect this from day one.
4. **BuzzPay capital readiness.** PE-backed book needs warehouse facility, servicing capability, and a tested loan tape before scale. Building the tech ahead of the capital is fine; launching is not.
5. **Lender economics.** External lenders may demand exclusivity, MFN clauses, or volume commitments that constrain orchestration. Negotiate routing freedom up front.
6. **UDAAP exposure on orchestration.** "Best for consumer" sort is the only defensible default. Any paid-placement or internal-preference logic must be disclosed and auditable. CFPB scrutinizes this category heavily.
7. **State patchwork drift.** Privacy laws + APR caps + licensing change continually. The state-rules matrix in the rules engine is a living artefact requiring quarterly legal review, not a one-shot config.
8. **Fair lending / ECOA disparate impact.** Models trained on bureau + bank-cashflow features can encode protected-class proxies. Pre-deployment + ongoing fair-lending testing isn't optional and will be diligence asked by every partner bank.
9. **Fraud at scale.** Merchant-channel originated loans are a fraud vector (collusion, synthetic identities, bust-out). Risk module v0 is rules-only; expect to need ML + Plaid Signal / Sift / Socure Sigma by V1.
10. **Mobile native dependencies** (biometrics, App Attest, secure enclave) are where RN cross-platform claims break. Budget engineering capacity for native bridges from day one.
11. **AI guardrails.** It is tempting to ship LLM-based decisioning quickly. Don't. The regulatory (CFPB Circular 2023-03 — adverse action specificity; ECOA) and reputational cost of an unexplainable decline is enormous. Ship rules + explainable models with SR 11-7 governance first.
12. **Vendor concentration.** A single KYC, bureau, bank-data, or PSP outage can halt origination. Plan secondary providers (or at minimum a documented manual fallback) by V1.
13. **CFPB / FTC enforcement environment.** UDAAP + dark-patterns + junk-fees enforcement posture is aggressive. Marketing review and product copy review must run alongside engineering — don't let a launch CTA become an enforcement matter.
14. **Reg E ACH return rate.** Exceeding Nacha thresholds shuts down origination quickly. Design the repayment funnel for low return rates from day one (account validation, smart retry, pre-debit notice).

---

_End of EazePay CTO Architecture & Execution Blueprint v0.1._
