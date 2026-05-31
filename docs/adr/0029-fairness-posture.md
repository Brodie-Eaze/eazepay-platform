# ADR-0029: Fairness posture — brand ≠ adverse-action reason, state = licensing knockout, disparate-impact testing pre-launch

- **Status:** Accepted
- **Date:** 2026-05-31
- **Deciders:** Brodie + Builder Council

## Context

The single worst defect in today's engine: `internalReasonToRegB()`
(`decision-engine.ts:262-309`) maps `brand_mismatch:*` → the **GEOGRAPHY** Reg B
reason code. That tells a consumer they were declined for *where they live* when
the truth is a lender brand-allowlist mismatch — a fabricated geography reason,
which is redlining-shaped misrepresentation under ECOA/Reg B and a UDAAP/FCRA
§615(a) exposure. It also maps `tier_mismatch:*` → "application incomplete"
(false — the application was complete). And despite `permittedStates` existing as
data on `LenderProduct`, `scoreLender()` has **no state predicate** at all.

Reg B reason codes (CFPB Model Form C-1) are a fixed, legally load-bearing set.
They are not free text and must not be invented.

## Decision

**1. Brand mismatch is never a consumer adverse-action reason.** A lender's
brand allowlist is an internal routing fact, not a property of the applicant. If a
brand-allowlist exclusion is the only thing between an applicant and an offer, that
is a **no-offer-from-that-lender**, not a decline attributable to the consumer.
Adverse action issues only when no eligible lender exists for reasons that are
genuinely about the applicant.

**2. State becomes a real licensing knockout, surfaced honestly.**
`permittedStates` becomes a hard-eligibility predicate (a lender not licensed in
the applicant's state cannot lend — a true fact). When state is the binding
constraint across all lenders, the honest posture is **"we do not currently lend
in your state"** — a no-offer/availability message, **not** a credit-characteristic
decline dressed up in a credit reason code.

**3. Reg B reason codes are fixed — never invent.** Map each internal cause to the
closest **true** Model Form C-1 code. If no code is true for the applicant, it is
not an adverse-action reason — it is a no-offer or an availability fact.

**4. tier_mismatch ≠ "application incomplete."** A tier mismatch is a
credit-profile fact. Map to the true CREDIT_PROFILE reason or to no-offer; never
claim the application was incomplete when it was complete.

**5. Disparate-impact testing is a pre-launch gate.** Every hard predicate (state,
amount, term, tier, thin-file) is tested for disparate impact on ECOA prohibited
bases **before the engine makes a single live decision**. Predicates that could
proxy for a prohibited basis (e.g. geography proxying race) are flagged and
justified or removed. This is a launch gate, not a backlog item — it sits at the
SR 11-7 × fair-lending intersection.

## Alternatives considered

- **Keep brand→GEOGRAPHY mapping** — redlining-shaped misrepresentation;
  categorically rejected.
- **Treat state as a soft score factor** — wrong; licensing is binary and legal,
  and a state no-offer is an availability fact, not a credit decline. Rejected.
- **Map unknown causes to a "catch-all" credit reason** — fabricates a reason the
  applicant didn't earn; rejected. Unknown-cause ⇒ no-offer, not adverse action.

## Consequences

- **Positive:** eliminates redlining-shaped misrepresentation; notices state only
  true reasons; some former "exclusions" become honest no-offers (no AAN owed),
  which is both more truthful and lower regulatory risk.
- **Negative / accepted:** pre-launch disparate-impact testing adds time before
  go-live; the reason-mapping table must be reviewed against Model Form C-1 line by
  line; a no-offer path (distinct from adverse action) must be built and tested.

## Compliance / risk notes

ECOA/Reg B fair lending (Model Form C-1; no fabricated reasons), FCRA §615(a)/
§615(h), UDAAP (no misrepresentation of decline cause). Disparate-impact testing
is required evidence for both fair-lending exams and SR 11-7 model validation.
