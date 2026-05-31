import type { CanonicalPrequal, ConsumerTier } from './financials.js';
import type { EngineConfig } from './config.js';
import type { RegBReasonCode } from './reason-codes.js';
import type { CatalogProductFingerprint } from './snapshot.js';

/**
 * Internal hard-eligibility knockout codes. These are ENGINEERING codes —
 * they record which rule fired and are NEVER shown to a consumer. The
 * mapping layer (KNOCKOUT_META) resolves each either to a CFPB Reg B code
 * (adverse_action dispositions) or to nothing (no_offer dispositions,
 * which are suppressed and never reach an adverse-action notice).
 */
export type InternalReasonCode =
  | 'brand_mismatch'
  | 'state_not_permitted'
  | 'tier_mismatch'
  | 'amount_below_min'
  | 'amount_above_max'
  | 'amount_below_program_floor'
  | 'amount_above_program_cap'
  | 'mla_mapr_cap_exceeded';

/**
 * How a knockout is surfaced to the consumer:
 *   adverse_action — a legitimate ECOA/Reg B reason that may appear on a
 *     12 CFR 1002.9 notice (carries a RegBReasonCode).
 *   no_offer — a marketplace or legal fact about the LENDER, not the
 *     consumer's creditworthiness. It is suppressed: the lender does not
 *     appear, and it is NEVER counted toward the consumer's adverse-action
 *     reasons (ADR-0029).
 */
export type KnockoutDisposition = 'adverse_action' | 'no_offer';

export interface KnockoutMeta {
  disposition: KnockoutDisposition;
  /** Reg B code for adverse_action; null for no_offer (never shown). */
  regBReasonCode: RegBReasonCode | null;
}

/**
 * The honest internal→Reg B mapping. Two deliberate corrections over the
 * legacy portal mapper (apps/partner-portal/lib/decision-engine.ts
 * internalReasonToRegB):
 *   • brand_mismatch is no_offer, NOT GEOGRAPHY. A lender that does not
 *     serve a brand vertical is a routing fact; telling the consumer "we
 *     do not grant credit in your state" would be a falsehood (the legacy
 *     defect). The lender is suppressed instead.
 *   • mla_mapr_cap_exceeded is no_offer. A rate above the 36% MLA cap
 *     (32 CFR 232) means the LENDER legally cannot lend to a covered
 *     borrower — it is not a statement about the consumer's credit.
 * state_not_permitted is the ONE honest GEOGRAPHY use — a real state
 * licensing boundary.
 */
export const KNOCKOUT_META: Record<InternalReasonCode, KnockoutMeta> = {
  brand_mismatch: { disposition: 'no_offer', regBReasonCode: null },
  mla_mapr_cap_exceeded: { disposition: 'no_offer', regBReasonCode: null },
  state_not_permitted: { disposition: 'adverse_action', regBReasonCode: 'GEOGRAPHY' },
  tier_mismatch: { disposition: 'adverse_action', regBReasonCode: 'CREDIT_PROFILE_NEGATIVE' },
  amount_below_min: { disposition: 'adverse_action', regBReasonCode: 'LOAN_AMOUNT_TOO_SMALL' },
  amount_above_max: { disposition: 'adverse_action', regBReasonCode: 'LOAN_AMOUNT_TOO_LARGE' },
  amount_below_program_floor: {
    disposition: 'adverse_action',
    regBReasonCode: 'LOAN_AMOUNT_TOO_SMALL',
  },
  amount_above_program_cap: {
    disposition: 'adverse_action',
    regBReasonCode: 'LOAN_AMOUNT_TOO_LARGE',
  },
};

export type KnockoutOutcome =
  | { eligible: true }
  | { eligible: false; reasonCode: InternalReasonCode };

/** True when an estimated all-in APR breaches the MLA 36% MAPR cap. */
export function exceedsMlaMaprCap(estimatedAprBps: number, config: EngineConfig): boolean {
  return estimatedAprBps > config.mlaMaprCapBps;
}

/** Estimated worst-case APR (bps) a tier would see, per the pinned config. */
export function tierEstimatedMaxAprBps(tier: ConsumerTier, config: EngineConfig): number {
  return config.tiers[tier].aprBandBps.maxBps;
}

export interface ProgramEvaluationOpts {
  /**
   * Whether the borrower is MLA-covered (active-duty servicemember or a
   * dependent, per a DMDC lookup). This is NOT part of the canonical
   * prequal — it arrives with the credit pull (ADR-0030). Defaults to
   * false so the 36% cap never over-blocks a civilian applicant.
   */
  mlaCovered?: boolean;
}

/**
 * Program-wide hard gate, evaluated once per application before any
 * lender. Fixed-point: money is compared as integer cents via BigInt,
 * never float, so the include/exclude boundary is byte-identical on
 * replay (ADR-0028). Term is not evaluated here — the canonical prequal
 * carries no term (drop-in parity with the portal payload); the config's
 * term envelope is reserved for future term-aware requests and is already
 * bound into the catalog fingerprint.
 */
export function evaluateProgramEnvelope(
  prequal: CanonicalPrequal,
  config: EngineConfig,
  opts: ProgramEvaluationOpts = {},
): KnockoutOutcome {
  const amount = BigInt(prequal.amountCents);
  if (amount < BigInt(config.envelope.minAmountCents)) {
    return { eligible: false, reasonCode: 'amount_below_program_floor' };
  }
  if (amount > BigInt(config.envelope.maxAmountCents)) {
    return { eligible: false, reasonCode: 'amount_above_program_cap' };
  }
  if (opts.mlaCovered && exceedsMlaMaprCap(tierEstimatedMaxAprBps(prequal.tier, config), config)) {
    return { eligible: false, reasonCode: 'mla_mapr_cap_exceeded' };
  }
  return { eligible: true };
}

/**
 * Per-lender hard-eligibility knockouts against ONE catalog product.
 * Returns the FIRST failing rule in a fixed, documented order so an
 * excluded lender carries exactly one deterministic reason; the
 * aggregation layer (P5) collects reasons across all lenders and reduces
 * them to ≤4 principal reasons for the notice.
 *
 * Order — brand (suppress) → geography → tier → amount: whether the
 * lender can serve this consumer at all is decided before amount-fit, so
 * the surfaced reason is the most fundamental mismatch.
 *
 * Preconditions: the product is enabled (the fan-out lists only enabled
 * products) and the program envelope already passed. The product's amount
 * bounds are the tighter, per-lender envelope.
 */
export function evaluateLenderKnockouts(
  prequal: CanonicalPrequal,
  product: CatalogProductFingerprint,
): KnockoutOutcome {
  if (product.permittedBrands.length > 0 && !product.permittedBrands.includes(prequal.brand)) {
    return { eligible: false, reasonCode: 'brand_mismatch' };
  }
  if (product.permittedStates.length > 0 && !product.permittedStates.includes(prequal.state)) {
    return { eligible: false, reasonCode: 'state_not_permitted' };
  }
  if (product.tier !== prequal.tier) {
    return { eligible: false, reasonCode: 'tier_mismatch' };
  }
  const amount = BigInt(prequal.amountCents);
  if (amount < BigInt(product.minAmountCents)) {
    return { eligible: false, reasonCode: 'amount_below_min' };
  }
  if (amount > BigInt(product.maxAmountCents)) {
    return { eligible: false, reasonCode: 'amount_above_max' };
  }
  return { eligible: true };
}
