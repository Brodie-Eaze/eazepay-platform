# ADR-0007: Hybrid (parallel within tier, waterfall across tiers) lender orchestration

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Brodie (founder/CTO)

## Context

We must route applications across an internal lender (BuzzPay, by TrueTopia) and multiple external partners spanning prime, near-prime, BNPL, and category specialists. Pure waterfall is slow and bleeds approval rate; pure parallel quoting is expensive and burns soft-pull credit. Hybrid balances both.

## Decision

- Tiered routing graph: Tier 0 (BuzzPay) → Tier 1 (prime) → Tier 2 (near-prime/specialist) → Tier 3 (BNPL/installment) → Tier 4 (subprime, opt-in only) → Fallback (manual review).
- Within each tier, **parallel** quote calls to all eligible adapters, aggregated within a 5s soft / 8s hard timeout.
- Across tiers, **waterfall**: stop descending once `MIN_OFFERS_TO_PRESENT` (default 3) approvals exist.
- Default sort to consumer is "lowest total cost" — UDAAP + ECOA defensibility. Any deviation requires user-visible disclosure.
- Lender adapters share a single `LenderAdapter` interface; BuzzPay implements it the same as externals — no internal/external branch in orchestration.

## Alternatives considered

- **Pure waterfall:** simpler, lower vendor cost, but worse approval rate and time-to-offer.
- **Pure parallel:** best UX, but expensive (every call costs) and creates capacity strain on partners.
- **ML-driven routing:** premature at MVP. Rules + tier ordering first; introduce contextual bandits in V1 with shadow validation.

## Consequences

- Circuit breakers per adapter (open after 50% error in 1min over 20+ calls). Open lender excluded from routing automatically; on-call paged.
- Orchestration internal logic budget: ~150ms (P99 end-to-end target ≤ 800ms including external lender calls). Node will hold this; revisit Go if benchmarks fail.
- Orchestration NEVER hides a cheaper offer behind a more profitable one for EazePay — hard-coded, monitored, audited.

## Compliance / risk notes

Every routing decision writes a `LenderRoute` row (eligible | ineligible | approved | declined | error + reason code + raw response ref). This is the audit trail for ECOA Adverse Action defensibility. Decline reasons aggregated across lenders are mapped to the Reg B reason taxonomy before the consumer-facing notice is generated.
