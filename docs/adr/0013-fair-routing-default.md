# ADR-0013: Fair Routing as the Default Sort

- **Status:** Accepted
- **Date:** 2026-03-02
- **Deciders:** Founder, Chief Compliance Officer (acting), Head of Engineering
- **Supersedes:** —

## Context

EazePay's orchestration engine sees every applicant, decides which
lenders to call, ranks the offers that come back, and surfaces those
offers to the consumer. The default sort on the offer screen is the
single most consequential ranking decision the platform makes — for
the consumer, for the partner banks, for our UDAAP posture, and for
our regulator credibility.

Several teams have proposed (at various points) ranking by:

1. **Lowest total cost to the consumer** — pure TILA "total of payments"
2. **Lowest APR** — common but not the same as #1 when fees and term
   differ
3. **Highest expected EazePay revenue** — the option that is best for
   us, not the customer
4. **Best lender-fit score** — a blended ranking that combines approval
   probability, EazePay margin, and consumer cost
5. **Lender-paid placement** — the highest bidder shows first

CFPB enforcement actions, the FTC's 2024 dark-pattern guidance, and the
"junk fees" enforcement posture all converge on the same point:
ranking a consumer-facing comparison surface by anything other than
consumer benefit creates UDAAP exposure that scales with volume.

## Decision

The default offer sort is **lowest total cost of credit to the
consumer**, defined as `sum(scheduled_payments) + sum(non-finance fees)`
for the full life of the loan. Ties break on (a) shortest term, then
(b) lowest APR, then (c) lender SLA p95 — never on EazePay revenue.

The default is enforced in code, not in policy. Specifically:

1. The orchestration ranking function `rankOffers(offers, ctx)` takes
   a typed `RankingPolicy` parameter. Only the `consumer_best`
   policy is wired into production paths.
2. Any caller that passes a different `RankingPolicy` must come from a
   controller marked with `@AdminOverride()` and the override is
   written to the audit chain with the operator's identity, the
   reason code, and the consumer's later choice.
3. A property test in `services/orchestration/test/ranking-policy.spec.ts`
   asserts that for every (offers, ctx) pair, the consumer-best policy
   is the policy that minimises the `cost_metric` total-of-payments
   value.
4. The compliance dashboard surfaces an anomaly if more than 0.1% of
   surfaced offer sets in any 24-hour window came back in non-default
   order. (Threshold tuned during the SOC 2 Type I window.)

Consumers may re-sort the offer table by their own preference — APR,
monthly payment, term, lender — and that user action is logged but
does not change the default presentation order on first paint.

## Alternatives considered

- **Best lender-fit (blended)** rejected — easy to defend to a CFO,
  impossible to defend to a CFPB enforcement attorney. The blend
  collapses into "however we weighted EazePay revenue", which is the
  UDAAP-exposed shape.
- **Lender-paid placement** rejected outright. We can monetise
  placement only in a clearly-disclosed advertising surface that is
  distinct from the offer comparison, and that's a V2 conversation.
- **Lowest APR** rejected — APR alone misranks when fees + term vary.
  A 60-month 9.99% APR loan with a $500 origination fee is more
  expensive than a 48-month 10.49% APR loan with no fee.
- **No default — consumer must sort** rejected. Choice paralysis
  is a known consumer-harm pattern. A neutral default is better than
  no default.

## Consequences

- Easier: CFPB / state AG / bank-partner audits. We point at the
  property test, the audit anomaly monitor, and the override
  taxonomy.
- Easier: telling lenders that price wins, because the platform won't
  sell them rank.
- Harder: business-development conversations with lenders who expect
  preferred placement. We're explicit in our partner agreements that
  this is not a service we offer.
- Harder: revenue optimisation. We trade some margin for posture.
  Worth it.

## Compliance / risk notes

- **CFPB Circular 2023-03 (Adverse Action)** — not directly on point
  but the orientation toward decision-traceability informed this
  decision.
- **UDAAP (Dodd-Frank §§ 1031, 1036)** — primary risk we're
  controlling.
- **ECOA / Reg B § 1002.4** — non-discrimination at every step,
  including how offers are surfaced.
- **FTC junk-fees rule** — informs the "non-finance fees included in
  total cost" definition.
- **State AG attention** — CO, NY, DC, IL have all publicly
  scrutinised paid-placement in consumer-finance comparison sites.
- **Bank-partner expectations** — Cross River, WebBank, FinWise have
  all signalled that True-Lender substance includes consumer-fair
  presentation by the platform; our default supports their posture.

The override mechanism is not a workaround. It exists because an
operator legitimately needs to re-rank for a manual underwriting
review, a SAR investigation, or a regulator response — and the audit
chain captures the why. Engineers shipping new override paths must
ensure those paths cannot reach the consumer surface without an
additional operator confirmation.
