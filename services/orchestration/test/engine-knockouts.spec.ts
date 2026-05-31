import { describe, expect, it } from 'vitest';
import {
  ENGINE_CONFIG_V1,
  KNOCKOUT_META,
  evaluateLenderKnockouts,
  evaluateProgramEnvelope,
  exceedsMlaMaprCap,
  isRegBReasonCode,
  tierEstimatedMaxAprBps,
  type CanonicalPrequal,
  type CatalogProductFingerprint,
  type EngineConfig,
  type InternalReasonCode,
} from '../src/decision/engine/index.js';

/** Baseline applicant: tier B, TX, direct brand, $10,000 requested. */
const prequal: CanonicalPrequal = {
  tier: 'B',
  ficoBand: 720,
  dti: 0.32,
  openTradelines: 6,
  amountCents: 1_000_000,
  annualIncomeCents: 9_600_000,
  state: 'TX',
  brand: 'direct',
};

/** Baseline product the applicant clears on every hard rule. */
const product: CatalogProductFingerprint = {
  lenderProductId: 'lp_ok',
  lenderId: 'l_ok',
  tier: 'B',
  minAmountCents: '50000',
  maxAmountCents: '2000000',
  minTermMonths: 3,
  maxTermMonths: 60,
  permittedStates: ['TX', 'CA'],
  permittedBrands: [], // all brands
  enabled: true,
  priority: 10,
};

describe('evaluateProgramEnvelope', () => {
  it('passes an amount inside the program envelope', () => {
    expect(evaluateProgramEnvelope(prequal, ENGINE_CONFIG_V1)).toEqual({ eligible: true });
  });

  it('knocks out an amount above the program cap', () => {
    const over = { ...prequal, amountCents: 10_000_001 }; // > $100,000
    expect(evaluateProgramEnvelope(over, ENGINE_CONFIG_V1)).toEqual({
      eligible: false,
      reasonCode: 'amount_above_program_cap',
    });
  });

  it('knocks out an amount below a configured program floor', () => {
    const withFloor: EngineConfig = {
      ...ENGINE_CONFIG_V1,
      envelope: { ...ENGINE_CONFIG_V1.envelope, minAmountCents: '100000' },
    };
    const tooSmall = { ...prequal, amountCents: 50_000 };
    expect(evaluateProgramEnvelope(tooSmall, withFloor)).toEqual({
      eligible: false,
      reasonCode: 'amount_below_program_floor',
    });
  });

  it('does NOT apply the MLA cap to a non-covered (civilian) borrower', () => {
    const overCap: EngineConfig = {
      ...ENGINE_CONFIG_V1,
      tiers: {
        ...ENGINE_CONFIG_V1.tiers,
        B: { ...ENGINE_CONFIG_V1.tiers.B, aprBandBps: { minBps: 3000, maxBps: 3700 } },
      },
    };
    // Over-cap tier band, but borrower not flagged MLA-covered → eligible.
    expect(evaluateProgramEnvelope(prequal, overCap)).toEqual({ eligible: true });
    expect(evaluateProgramEnvelope(prequal, overCap, { mlaCovered: false })).toEqual({
      eligible: true,
    });
  });

  it('applies the 36% MLA cap to a covered borrower whose tier exceeds it', () => {
    const overCap: EngineConfig = {
      ...ENGINE_CONFIG_V1,
      tiers: {
        ...ENGINE_CONFIG_V1.tiers,
        B: { ...ENGINE_CONFIG_V1.tiers.B, aprBandBps: { minBps: 3000, maxBps: 3700 } },
      },
    };
    expect(evaluateProgramEnvelope(prequal, overCap, { mlaCovered: true })).toEqual({
      eligible: false,
      reasonCode: 'mla_mapr_cap_exceeded',
    });
  });

  it('clears a covered borrower whose tier is under the cap (v1 config)', () => {
    // Every v1 tier band max is <= 3600, so MLA never fires even when covered.
    expect(evaluateProgramEnvelope(prequal, ENGINE_CONFIG_V1, { mlaCovered: true })).toEqual({
      eligible: true,
    });
  });
});

describe('evaluateLenderKnockouts', () => {
  it('passes a product the applicant clears', () => {
    expect(evaluateLenderKnockouts(prequal, product)).toEqual({ eligible: true });
  });

  it('knocks out a brand the product does not serve', () => {
    const medpayOnly = { ...product, permittedBrands: ['medpay' as const] };
    expect(evaluateLenderKnockouts(prequal, medpayOnly)).toEqual({
      eligible: false,
      reasonCode: 'brand_mismatch',
    });
  });

  it('treats an empty brand allowlist as serving every brand', () => {
    expect(evaluateLenderKnockouts({ ...prequal, brand: 'coachpay' }, product)).toEqual({
      eligible: true,
    });
  });

  it('knocks out a state the product is not licensed in', () => {
    const noTx = { ...product, permittedStates: ['CA', 'NY'] };
    expect(evaluateLenderKnockouts(prequal, noTx)).toEqual({
      eligible: false,
      reasonCode: 'state_not_permitted',
    });
  });

  it('treats an empty state list as nationwide', () => {
    const nationwide = { ...product, permittedStates: [] };
    expect(evaluateLenderKnockouts({ ...prequal, state: 'WY' }, nationwide)).toEqual({
      eligible: true,
    });
  });

  it('knocks out a tier mismatch', () => {
    const tierA = { ...product, tier: 'A' };
    expect(evaluateLenderKnockouts(prequal, tierA)).toEqual({
      eligible: false,
      reasonCode: 'tier_mismatch',
    });
  });

  it('knocks out an amount below the per-lender minimum', () => {
    expect(evaluateLenderKnockouts({ ...prequal, amountCents: 10_000 }, product)).toEqual({
      eligible: false,
      reasonCode: 'amount_below_min',
    });
  });

  it('knocks out an amount above the per-lender maximum', () => {
    expect(evaluateLenderKnockouts({ ...prequal, amountCents: 3_000_000 }, product)).toEqual({
      eligible: false,
      reasonCode: 'amount_above_max',
    });
  });

  it('returns the first failing rule in fixed order (brand before amount)', () => {
    const brandAndAmount = { ...product, permittedBrands: ['medpay' as const] };
    // Also out of amount range, but brand is checked first and suppresses.
    expect(evaluateLenderKnockouts({ ...prequal, amountCents: 9_000_000 }, brandAndAmount)).toEqual(
      {
        eligible: false,
        reasonCode: 'brand_mismatch',
      },
    );
  });

  it('returns geography before tier when both fail', () => {
    const noTxWrongTier = { ...product, permittedStates: ['CA'], tier: 'A' };
    expect(evaluateLenderKnockouts(prequal, noTxWrongTier)).toEqual({
      eligible: false,
      reasonCode: 'state_not_permitted',
    });
  });
});

describe('KNOCKOUT_META — honest internal→Reg B mapping', () => {
  it('suppresses brand_mismatch as no_offer (NOT the legacy GEOGRAPHY defect)', () => {
    expect(KNOCKOUT_META.brand_mismatch).toEqual({ disposition: 'no_offer', regBReasonCode: null });
    expect(KNOCKOUT_META.brand_mismatch.regBReasonCode).not.toBe('GEOGRAPHY');
  });

  it('suppresses an MLA cap breach as no_offer (lender cannot lend, not consumer fault)', () => {
    expect(KNOCKOUT_META.mla_mapr_cap_exceeded).toEqual({
      disposition: 'no_offer',
      regBReasonCode: null,
    });
  });

  it('uses GEOGRAPHY only for a real state-licensing knockout', () => {
    expect(KNOCKOUT_META.state_not_permitted).toEqual({
      disposition: 'adverse_action',
      regBReasonCode: 'GEOGRAPHY',
    });
  });

  it('maps amount knockouts to the correct directional Reg B codes', () => {
    expect(KNOCKOUT_META.amount_below_min.regBReasonCode).toBe('LOAN_AMOUNT_TOO_SMALL');
    expect(KNOCKOUT_META.amount_above_max.regBReasonCode).toBe('LOAN_AMOUNT_TOO_LARGE');
    expect(KNOCKOUT_META.amount_below_program_floor.regBReasonCode).toBe('LOAN_AMOUNT_TOO_SMALL');
    expect(KNOCKOUT_META.amount_above_program_cap.regBReasonCode).toBe('LOAN_AMOUNT_TOO_LARGE');
  });

  it('every code has meta; adverse_action carries a valid Reg B code, no_offer carries null', () => {
    const codes: InternalReasonCode[] = [
      'brand_mismatch',
      'state_not_permitted',
      'tier_mismatch',
      'amount_below_min',
      'amount_above_max',
      'amount_below_program_floor',
      'amount_above_program_cap',
      'mla_mapr_cap_exceeded',
    ];
    for (const code of codes) {
      const meta = KNOCKOUT_META[code];
      expect(meta).toBeTruthy();
      if (meta.disposition === 'adverse_action') {
        expect(meta.regBReasonCode).not.toBeNull();
        expect(isRegBReasonCode(meta.regBReasonCode as string)).toBe(true);
      } else {
        expect(meta.regBReasonCode).toBeNull();
      }
    }
  });
});

describe('MLA cap primitives', () => {
  it('treats exactly 3600 bps (36%) as within the cap, 3601 as exceeding', () => {
    expect(exceedsMlaMaprCap(3600, ENGINE_CONFIG_V1)).toBe(false);
    expect(exceedsMlaMaprCap(3601, ENGINE_CONFIG_V1)).toBe(true);
  });

  it('reads the tier worst-case APR band from the config', () => {
    expect(tierEstimatedMaxAprBps('D', ENGINE_CONFIG_V1)).toBe(3599);
    expect(tierEstimatedMaxAprBps('A', ENGINE_CONFIG_V1)).toBe(1499);
  });
});
