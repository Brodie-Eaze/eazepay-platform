# ADR-0021: Decision engine — internal scorer as default, Trutopia cloud as opt-in

**Status:** Accepted
**Date:** 2026-05-26
**Deciders:** Brodie + Builder Council

## Context

The decision engine ranks lenders inside each tier and produces the
Reg B reason codes that drive adverse-action notices. It is on the
critical path for every submitted application and is also where the
regulator (CFPB, ECOA) cares most about explainability.

Tim @ Trutopia runs a cloud-hosted engine already powering Grow
Funders. Using it ships the waterfall behaviour in days. The
alternative — owning the scorer — costs weeks of work.

Propensity logic is core IP for an ISO + lender-referral business.
A platform that pays a per-decision fee upstream cannot grow gross
margin without renegotiating a vendor contract, and a vendor outage
or exclusive-with-competitor scenario would stall every lender route
in EazePay.

## Decision

The internal scorer in `apps/partner-portal/lib/decision-engine.ts`
is the **default, primary path**. Trutopia is an **opt-in alternate
provider** behind `DECISION_ENGINE_PROVIDER=trutopia`, conforming to
the same `scoreApplication(input) -> { tierRanking, reasonCodes }`
interface — usable either as a fallback or as a shadow comparison
while we tune our weights.

## Options considered

1. **Trutopia cloud only** — fastest, but pays per-decision fee in
   perpetuity, leaks routing data, ties adverse-action explainability
   to a vendor's release cycle, and creates a single point of failure.
   An examiner would correctly push back on Reg B reason codes that
   live in a vendor's repo.
2. **Internal engine only, no Trutopia** — clean ownership, but no
   comparison signal during the first six months of tuning and no
   fallback for inputs our scorer can't reason about.
3. **Internal default, Trutopia opt-in** _(chosen)_ — own the
   default path, keep the door open for shadow comparison and
   fallback. Cost is the surface of supporting two provider shapes
   behind one interface.

## Consequences

**Positive:**

- IP stays in-house — weights, tier definitions, and Reg B mapping
  are versioned in our own repo.
- No per-decision fee on the dominant code path.
- Adverse-action notices generated from code we can show an examiner
  without an NDA.
- A Trutopia outage does not stop the waterfall.

**Negative / accepted trade-offs:**

- We carry the scoring burden. Initial scorer is coefficient-based,
  not learned — we accept lower accuracy in the first six months in
  exchange for full explainability.
- Two provider shapes to keep aligned. Integration tests assert both
  produce a valid `DecisionResult` for the same fixtures.
- Tuning loop is on us. We need a metrics pipeline capturing
  approve / decline / no-offer outcomes per lender per tier.

**Reversibility:** Medium. Flipping the default provider is one env
var. Removing the internal engine entirely after lender contracts and
adverse-action templates reference its reason codes would require a
schema migration on `application_events` and a rewrite of the
adverse-action job.

## References

- `apps/partner-portal/lib/decision-engine.ts`
- `apps/partner-portal/lib/decision-engine.spec.ts`
- ADR-0007 (hybrid lender orchestration)
- ADR-0011 (audit via transactional outbox)
