# ADR-0031: `/v1/decide` is a catalog-only prequal — no live lender-adapter calls

- **Status:** Accepted
- **Date:** 2026-05-31
- **Deciders:** Brodie + Builder Council
- **Relates to:** ADR-0013 (fair routing), ADR-0027 (placement/ports), ADR-0028 (decision semantics / shadow parity), ADR-0029 (fairness posture), ADR-0030 (credit-data ingestion)

## Context

`POST /v1/decide` is the **prequal** contract the partner-portal already calls
(`{ applicationId, ...prequal }` → `{ rankedLenders }`). It must stay a drop-in:
no UI change, fast, synchronous, and shadow-comparable to the legacy
`scoreLender()` it replaces.

A separate, already-built path — `services/orchestration/src/orchestration.service.ts`
(call it **World B**) — does the _real_ routing: async `LenderAdapter.quote()`
network fan-out with `AbortSignal` + timeout + `Promise.race`, ranked by true total
cost of credit per ADR-0013. World B is untouched by this engine.

The P4 task as originally written said "reuse the `LenderAdapter` port + parallel
`isEligible`/`quote` with timeout, rank per ADR-0013." Three forces make that the
wrong shape _for `/v1/decide`_:

1. **The canonical prequal is a thin mirror.** It deliberately field-matches the
   portal payload (`financials.ts`) and therefore lacks the fields a real quote
   needs — `LenderEvaluationContext` carries `userId`, `category`, `termMonths`,
   `affordabilityPasses`, `riskScore`; the prequal carries none of them. A
   "quote" computed without that context would be a fabricated number.
2. **Shadow parity (ADR-0028) demands logic comparability.** The legacy
   `/v1/decide` is catalog-only and synchronous. Comparing a live-quote engine
   against a catalog scorer is not apples-to-apples; the shadow comparator can
   only assert "included-set + reason codes match" if both sides reason over the
   same catalog with the same hard rules.
3. **ADR-0013 true-cost ranking needs a real quote.** "Lowest total cost of
   credit = `sum(scheduled_payments) + non-finance fees`" is undefined without a
   quote (APR, term, fees), which does not exist at prequal time.

## Decision

**P4's fan-out is a pure, synchronous projection over the ENABLED catalog — it
does NOT call `LenderAdapter.isEligible`/`quote`.**

- Catalog access is via a pluggable **`CatalogSourcePort`**. Production binds it
  to the lender registry's `listEnabled()` mapped to `CatalogProductFingerprint`;
  shadow binds it to the legacy static catalogue. The port is the only seam, so a
  future **live-quote mode is addable later as a projection** without reopening
  this decision — World B remains the home of real quotes and true-cost ranking.
- `runDecision()` is pure and deterministic: program envelope → per-lender
  knockouts → score propensity once (it is lender-independent) → rank the eligible
  set → assemble the wire response + the `EngineConfigSnapshot` it was computed
  under.
- **Ranking uses a consumer-cost PROXY, never EazePay revenue** (ADR-0013 spirit):
  lowest estimated APR (the tier's APR-band floor) → highest propensity → catalog
  `priority` ordinal → `lenderProductId`. `priority` is a catalog operational
  ordinal (waterfall order), explicitly **not** a revenue signal, and is only a
  deterministic tie-break beneath the consumer-cost keys.

### Honest consequence we accept

Every _included_ lender is tier-matched (a `tier_mismatch` knockout removes the
rest), so the propensity (lender-independent) and the tier-band APR are **identical
across the included set** at v1. The proxy's primary keys therefore do not
discriminate among included lenders yet — `priority` then `lenderProductId` are the
effective order. That is acceptable for a prequal _preview_; genuine
per-lender differentiation requires real quotes, which live in World B.

## Alternatives considered

- **Live adapter `quote()` at prequal (the original task wording)** — rejected.
  Needs context the prequal does not carry; a quote synthesised from missing
  context is a fabricated offer (UDAAP / consumer-trust risk); and it breaks the
  ADR-0028 shadow comparator. Real quotes belong in World B.
- **Rank by `priority` / blended fit / revenue** — rejected by ADR-0013. Proxy
  keys are consumer-cost-first; `priority` is a tie-break only.
- **Return the eligible set unsorted** — rejected. Choice paralysis is a known
  consumer-harm pattern (ADR-0013); a neutral consumer-cost default is required.
- **Fold prequal into World B** — rejected. World B is async, network-bound, and
  context-rich; `/v1/decide` must stay a fast synchronous drop-in.

## Consequences

- **Positive:** fast, synchronous, network-free prequal; drop-in for the portal;
  shadow-comparable to legacy; the replayable core stays pure (no IO, no clock).
- **Negative / accepted:** prequal APR + propensity are _estimates_, not quotes;
  among same-tier included lenders the order is effectively the catalog priority
  until live quotes exist; estimates must never be presented as guaranteed offers
  (the portal already frames them as estimates — the no-UI-change mandate holds).
- The `AbortSignal` only guards the catalog fetch in `runDecisionFromSource`; the
  pure `runDecision` has nothing to time out.

## Compliance / risk notes

- **ADR-0013 (UDAAP / consumer-best):** the proxy ranks consumer-cost first and
  never EazePay revenue; `priority` is a documented tie-break, not placement-sale.
- **ADR-0028 (SR 11-7 replay + shadow):** the engine is pure and fingerprints the
  exact catalog evaluated; the shadow comparator keys on included-set + Reg B
  reason codes, modulo brand-mismatch suppression (ADR-0029).
- **ADR-0029 (fairness):** brand-mismatch and MLA-cap knockouts are suppressed
  (`no_offer`), never surfaced as consumer adverse action.
- **ADR-0030 (credit data):** MLA covered-status is not in the prequal; it arrives
  with the credit pull and defaults `false` here, so the 36% cap never over-blocks
  a civilian at prequal.

## Revisit when

- A live-quote prequal becomes a product requirement, OR
- the canonical prequal is enriched with the `LenderEvaluationContext` fields
  (`termMonths`, affordability, `riskScore`, …) that a real quote needs — at which
  point a live-quote projection can be added behind `CatalogSourcePort` without
  changing the wire contract.
