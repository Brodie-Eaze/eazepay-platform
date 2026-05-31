import { describe, expect, it } from 'vitest';
import {
  compareToLegacy,
  runDecision,
  type CanonicalPrequal,
  type CatalogProductFingerprint,
} from '../src/decision/engine/index.js';

/**
 * P7a — shadow comparator. Pure set-math over a legacy view and the new
 * engine's wire response, with brand/MLA suppressions subtracted so a
 * principled ADR-0029 difference is never reported as a regression.
 */

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

const baseProduct: CatalogProductFingerprint = {
  lenderProductId: 'lp_base',
  lenderId: 'l_base',
  tier: 'B',
  minAmountCents: '50000',
  maxAmountCents: '2000000',
  minTermMonths: 3,
  maxTermMonths: 60,
  permittedStates: ['TX', 'CA'],
  permittedBrands: [],
  enabled: true,
  priority: 10,
};
const mk = (o: Partial<CatalogProductFingerprint>): CatalogProductFingerprint => ({
  ...baseProduct,
  ...o,
});

const included1 = mk({ lenderProductId: 'lp_b1', lenderId: 'l_b1', priority: 10 });
const included2 = mk({ lenderProductId: 'lp_b2', lenderId: 'l_b2', priority: 5 });
/** Serves medpay only — a 'direct' applicant is a brand_mismatch → suppressed. */
const brandMiss = mk({
  lenderProductId: 'lp_br',
  lenderId: 'l_brand',
  permittedBrands: ['medpay'],
});
/** Permitted in CA/NY only — a TX applicant is GEOGRAPHY (adverse, surfaced). */
const stateMiss = mk({ lenderProductId: 'lp_st', lenderId: 'l_st', permittedStates: ['CA', 'NY'] });

describe('compareToLegacy — included set', () => {
  it('matches when both offer the same lenders, order-independently', () => {
    const engine = runDecision(prequal, [included1, included2]).response;
    const result = compareToLegacy({
      legacy: { includedLenderIds: ['l_b2', 'l_b1'] },
      engine,
    });
    expect(result.matches).toBe(true);
    expect(result.missingFromEngine).toEqual([]);
    expect(result.extraInEngine).toEqual([]);
  });

  it('flags a lender the engine dropped that is NOT a known suppression', () => {
    const engine = runDecision(prequal, [included1]).response;
    const result = compareToLegacy({
      legacy: { includedLenderIds: ['l_b1', 'l_ghost'] },
      engine,
    });
    expect(result.matches).toBe(false);
    expect(result.missingFromEngine).toEqual(['l_ghost']);
  });

  it('flags a lender the engine added that legacy did not offer', () => {
    const engine = runDecision(prequal, [included1, included2]).response;
    const result = compareToLegacy({
      legacy: { includedLenderIds: ['l_b1'] },
      engine,
    });
    expect(result.matches).toBe(false);
    expect(result.extraInEngine).toEqual(['l_b2']);
  });
});

describe('compareToLegacy — suppressions are not regressions', () => {
  it('rescues the match when a dropped lender is a known brand suppression', () => {
    // The engine suppresses the brand-mismatched lender entirely (not in the
    // response); legacy offered it. Declaring it suppressed restores the match.
    const engine = runDecision(prequal, [included1, brandMiss]).response;
    expect(engine.rankedLenders.some((l) => l.lenderId === 'l_brand')).toBe(false);

    const withoutSuppression = compareToLegacy({
      legacy: { includedLenderIds: ['l_b1', 'l_brand'] },
      engine,
    });
    expect(withoutSuppression.matches).toBe(false);
    expect(withoutSuppression.missingFromEngine).toEqual(['l_brand']);

    const withSuppression = compareToLegacy({
      legacy: { includedLenderIds: ['l_b1', 'l_brand'] },
      engine,
      suppressedLenderIds: ['l_brand'],
    });
    expect(withSuppression.matches).toBe(true);
    expect(withSuppression.missingFromEngine).toEqual([]);
    expect(withSuppression.suppressed).toEqual(['l_brand']);
  });
});

describe('compareToLegacy — reason codes', () => {
  it('agrees when legacy supplies matching reason codes', () => {
    const engine = runDecision(prequal, [stateMiss]).response;
    const result = compareToLegacy({
      legacy: { includedLenderIds: [], reasonCodes: ['GEOGRAPHY'] },
      engine,
    });
    expect(result.matches).toBe(true);
    expect(result.reasonCodeDivergence).toEqual([]);
  });

  it('flags a reason-code divergence as a symmetric difference', () => {
    const engine = runDecision(prequal, [stateMiss]).response; // engine surfaces GEOGRAPHY
    const result = compareToLegacy({
      legacy: { includedLenderIds: [], reasonCodes: ['DTI_EXCESSIVE'] },
      engine,
    });
    expect(result.matches).toBe(false);
    expect(result.reasonCodeDivergence).toEqual(['DTI_EXCESSIVE', 'GEOGRAPHY']);
  });

  it('does not compare reason codes when legacy omits them', () => {
    const engine = runDecision(prequal, [stateMiss]).response;
    const result = compareToLegacy({
      legacy: { includedLenderIds: [] },
      engine,
    });
    expect(result.reasonCodeDivergence).toEqual([]);
    expect(result.matches).toBe(true);
  });
});
