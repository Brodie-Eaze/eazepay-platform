# ADR-0032: Reason aggregation + the consumer-disposition taxonomy

- **Status:** Accepted
- **Date:** 2026-05-31
- **Deciders:** Brodie + Builder Council
- **Relates to:** ADR-0028 (decision semantics / shadow parity), ADR-0029 (fairness posture / suppression), ADR-0030 (credit-data ingestion), ADR-0031 (catalog-only prequal)

## Context

`runDecision` (P4, ADR-0031) returns a **mechanical** `rankedLenders` list and
deliberately defers the consumer meaning of "no offer." Its own docstring says:
_"What 'no offer' MEANS for the consumer — adverse action vs INCOMPLETE vs
thin-file routing — is the aggregation layer's job (P5), not this function's."_
P5 is that layer.

Reg B (12 CFR 1002.9) does not have one "denied" state — it has **distinct
legal dispositions**, and conflating them is a violation:

1. **Adverse action** (`1002.9(a)`) — a credit denial. Must carry **specific**
   principal reasons (`1002.9(b)(2)`), **at most four** by CFPB guidance, drawn
   from the closed Model Form C-1 set ([[0028-decision-semantics]] reason-code
   parity).
2. **Notice of incompleteness** (`1002.9(c)`) — the application is missing
   information needed to decide. This is **not** a denial; you may not declare
   adverse action on data you never had. The engineering corollary is
   **fail-closed**: a missing affordability input must never **fail open** into a
   presented offer.
3. **No offer** (marketplace / legal suppression, [[0029-fairness-posture]]) —
   `brand_mismatch` and the MLA 36% MAPR cap are facts about the **lender**, not
   the consumer's creditworthiness. They are suppressed and must **NEVER**
   surface as a credit denial.

Two more traps the legacy path falls into:

- **Thin file ≠ no eligible lender.** A null `ficoBand`/`dti`/`openTradelines`
  ([[0030-credit-data-ingestion]]) means _we have little data_, not _the
  consumer was denied_. The scorer already treats nulls as zero-contribution
  over the tier base; P5 must not invent a "thin-file decline."
- **Suppression leaking into reasons.** `no_offer` knockouts carry a `null` Reg B
  code. If aggregation counted them, a brand-routing fact would become a
  consumer adverse-action reason — the exact [[0029-fairness-posture]] defect.

## Decision

P5 is a **pure, synchronous** `aggregateDecision(prequal, runResult)` that maps a
`RunDecisionResult` to a **discriminated union** — illegal states (offers on a
denial, reason codes on an approval) are unrepresentable:

```
OFFERS         { offers: IncludedLender[] }            — ≥1 included, affordability assessable
INCOMPLETE     { incompleteFields: IncompleteField[] } — required input missing AND pivotal
ADVERSE_ACTION { reasonCodes: RegBReasonCode[] }       — no offer, honest income-independent reasons (≤4)
NO_OFFER       {}                                       — no offer, every lender suppressed (brand / MLA)
```

### Precedence (and why)

```
1. included.length > 0:
     affordability assessable      → OFFERS
     else (income pivotal, missing) → INCOMPLETE        ← no fail-open
2. included.length == 0:
     aggregated reasonCodes > 0     → ADVERSE_ACTION
     else                           → NO_OFFER
```

- **INCOMPLETE fires only when the missing input is _pivotal_** — i.e. lenders
  matched but we cannot stand behind an offer because affordability is
  unassessable. That is the precise reading of "missing-income → INCOMPLETE
  **(no fail-open)**": we refuse to present an offer we can't justify, and we ask
  for the missing data rather than guessing. When **no** lender matched, the
  no-offer is driven by income-**independent** knockouts (geography, tier,
  amount); Reg B `1002.9(c)(2)` permits declining an incomplete application on an
  independent basis, so we surface the **honest** adverse-action reasons instead
  of an incompleteness notice the consumer can't act on.
- **Affordability-assessable** at v1 is simply `annualIncomeCents > 0`. Income is
  the one non-nullable canonical field; `≤ 0` is the only "missing" sentinel it
  can carry. We do **not** compute the affordability buffer here (reserved); P5
  only enforces the fail-closed gate the buffer math will later sit behind.
- **NO_OFFER is the empty-honest-reasons branch**, which is exactly where the
  upstream suppression lands: `runDecision` omits `no_offer` lenders entirely
  (and the MLA program gate returns an empty list), so "no included **and** no
  surfaced reason" can only mean every lender was suppressed → **brand-only /
  MLA → no AAN**, satisfied by construction.

### Reason aggregation — which ≤4, in what order

Across the **excluded** set (already free of `no_offer` — P4 suppressed them),
tally each Reg B code's **frequency** (how many lenders knocked the consumer out
for it), then order:

1. **frequency descending** — the reason that blocks the _most_ lenders is the
   most causally responsible for the overall no-offer (consumer-causation),
2. **knockout-proximity priority** — a fixed ordinal derived from the documented
   knockout order (`geography → tier → amount`: most-fundamental first), as a
   deterministic tie-break,
3. **code string** — final total-order tie-break for byte-identical replay
   ([[0028-decision-semantics]]).

Take the first **≤4**. P5 owns _which four and in what order_; the compliance
service (`buildAdverseActionNotice` → `normalizeDeclineCodes`, ECOA-02) still
independently maps raw→taxonomy, dedupes, and re-caps at 4 — a defense in depth,
not a substitute. At v1 this engine produces only four distinct adverse codes, so
the cap never culls; the ordering is what matters today and the cull is principled
if the taxonomy grows.

### The engine stays pure

P5 does **not** import the compliance-doc render service — that would put IO and a
`new Date()` into the replayable core. It emits the **ordered `RegBReasonCode[]`**;
the P7 handler is the seam that hands them to `buildAdverseActionNotice`. So the
aggregation replays byte-identically and the notice (with its timestamp) is built
at the boundary.

## Alternatives considered

- **INCOMPLETE always pre-empts when income is missing** — rejected. It would
  tell a consumer "provide income" even when they were declined for an
  income-independent reason (e.g. a $500k request over the $100k program cap),
  burying an honest, actionable reason behind a data request. Pivotal-only
  INCOMPLETE is more honest and still never fails open.
- **Fail open when income is missing** (present the offer anyway) — rejected
  outright. Presenting an offer we cannot justify on affordability is the UDAAP /
  consumer-trust failure the directive forbids.
- **Map thin file to `CREDIT_HISTORY_INSUFFICIENT`** — rejected. Thin file is not
  a knockout in this engine; manufacturing a decline reason from "we have little
  data" is precisely the conflation ADR-0030 warns against. Thin file routes
  through the same knockouts as anyone else, by construction.
- **Let compliance-doc's `normalizeDeclineCodes` choose the four** — rejected as
  the _primary_ mechanism. It caps in input order with no causation weighting;
  the engine, which knows _how many_ lenders each reason blocked, is the right
  place to prioritize. compliance-doc remains the independent second cap.
- **A flat struct with optional fields** (`offers?`, `reasonCodes?`) — rejected.
  A discriminated union makes "reason codes on an approval" a compile error.

## Consequences

- **Positive:** every no-offer is resolved to its correct legal disposition;
  suppression can never become a consumer denial; thin file never becomes a
  fabricated decline; missing affordability data fails closed; the aggregation is
  pure and replayable; P7 has a typed union to switch on.
- **Negative / accepted:** "affordability assessable = income > 0" is a coarse v1
  gate — it does not yet model the `affordabilityBufferCents` debt-service test;
  until that lands, an applicant with token income passes the gate. The gate is
  intentionally the _floor_ (fail-closed on truly-absent income), not the full
  affordability model.
- A consumer with matching lenders but `income ≤ 0` sees INCOMPLETE, not an
  offer — a deliberate, documented refusal to fail open.

## Compliance / risk notes

- **ECOA / Reg B `1002.9`:** the three dispositions are kept legally distinct;
  adverse-action reasons are specific, ordered by causation, and capped at four
  from the closed Model Form C-1 set; incompleteness is `1002.9(c)`, never a
  denial.
- **ADR-0029 (fairness):** `no_offer` suppression is upstream; P5's NO_OFFER arm
  is the by-construction landing spot, so brand-mismatch / MLA never reach an AAN.
- **ADR-0030 (credit data):** thin-file nulls route normally; no thin-file decline
  is synthesized.
- **ADR-0028 (SR 11-7 replay):** `aggregateDecision` is pure (no clock, no IO);
  identical inputs yield a deeply-equal union, so the disposition replays exactly.
- **UDAAP:** missing affordability input fails closed to INCOMPLETE, never into a
  presented offer.

## Revisit when

- The `affordabilityBufferCents` debt-service affordability model is implemented —
  at which point `affordabilityAssessable` grows from `income > 0` into the full
  buffer test, and INCOMPLETE may carry additional missing-input fields, OR
- the canonical prequal gains nullable income (today it is non-nullable, so `≤ 0`
  is the only "missing" sentinel), OR
- the adverse-reason taxonomy this engine can emit grows beyond four distinct
  codes, making the ≤4 cull load-bearing rather than dormant.
