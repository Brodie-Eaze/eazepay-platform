import type { RegBReasonCode } from './reason-codes.js';
import type { CanonicalPrequal } from './financials.js';
import { isIncludedLender, type ExcludedLender, type IncludedLender } from './wire.js';
import type { RunDecisionResult } from './decide.js';

/**
 * Reason aggregation + consumer-disposition taxonomy (P5, ADR-0032).
 *
 * runDecision (P4) returns a MECHANICAL rankedLenders list and defers the
 * consumer meaning of "no offer" to this layer. Reg B (12 CFR 1002.9) does
 * not have one "denied" state — it has distinct legal dispositions, and
 * conflating them is a violation:
 *
 *   OFFERS         — at least one included lender, affordability assessable.
 *   INCOMPLETE     — 1002.9(c): a required input is missing AND pivotal;
 *                    fail-closed, never fail-open into a presented offer.
 *   ADVERSE_ACTION — 1002.9(a): a credit denial with ≤4 specific principal
 *                    reasons (1002.9(b)(2)) from the closed Model Form C-1 set.
 *   NO_OFFER       — every lender was suppressed (brand_mismatch / MLA cap,
 *                    ADR-0029); a marketplace/legal fact, NEVER a denial.
 *
 * Pure and deterministic (ADR-0028): no clock, no IO, no randomness, so the
 * disposition replays byte-identically. This layer emits the ORDERED Reg B
 * codes; the P7 handler is the seam that hands them to the compliance-doc
 * buildAdverseActionNotice — keeping the timestamped notice out of the
 * replayable core.
 */

/** The four legally-distinct consumer dispositions. */
export type DecisionDisposition = AggregatedDecision['disposition'];

/**
 * Canonical fields that can be missing-yet-required. Income is the only
 * non-nullable prequal field, so `annualIncomeCents` (≤ 0) is the sole
 * affordability "missing" sentinel at v1 (ADR-0032).
 */
export type IncompleteField = 'annualIncomeCents';

/**
 * The resolved consumer disposition. A discriminated union so illegal states
 * — offers on a denial, reason codes on an approval — are unrepresentable;
 * P7 switches on `disposition`.
 */
export type AggregatedDecision =
  | { disposition: 'OFFERS'; offers: readonly IncludedLender[] }
  | { disposition: 'INCOMPLETE'; incompleteFields: readonly IncompleteField[] }
  | { disposition: 'ADVERSE_ACTION'; reasonCodes: readonly RegBReasonCode[] }
  | { disposition: 'NO_OFFER' };

/** CFPB guidance caps an adverse-action notice at four principal reasons. */
export const MAX_PRINCIPAL_REASONS = 4;

/**
 * Knockout-proximity priority — a fixed ordinal used ONLY as a tie-break
 * beneath frequency. The four codes this catalog-only engine can emit lead,
 * in the documented knockout-evaluation order (state → tier → amount-min →
 * amount-max): most-fundamental first. The remaining taxonomy members are
 * ranked after the emitted set so the comparator stays total if the engine
 * ever emits them (ADR-0032).
 */
const REG_B_CAUSATION_PRIORITY: Record<RegBReasonCode, number> = {
  GEOGRAPHY: 1,
  CREDIT_PROFILE_NEGATIVE: 2,
  LOAN_AMOUNT_TOO_SMALL: 3,
  LOAN_AMOUNT_TOO_LARGE: 4,
  INCOME_INSUFFICIENT: 5,
  CREDIT_HISTORY_INSUFFICIENT: 6,
  DTI_EXCESSIVE: 7,
  RESIDENCE_DURATION: 8,
  EMPLOYMENT_DURATION: 9,
};

/**
 * The minimum income signal required to make an affordability claim at v1.
 * Absent it, the engine fails CLOSED to INCOMPLETE rather than presenting an
 * offer it cannot stand behind (ADR-0032 "no fail-open"). This is the floor,
 * not the full affordability model — the affordabilityBufferCents debt-service
 * test will sit behind this same gate later.
 */
export function affordabilityAssessable(prequal: CanonicalPrequal): boolean {
  return prequal.annualIncomeCents > 0;
}

/**
 * Reduce the excluded set to the ≤4 principal Reg B reasons, ordered by
 * consumer-causation then knockout-proximity (ADR-0032). The excluded set is
 * already free of no_offer suppressions — P4 omits them — so every reason
 * here is an honest adverse-action reason.
 *
 * Order: frequency descending (a reason that blocks more lenders is more
 * causally responsible for the no-offer) → fixed proximity priority → code
 * string (total-order determinism). At v1 only four distinct codes exist, so
 * the cap never culls; the ordering is what matters today and the cull is
 * principled if the taxonomy grows.
 */
export function aggregateRegBReasons(excluded: readonly ExcludedLender[]): RegBReasonCode[] {
  const frequency = new Map<RegBReasonCode, number>();
  for (const lender of excluded) {
    frequency.set(lender.regBReasonCode, (frequency.get(lender.regBReasonCode) ?? 0) + 1);
  }
  return [...frequency.entries()]
    .sort(([codeA, freqA], [codeB, freqB]) => {
      if (freqA !== freqB) return freqB - freqA;
      const priorityA = REG_B_CAUSATION_PRIORITY[codeA];
      const priorityB = REG_B_CAUSATION_PRIORITY[codeB];
      if (priorityA !== priorityB) return priorityA - priorityB;
      return codeA.localeCompare(codeB);
    })
    .slice(0, MAX_PRINCIPAL_REASONS)
    .map(([code]) => code);
}

/**
 * Map a mechanical RunDecisionResult to the consumer disposition (ADR-0032).
 *
 * Precedence:
 *   1. ≥1 included lender → OFFERS, UNLESS affordability is unassessable
 *      (missing income is then pivotal) → INCOMPLETE. Never fail open.
 *   2. no included lender → aggregate honest reasons; ADVERSE_ACTION if any,
 *      else NO_OFFER (every lender was suppressed — brand-only / MLA).
 *
 * Pure: identical (prequal, runResult) yields a deeply-equal union.
 */
export function aggregateDecision(
  prequal: CanonicalPrequal,
  runResult: RunDecisionResult,
): AggregatedDecision {
  const ranked = runResult.response.rankedLenders;
  const offers = ranked.filter(isIncludedLender);

  if (offers.length > 0) {
    if (!affordabilityAssessable(prequal)) {
      return { disposition: 'INCOMPLETE', incompleteFields: ['annualIncomeCents'] };
    }
    return { disposition: 'OFFERS', offers };
  }

  const excluded = ranked.filter((r): r is ExcludedLender => !r.included);
  const reasonCodes = aggregateRegBReasons(excluded);
  if (reasonCodes.length > 0) {
    return { disposition: 'ADVERSE_ACTION', reasonCodes };
  }
  return { disposition: 'NO_OFFER' };
}
