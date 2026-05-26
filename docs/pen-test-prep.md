# Pen-test engagement preparation

> Audience: Brodie (engagement lead) and the engineering team supporting
> the test. The companion doc `docs/PEN_TEST_READINESS.md` tracks the
> security controls inventory — this doc covers the operational steps
> for _engaging_ a pen-test firm.

> Status: PRE-ENGAGEMENT. We have not yet booked a firm. Target window:
> immediately after the first lender demo lands, before the first pilot
> merchant takes a real payment.

---

## 1. Scope definition

### In scope

- **Web surfaces**: `apps/partner-portal` (operator console + brand
  portal + consumer apply flow at `/apply/*`).
- **HTTP API**: `apps/api` (Nest.js public REST API). OpenAPI spec
  available at `/docs` in staging (basic-auth gated).
- **Webhook ingest**: `apps/webhooks` (inbound lender callbacks under
  `/api/v1/webhooks/lenders/*`). HMAC-SHA256 signature surface, the
  inbox idempotency layer, the DLQ behavior.
- **Auth**: sign-in flow, session cookie lifecycle, MFA enrollment
  (where wired), the demo-cookie preset surface, partner-session
  guards, admin guards.
- **Multi-tenant boundary**: cross-tenant data isolation. Tester gets
  two partner accounts; explicit goal is to attempt to read / mutate
  the other partner's data from each side.
- **FCRA consent flow**: the consent receipt verifier under
  `/api/applications/consent` + `/api/integrations/highsale/prequal`.
  This is the highest-risk surface from a compliance perspective.
- **Webhook signing**: the per-lender HMAC verifier, including the
  constant-time comparison + replay-window enforcement.

### Out of scope

- **Third-party services**: MiCamp, HighSale, Plaid, ez-Check, Trutopia.
  The tester may probe our INTEGRATION code (how we call them, how we
  parse their responses) but not the providers themselves.
- **Railway infrastructure**: the hosting provider's control plane,
  Postgres infrastructure, Redis infrastructure. We rely on Railway's
  own SOC2 attestation for the substrate.
- **Marketing / static surfaces**: `/landing`, `/welcome`, the
  marketing-consult pages. Public read-only HTML with no auth surface.
- **Physical / social engineering**: not part of this engagement. We
  will book a separate red-team engagement once the platform is at
  pilot scale.
- **DDoS / volumetric attacks**: out of scope; would require a
  separate stress-test arrangement with Railway upstream.

### Authentication for the tester

- 1× operator account with `admin` role (NOT `master_admin` — operator
  scope is enough for the in-scope surfaces; master is the operator's
  operator).
- 2× partner accounts on the same brand (e.g. both `medpay`), seeded
  with distinct applications + offers, used to attempt cross-partner
  reads.
- 1× consumer test account for the apply flow.

---

## 2. Required artifacts

The firm will request these on day 1. Preparing them now saves a week.

### a. Architecture diagram

System diagram showing every service + every data store + every
external integration. Must include:

- The 30 repos in the AUREANOS / EAZEPay tree, grouped by surface.
- Data stores: Postgres (per-environment), Redis (BullMQ), Railway
  object storage.
- External integrations: MiCamp (sub-account provisioning + payments),
  HighSale (soft-pull credit), Plaid (account verification), ez-Check
  (KYC), Trutopia (decision engine optional), the 52-lender envelope.
- Auth flow: Clerk (TBD — currently demo-cookie + account-cookie
  hybrid), session cookie shape, demo-preset surface.
- Network boundary: which traffic is public, which is internal-only.

**Status**: NOT YET DRAFTED. Block until written; firms reject scoping
without a diagram. Estimated effort: 4 hours.

### b. Threat model

STRIDE applied to each in-scope surface. Spoofing / Tampering /
Repudiation / Information Disclosure / Denial of Service / Elevation
of Privilege — one section per surface.

**Status**: NOT YET DRAFTED. Reference to a future
`docs/threat-model.md`. Estimated effort: 8 hours.

### c. Inventory of known issues

Internal list of known findings the firm should not waste budget
discovering. Sourced from `docs/audits/SECURITY_AUDIT_2026-05-15.md`
and the iteration-1/2/3 P0/P1 lists. Status: AVAILABLE.

### d. List of recent material changes

Pen-test firms ask for a 30-day change-log so they understand the
attack-surface velocity. Sourced from `git log --since='30 days ago'`
on `main`.

### e. Compliance overview

Two-pager covering: PCI scope (we are NOT a card processor — we
intentionally never touch a PAN), FCRA compliance (consent receipts,
permissible purpose, adverse action notices), SOC2 trajectory.

---

## 3. Test environment

**Use staging. Never prod.**

The staging environment must be:

- Pre-seeded with synthetic data only. RFC 2606 `.test` emails, the
  load-test synthetic-applicant generator, no real PII.
- Refreshed within 24h of test start (so the tester gets a clean slate
  matching the prod migration state).
- Open inbound from the tester's static IP range (firm provides a CIDR
  block on engagement signing).
- Wired to the same observability stack as prod (so findings can be
  cross-referenced against real telemetry).
- Marked `staging` in every UI element — testers should never have any
  doubt which env they're in.

**Pre-test flag freeze**: disable LaunchDarkly / feature-flag changes
for the duration. We want the tester hitting a stable target.

**Prod read-only**: separately, ensure no prod credentials / SSH keys
exist on the tester's account. Defense in depth — even if the tester
strays out of scope by mistake, no prod access.

---

## 4. Disclosure timeline

The expected SLA for fix windows in the engagement contract:

| Severity                       | Disclosure window | Fix window | Retest      |
| ------------------------------ | ----------------- | ---------- | ----------- |
| P0 (critical, exploitable RCE) | Immediate (call)  | 7 days     | Included    |
| P1 (high, data exposure)       | 24 hours          | 30 days    | Included    |
| P2 (medium, hardening)         | End of test       | 90 days    | Best effort |
| P3 (informational)             | Final report      | Discretion | N/A         |

P0 / P1 findings get an out-of-band call from the firm; everything else
lands in the final report.

**Coordinated disclosure**: the firm agrees not to publish or share any
finding for 90 days post-engagement, allowing us time to remediate.

---

## 5. Contract clauses

Standard terms to negotiate into the SOW:

- **Liability cap**: typically equal to engagement fee (i.e. they're
  not on the hook for production damage they cause — that's covered
  by us using staging only).
- **Insurance**: firm must carry $1M+ E&O coverage.
- **Retest**: P0 + P1 retest included in fee. Two retest cycles
  standard; additional cycles billed at hourly rate.
- **Final report**: due 5 business days post-engagement, in both
  executive-summary and technical formats. Both formats include
  per-finding remediation guidance.
- **Use of findings**: we may share excerpts with regulators, lenders,
  and SOC2 auditors. Firm name may be cited.

---

## 6. Firm shortlist

Public, well-known names. Pick 2–3 to request quotes.

| Firm              | Strengths                                                              | URL                     |
| ----------------- | ---------------------------------------------------------------------- | ----------------------- |
| **NCC Group**     | Large; strong web + crypto; UK + US offices; FedRAMP exp               | https://nccgroup.com    |
| **Trail of Bits** | Excellent code-level depth; smart-contract + crypto pedigree; US-based | https://trailofbits.com |
| **Cure53**        | Premium web-app focus; Berlin-based; well-regarded reports             | https://cure53.de       |
| **Bishop Fox**    | Wide US fintech experience; app + cloud + red-team                     | https://bishopfox.com   |
| **Doyensec**      | Smaller, lean reports, web + API focus                                 | https://doyensec.com    |

Selection criteria for our case:

1. **Web + API focus** — we're a Next.js + Nest.js + Postgres app, not
   a smart-contract or embedded shop.
2. **Fintech / financial-services experience** — they should already
   understand FCRA, the lender-API integration pattern, ACH webhook
   surfaces.
3. **CREST or OSCE-certified consultants** — CREST is the gold
   standard for the UK / EU side; firms with CREST-certified leads
   pass procurement easier.
4. **English-native report writing** — the report goes to lenders +
   our auditor. Quality of writing matters.

---

## 7. Budget expectation

Industry rate for a 5-day engagement on a stack our size:

- **Lower-end** (Doyensec / smaller firm): **USD 15 000 – 20 000**
- **Mid-range** (Bishop Fox / NCC standard scope): **USD 20 000 – 30 000**
- **Premium** (Trail of Bits, Cure53): **USD 30 000 – 40 000**

A 5-day engagement covers:

- Day 1: kick-off, scope confirmation, threat model walkthrough.
- Day 2–4: testing (the tester is heads-down).
- Day 5: write-up + close-out call.

Add **+1 day** if we want a dedicated mobile review (NOT needed — we
have no mobile app yet).

Add **+1 day** if we want a third-party-integration review (HighSale,
MiCamp). We're deferring this until those partnerships are signed.

---

## 8. Pre-test checklist

Run this before the engagement starts. One owner per row.

- [ ] **All known P0 / P1 closed** — iteration 1/2/3 P0/P1 lists are
      green. Owner: Brodie. (DONE for iteration 1 + 2; iteration 3
      closes performance + ops readiness, not security.)
- [ ] **Architecture diagram drafted** — see section 2a. Owner: Brodie.
      Effort: 4h.
- [ ] **Threat model drafted** — see section 2b. Owner: Brodie.
      Effort: 8h.
- [ ] **Staging refreshed with synthetic data** — wipe + reseed the
      week before. Owner: ops on-call.
- [ ] **Feature flags frozen** — no flag changes for the engagement
      window. Owner: engineering lead.
- [ ] **Comms to team** — Slack `#engineering` post: "pen-test active
      DD-MM through DD-MM, expect noise in staging, do NOT ship to
      prod without engineering-lead sign-off". Owner: Brodie.
- [ ] **Incident pager on** — testers find P0 → we want the on-call
      paged within 5 minutes. Owner: Brodie.
- [ ] **Prod freeze** — no deploys to prod during the engagement
      window except for hot-fixes to a P0 the tester surfaces.
      Owner: engineering lead.
- [ ] **Backup of staging DB** taken 24h before, retained 90 days —
      so we can replay any state the tester reaches. Owner: ops.
- [ ] **Test-account credentials** — generate the operator + 2 partner + 1 consumer test accounts; deliver via password manager invite
      (NOT email). Owner: Brodie.
- [ ] **NDA executed** with the firm and any subcontractors. Owner:
      legal counsel (Brodie until counsel retained).

---

## 9. What we expect to learn

A good pen-test surfaces:

- Auth + session lifecycle issues (cookie scope, refresh logic).
- Cross-tenant boundary leaks — the highest-risk class of finding for
  us. Our multi-tenant model is enforced at the application layer
  (every query carries `partner_id` filter); a pen-test that finds a
  row-level-security bypass is the single biggest win possible.
- HMAC verification edge cases on the webhook surface.
- Input-validation gaps in the consumer apply flow.
- Information disclosure via error responses (the
  `lib/safe-error.ts` pattern was a closed iteration-2 finding;
  retest will confirm the fix held).
- IDOR on resource URLs (the orchestration submit + offer routes
  in particular).

A pen-test won't find:

- Bad encryption-at-rest configuration. That's a SOC2 / configuration
  audit task.
- Long-tail edge cases requiring weeks of state buildup. Five days is
  a snapshot.
- Business-logic abuse that requires understanding the lender
  marketplace economics. That needs an internal red-team.

The pen-test is one of three security pillars — pen-test + threat-
model + SOC2 audit together. None replaces the others.
