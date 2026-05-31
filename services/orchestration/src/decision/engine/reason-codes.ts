/**
 * Canonical CFPB Reg B / Model Form C-1 adverse-action reason codes.
 *
 * This is a CLOSED set. These are the only labels that may appear on a
 * 12 CFR 1002.9(a)(2) adverse-action notice. Internal engineering codes
 * (e.g. `tier_mismatch:C`, `brand_mismatch:medpay`) must NEVER be shown
 * to a consumer and must NEVER be added to this union — they are mapped
 * to one of these codes by the reason-mapping layer (P5).
 *
 * Mirrors `RegBReasonCode` in apps/partner-portal/lib/decision-engine.ts.
 * Services cannot import from `apps/`, so this is the canonical copy the
 * `/v1/decide` response serialises against; the two must stay byte-equal.
 */
export const REG_B_REASON_CODES = [
  'INCOME_INSUFFICIENT',
  'CREDIT_HISTORY_INSUFFICIENT',
  'CREDIT_PROFILE_NEGATIVE',
  'DTI_EXCESSIVE',
  'RESIDENCE_DURATION',
  'EMPLOYMENT_DURATION',
  'GEOGRAPHY',
  'LOAN_AMOUNT_TOO_SMALL',
  'LOAN_AMOUNT_TOO_LARGE',
] as const;

export type RegBReasonCode = (typeof REG_B_REASON_CODES)[number];

const REG_B_REASON_CODE_SET: ReadonlySet<string> = new Set(REG_B_REASON_CODES);

/** Runtime guard — a string is a valid Reg B code only if it is in the closed set. */
export function isRegBReasonCode(value: string): value is RegBReasonCode {
  return REG_B_REASON_CODE_SET.has(value);
}
