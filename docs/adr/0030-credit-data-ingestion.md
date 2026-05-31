# ADR-0030: Credit-data ingestion — HighSale primary, CRS alternate, encrypted snapshot, split retention

- **Status:** Accepted
- **Date:** 2026-05-31
- **Deciders:** Brodie + Builder Council

## Context

The engine decides on credit data, so the pull is on the critical, FCRA-controlled
path. HighSale is already integrated in the monorepo (`HighsaleSnapshot`,
`apps/partner-portal/app/api/integrations/highsale/prequal`). CRS Credit API was
chosen 2026-05-31 as the managed-compliance alternate (FICO + VantageScore JSON,
MISMO 3.4; SOC 2 Type II) — see `project_eazepay_credit_bureau.md`.

Current defects on this path: permissible-purpose audit insert is **caught and
logged after the pull** (`highsale/prequal/route.ts:150-158`) rather than enforced
fail-closed; `HighsaleSnapshot` expires ~14 days, which collides with 25-month
adverse-action basis retention; DLQ writes are plaintext (PII at rest);
`mla_36_pct_mapr_cap_applied: false` is hardcoded (`orchestration/route/route.ts:73`).

## Decision

**1. `CreditPullPort` — vendor-neutral.** Mirror the `LenderAdapter` shape
(`services/lender/src/ports/lender-adapter.port.ts`). **HighSale = primary v1
adapter** (incumbent, integrated). **CRS = pluggable alternate** (managed
compliance). Selectable per request/config.

**2. Collect (impure I/O) vs decide (pure over snapshot) — two functions, ONE
request handler.** The pull produces an **encrypted CreditPull snapshot**; the
decision is a pure function over that snapshot (enables ADR-0028 replay). We do
**not** split this into `/v1/collect` → `/v1/decide` HTTP endpoints — that was
dropped to avoid UI/UX leakage. One handler, two internal functions.

**3. Permissible purpose enforced same-transaction, fail-closed (FCRA §604).** The
permissible-purpose record is written in the same transaction as — or strictly
before, fail-closed — the pull. No permissible-purpose record ⇒ no pull. The
existing pre-pull consent gate (`prequal/route.ts:292`) is preserved.

**4. Encryption + split retention.** The CreditPull snapshot is encrypted at rest
(ADR-0016 envelope encryption). Vendor-freshness TTL ~14d on the live snapshot
(don't re-decide on stale data). The durable **decision-basis** record (features +
reason codes + §615(a) score factors + version pins, per ADR-0028) is retained
**25 months** (12 CFR 1002.12(b)) and survives the snapshot purge. The §615(a)
score disclosure (≤4 bureau key factors — a list distinct from the Reg B principal
reasons) is captured at decision time into the basis record.

**5. Encrypted, durable DLQ.** No plaintext PII in the DLQ. Failed pulls/decisions
queue with envelope-encrypted payloads to a durable store (not a plaintext file).

**6. MLA: real 36% MAPR + DMDC covered-borrower lookup.** Replace the hardcoded
`mla_36_pct_mapr_cap_applied: false`. Resolve covered-borrower status via the DMDC
lookup (32 CFR 232.4), compute all-in MAPR, and treat a product whose MAPR exceeds
36% for a covered borrower as a **hard knockout** for that lender/product.

## Alternatives considered

- **CRS as primary v1** — rejected for now; HighSale is already integrated and
  proven in-repo. CRS stays the pluggable alternate (and the redistribution /
  Channel-Partner blocker on CRS is still unconfirmed — see
  `project_eazepay_credit_bureau.md`).
- **Keep permissible-purpose as after-the-fact audit log** — FCRA §604 risk;
  rejected. Must be fail-closed.
- **Single 14-day retention** — loses the adverse-action basis at month 1, breaking
  12 CFR 1002.12(b); rejected. Split retention required.

## Consequences

- **Positive:** vendor-pluggable; fail-closed permissible purpose; honest split
  retention; no plaintext PII at rest anywhere; real MLA enforcement.
- **Negative / accepted:** upfront `CreditPullPort` + envelope-encryption +
  DMDC-lookup work; two retention clocks to operate and prove; a durable encrypted
  DLQ to build.

## Compliance / risk notes

FCRA §604 (permissible purpose, fail-closed), §615(a) (score disclosure, distinct
≤4-factor list), MLA 32 CFR 232 (DMDC covered-borrower + 36% all-in MAPR cap),
ADR-0016 (envelope encryption at rest), 12 CFR 1002.12(b) (25-month basis
retention), ADR-0011 (hash-chained audit outbox in the same transaction as the
decision write).
