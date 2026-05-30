import { ADVERSE_ACTION_REASON_CODES, type AdverseActionReasonCode } from '@eazepay/service-admin';

/**
 * Raw-decline-code → Reg B / FCRA taxonomy mapper (ECOA-02).
 *
 * Lender adapters, the risk gate, and the decision service emit raw,
 * operationally-named decline codes (`affordability_fail`,
 * `risk_score_below_threshold`, `adapter_timeout`, ...). NONE of those
 * raw strings are members of the consumer-facing Reg B taxonomy in
 * `@eazepay/service-admin` (`ADVERSE_ACTION_REASON_CODES`). Before this
 * mapper existed, `buildAdverseActionNotice` hard-threw on the first
 * unmapped code, and the orchestration decline arm swallowed that throw —
 * so on the single most common decline ("no lender approved") the
 * statutory §1002.9 Adverse Action Notice silently never rendered.
 *
 * This module is the ONLY place raw codes are translated to the
 * taxonomy. Each mapping below is asserted to land on a real taxonomy
 * key (`AdverseActionReasonCode`), so a typo or a taxonomy rename breaks
 * the build rather than shipping a placeholder line.
 *
 * MAPPING DISCIPLINE (Reg B §1002.9(b)(2) — specificity):
 *  - Map to the ACCURATE reason for the action taken. Generic filler
 *    ("credit policy") is itself an ECOA defect, so we never reach for
 *    `underwriting_policy_other` unless the raw code genuinely carries no
 *    more specific meaning.
 *  - OPERATIONAL failures (timeout, adapter exception, missing
 *    credentials, rate-limit, "requires manual review/underwriting",
 *    "pending") are NOT credit judgments about the applicant. They are
 *    "we could not complete processing" events. Reg B treats an
 *    incomplete/unprocessable application differently from a credit
 *    decline, and FCRA score-based reasons must not be invented where no
 *    score drove the outcome. We therefore map every operational code to
 *    `income_unverifiable`? NO — to the closest *honest* taxonomy member,
 *    documented per-entry below. Several of these are flagged for
 *    compliance-lawyer review (see PR body): the current taxonomy lacks a
 *    clean "application could not be processed / try again" member, so we
 *    map conservatively and surface the gap rather than fabricate one.
 *  - Each entry carries a one-line justification comment. Do not add a
 *    mapping without one.
 */

/**
 * Raw codes that map to an EXACT, defensible Reg B reason. These are the
 * substantive credit / eligibility judgments.
 */
const SUBSTANTIVE_MAP = {
  // --- Affordability / capacity ---------------------------------------
  // Lender adapters reject when the orchestrator's affordability signal
  // is false → the applicant's income/residual does not support the
  // requested credit. Exact Reg B capacity reason.
  affordability_fail: 'insufficient_residual_income',

  // --- Program envelope (amount / term) -------------------------------
  // Adapter-side amount ceiling breached. Same meaning as the
  // decision-service knockout `amount_above_program_cap`.
  amount_above_max: 'amount_above_program_cap',
  // Adapter-side term window breached.
  term_out_of_range: 'term_outside_program_range',

  // --- Credit / risk score --------------------------------------------
  // `risk_score_below_threshold` is a numeric credit/risk score gate. The
  // honest Reg B reason is a score reason, NOT "incomplete application".
  // Maps to the taxonomy's credit-score member.
  risk_score_below_threshold: 'credit_score_below_threshold',
  // Risk-gate device/email/phone provider "high risk" signals indicate
  // the information provided does not align with our records / external
  // signal — Reg B fraud-signal reason (NOT a credit-score reason).
  device_provider_high_risk: 'fraud_signals',
  email_provider_high_risk: 'fraud_signals',
  phone_provider_high_risk: 'fraud_signals',

  // --- Prior history ---------------------------------------------------
  // A prior charge-off with us / a partner is a specific, enumerated
  // Reg B reason.
  prior_charge_off: 'prior_charge_off_with_us',
} as const satisfies Record<string, AdverseActionReasonCode>;

/**
 * OPERATIONAL / process codes. These are NOT credit decisions about the
 * applicant — they are "we were unable to obtain a decision" events
 * (timeouts, adapter exceptions, un-provisioned lenders, rate limits,
 * manual-review hand-offs, pending states, velocity declines).
 *
 * Mapping an operational failure to a *credit* reason (e.g. "credit score
 * below minimum") would be a false statement on a statutory notice. The
 * current taxonomy's closest honest member for "could not verify / could
 * not complete" is `income_unverifiable` for verification-style failures
 * and `underwriting_policy_other` for genuinely un-categorisable
 * operational events.
 *
 * COMPLIANCE-LAWYER REVIEW REQUIRED for this whole block: the taxonomy
 * does not yet expose a dedicated "application incomplete / unable to
 * process — please re-apply" reason (Reg B contemplates a notice of
 * incompleteness under §1002.9(c) that differs from an adverse action).
 * Until that code is added, these map conservatively to
 * `underwriting_policy_other` so the consumer still receives a notice
 * within 30 days; the reason text must be reviewed before launch.
 */
const OPERATIONAL_MAP = {
  // Lender call exceeded the orchestrator 5s hard timeout. No credit
  // judgment was made. -> generic policy reason pending a dedicated
  // "unable to process" code. LAWYER REVIEW.
  adapter_timeout: 'underwriting_policy_other',
  // Adapter threw (un-provisioned credentials, network, bug). No credit
  // judgment. LAWYER REVIEW.
  adapter_exception: 'underwriting_policy_other',
  // Lender deferred to a human queue — not a synchronous decline on the
  // merits. LAWYER REVIEW (a manual-review hand-off may warrant a
  // pending/incomplete notice, not an adverse action, if it later
  // approves).
  requires_manual_review: 'underwriting_policy_other',
  requires_manual_underwriting: 'underwriting_policy_other',
  pending_manual_review: 'underwriting_policy_other',
  // Lender rate-limited us (HTTP 429). Pure operational. LAWYER REVIEW.
  rate_limited: 'underwriting_policy_other',
  // Orchestration's own internal-error code (decision/policy.ts
  // `underwriting_system_error`). System fault, not a credit judgment.
  // Declared defensively; not emitted into a decline today. LAWYER REVIEW.
  underwriting_system_error: 'underwriting_policy_other',

  // --- Risk-gate velocity (anti-fraud throttles) ----------------------
  // Velocity declines are anti-abuse throttles, not statements about the
  // applicant's creditworthiness. The honest Reg B-adjacent reason is the
  // fraud/records-mismatch member. NOT a credit-score reason. LAWYER
  // REVIEW (velocity may better fit a fraud-hold notice).
  velocity_user_24h: 'fraud_signals',
  velocity_ip_24h: 'fraud_signals',
  velocity_device_24h: 'fraud_signals',
} as const satisfies Record<string, AdverseActionReasonCode>;

/**
 * DEV-ONLY mock provider codes (mock device/identity risk adapters).
 * They only appear in non-production environments, but the AAN builder
 * must not throw if one ever leaks into a decline payload — so we map
 * them to the same honest fraud-signal reason their real counterparts use.
 * Flagged so they are obvious in audit; production should never emit them.
 */
const MOCK_MAP = {
  mock_risky_device_fingerprint: 'fraud_signals',
  mock_automated_user_agent: 'fraud_signals',
  mock_email_test_risky: 'fraud_signals',
  mock_email_disposable_domain: 'fraud_signals',
  mock_phone_test_prefix: 'fraud_signals',
  // "no signal" is the absence of a risk signal; it should never *cause* a
  // decline on its own, but if aggregated in it carries no credit meaning.
  mock_no_signal: 'underwriting_policy_other',
} as const satisfies Record<string, AdverseActionReasonCode>;

/**
 * The full raw→taxonomy table. Codes that are ALREADY valid taxonomy
 * members (e.g. the decision service emits `insufficient_residual_income`,
 * `amount_above_program_cap`, `no_lender_program_match` directly) are not
 * listed here — they pass through `normalizeDeclineCode` unchanged.
 */
export const RAW_DECLINE_CODE_MAP: Readonly<Record<string, AdverseActionReasonCode>> = {
  ...SUBSTANTIVE_MAP,
  ...OPERATIONAL_MAP,
  ...MOCK_MAP,
};

/**
 * Raw codes whose taxonomy mapping is provisional and must be signed off
 * by a compliance lawyer before launch (see per-entry notes above). The
 * PR body enumerates these; the spec asserts the set so it cannot silently
 * grow.
 */
export const LAWYER_REVIEW_REQUIRED_CODES: readonly string[] = [
  ...Object.keys(OPERATIONAL_MAP),
] as const;

export class UnmappableDeclineCodeError extends Error {
  readonly unmappedCodes: string[];
  constructor(unmappedCodes: string[]) {
    super(
      `decline_code_mapper: no Reg B taxonomy mapping for code(s) [${unmappedCodes.join(
        ', ',
      )}] — refusing to render an adverse-action notice with an unjustified reason`,
    );
    this.name = 'UnmappableDeclineCodeError';
    this.unmappedCodes = unmappedCodes;
  }
}

const isTaxonomyCode = (s: string): s is AdverseActionReasonCode =>
  s in ADVERSE_ACTION_REASON_CODES;

/**
 * Translate one raw decline code to its Reg B taxonomy code.
 *  - already-valid taxonomy code → returned unchanged
 *  - known raw code → mapped value
 *  - unknown → `null` (caller decides: aggregate then fail loud)
 *
 * Returning null (rather than throwing per-code) lets the caller collect
 * EVERY unmappable code for a single, actionable alert instead of failing
 * on the first one.
 */
export function lookupDeclineCode(raw: string): AdverseActionReasonCode | null {
  if (isTaxonomyCode(raw)) return raw;
  return RAW_DECLINE_CODE_MAP[raw] ?? null;
}

/**
 * Normalise a list of raw decline codes into a deduplicated, order-stable
 * list of valid Reg B taxonomy codes, capped at `maxCodes`
 * (Reg B §1002.9(b)(2) — at most the principal reasons; we cap at 4).
 *
 * Fails LOUD: if ANY raw code cannot be mapped, throws
 * `UnmappableDeclineCodeError` listing every offender. A statutory notice
 * must never silently degrade to a placeholder line, and an unmapped code
 * is a taxonomy gap an engineer must close — not something to paper over.
 */
export function normalizeDeclineCodes(
  rawCodes: readonly string[],
  maxCodes = 4,
): AdverseActionReasonCode[] {
  const mapped: AdverseActionReasonCode[] = [];
  const seen = new Set<AdverseActionReasonCode>();
  const unmapped: string[] = [];

  for (const raw of rawCodes) {
    const code = lookupDeclineCode(raw);
    if (code === null) {
      unmapped.push(raw);
      continue;
    }
    if (!seen.has(code)) {
      seen.add(code);
      mapped.push(code);
    }
  }

  if (unmapped.length > 0) {
    throw new UnmappableDeclineCodeError(Array.from(new Set(unmapped)));
  }
  // Defensive: an aggregate decline with zero codes must not produce a
  // blank-reason notice. Surface as unmappable (empty) so the caller
  // fails loud rather than rendering a reasonless AAN.
  if (mapped.length === 0) {
    throw new UnmappableDeclineCodeError(['<empty-reason-set>']);
  }

  return mapped.slice(0, maxCodes);
}
