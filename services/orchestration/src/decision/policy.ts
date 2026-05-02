/**
 * Decisioning policy version. Bump on every material change.
 *
 * Every decision row written to the DB stores this version so that any
 * past Adverse Action notice can be reproduced exactly from the input
 * snapshot + this code path. SR 11-7-aligned model risk discipline.
 */
export const POLICY_VERSION = '2026.05.02-mvp1';

export const HARD_KNOCKOUTS = {
  /** $100,000.00 ceiling at MVP — first state-rules iteration only. */
  maxAmountCents: 10_000_000n,
  /** 84 months — common AU/US installment ceiling. */
  maxTermMonths: 84,
  /** Minimum allowed term in months. */
  minTermMonths: 3,
} as const;

/** ECOA/Reg B Adverse Action reason codes our orchestration emits.
 *  Mapped to consumer-readable strings at notice generation time, NOT
 *  here — this list is the audit-stable taxonomy. */
export const REASON_CODES = {
  amountAboveCap: 'amount_above_program_cap',
  termOutOfRange: 'term_outside_program_range',
  affordabilityFail: 'insufficient_residual_income',
  noEligibleLender: 'no_lender_program_match',
  underwritingError: 'underwriting_system_error',
} as const;
