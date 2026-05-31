# ADR-0028: Decision semantics — versioned catalog, evaluate-all, reproducible replay, dual retention

- **Status:** Accepted
- **Date:** 2026-05-31
- **Deciders:** Brodie + Builder Council

## Context

The engine replaces `scoreLender()` (three hardcoded rules: brand allowlist, tier
map, amount envelope; `Math.round`/float math; **no state predicate**) with
data-driven, versioned, reproducible decisioning. SR 11-7 model governance demands
reproducibility and validation. Reg B demands ≤4 principal reasons (CFPB Model
Form C-1). FCRA §615(a) demands a *separate* ≤4-item bureau key-factor disclosure.
Vendor freshness (~14 days) and adverse-action basis retention (25 months) are
different clocks and were being conflated.

Several converging defects in today's code must not survive into the engine:
single-lender reason selection (`adverse-action-builder.ts:134` passes one reason
from one excluded lender); affordability fails **open** (`decision.service.ts`
assumes income 6000/obligations 2000 cents on missing data); thin-file is
conflated with no-eligible-lender.

## Decision

**1. Rules model = versioned catalog + pinned config blob, not a relational DSL.**
Use the existing `LenderProduct` catalog (already carries
`minAmountCents`/`maxAmountCents`/`minTermMonths`/`maxTermMonths`/`permittedStates`/
`brand`/`enabled` as data) plus a pinned coefficient/threshold config blob (scorer
weights, `TIER_BASE_SCORE`, APR bands) plus an `effectiveCatalogSnapshotId`. A full
relational `LenderRule`/`LenderRuleVersion` DSL is over-engineering for the current
rule shape and is explicitly deferred.

**2. Two stages: hard eligibility (knockouts) → propensity (ranking).** Hard
knockouts produce binary *eligibility* exclusions; propensity ranks only the
eligible set. They are distinct because adverse-action causation differs: a
knockout is a binary cause attributable to the applicant or to licensing; a low
propensity rank among eligible lenders is **not** a decline.

**3. Evaluate ALL lenders; derive ≤4 reasons by consumer-causation /
knockout-proximity.** Replace single-lender reason selection. Reg B requires the
principal reasons for *the applicant's* decision across the evaluated set, ranked
by how causal each factor was / how close the applicant came, capped at 4 (Model
Form C-1).

**4. Reproducible replay (SR 11-7).** Integer/fixed-point math only in the scored
path — no `Math.pow`/`Math.round`/float. Pin `ruleVersion` + `scorerVersion` +
`policyVersion` + `effectiveCatalogSnapshotId` on every decision. Same input + same
pins → byte-identical, no-side-effect replay. Idempotency key =
`applicationId + sha256(canonical input)`, **composing with ADR-0015** — not a
second idempotency scheme.

**5. Dual retention.** Vendor-freshness TTL (~14d — don't re-decide on a stale
pull) is distinct from FCRA/ECOA adverse-action **basis** retention (25 months,
12 CFR 1002.12(b)). Persist a durable *decision-basis* record (features used,
reason codes, §615(a) score factors, version pins) **separate** from the purgeable
CreditPull snapshot. The basis survives the snapshot purge.

**6. Affordability missing-income → INCOMPLETE, never fail-open.** When income is
absent, the outcome is INCOMPLETE (Reg B incompleteness-notice path), never a
silently assumed income. Fail-closed.

**7. Thin-file ≠ no-eligible-lender.** Distinguish "insufficient credit data to
score" (thin file → route to thin-file-tolerant lenders, else INCOMPLETE) from
"evaluated, all lenders knocked out" (→ adverse action). Different consumer
outcomes, different notices.

## Alternatives considered

- **Relational rules DSL now** — over-engineered for current rule shape; deferred
  until rule complexity demands it.
- **Keep float math** — breaks SR 11-7 byte-identical replay; rejected.
- **Single-lender reason (status quo)** — Reg B violation; rejected.
- **Fail-open affordability (status quo)** — UDAAP + safety-and-soundness risk;
  rejected.

## Consequences

- **Positive:** reproducible, examinable, versioned decisions; honest, correctly
  ranked reason codes; clean separation of eligibility vs propensity.
- **Negative / accepted:** more upfront modeling discipline; need a replay harness
  and a shadow comparator (reason codes + included-set must match the legacy path
  exactly; score may differ).

## Compliance / risk notes

SR 11-7 (reproducibility + validation gates before first live decision), Reg B
1002.9 / 1002.12(b) (≤4 reasons, 25-month retention), FCRA §615(a) (score
disclosure, a distinct ≤4-factor list). The 25-month clock is enforced at the
durable basis record, independent of the 14-day snapshot purge.
