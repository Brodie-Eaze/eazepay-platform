/**
 * Reg B / FCRA-aligned adverse-action reason-code taxonomy. Admin
 * declines MUST select from this list. Codes are stable; do not rename.
 *
 * Each entry maps to a consumer-readable line on the Adverse Action
 * Notice — that mapping lives in services/notification (or its
 * successor compliance-document service) and is exercised at notice
 * render time. The same code may be selected by orchestration's
 * decisioning service or by an admin manual override; the surface to
 * the consumer is identical, with the actor recorded in the
 * ComplianceReview row.
 */
export const ADVERSE_ACTION_REASON_CODES = {
  // Income / capacity
  insufficient_residual_income: 'Insufficient residual income after existing obligations.',
  income_unverifiable: 'Could not verify income with the documentation provided.',
  debt_to_income_too_high: 'Debt-to-income ratio above program limits.',

  // Credit / bureau
  credit_score_below_threshold: 'Credit score below program minimum.',
  bureau_no_credit_file: 'No credit history available with consumer reporting agency.',
  bureau_recent_serious_delinquency: 'Recent serious delinquency on a credit report.',
  bureau_charge_off: 'Charge-off on a recent obligation.',

  // Identity / fraud / sanctions
  identity_unverifiable: 'Could not verify identity from the information provided.',
  ofac_sanctions_match: 'Match against a US sanctions list.',
  fraud_signals: 'Information provided does not align with our records.',

  // Program eligibility
  amount_above_program_cap: 'Requested amount exceeds program limit.',
  term_outside_program_range: 'Requested term is outside program limits.',
  state_not_supported: 'Program not currently available in your state.',
  age_below_eligibility: 'Applicant below minimum eligible age.',

  // Policy
  no_lender_program_match: 'No lender program currently matches this application.',
  prior_charge_off_with_us: 'Prior charge-off with EazePay or partner bank.',

  // Catch-alls (use sparingly; specificity protects ECOA defensibility)
  underwriting_policy_other: 'Underwriting policy reasons not enumerated above.',
} as const;

export type AdverseActionReasonCode = keyof typeof ADVERSE_ACTION_REASON_CODES;

export const isValidReasonCode = (s: string): s is AdverseActionReasonCode =>
  s in ADVERSE_ACTION_REASON_CODES;
