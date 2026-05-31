import { describe, expect, it } from 'vitest';
import {
  ENGINE_CONFIG_V1,
  MAX_PRINCIPAL_REASONS,
  REG_B_PRINCIPAL_TEXT,
  affordabilityAssessable,
  aggregateDecision,
  aggregateRegBReasons,
  isIncludedLender,
  runDecision,
  type CanonicalPrequal,
  type CatalogProductFingerprint,
  type EngineConfig,
  type ExcludedLender,
  type RegBReasonCode,
} from '../src/decision/engine/index.js';

/** Baseline applicant: tier B, TX, direct, $10,000, income $96k (> 0). */
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
/** Same applicant with income absent — affordability unassessable. */
const noIncome: CanonicalPrequal = { ...prequal, annualIncomeCents: 0 };
/** A thin file: no FICO / DTI / tradelines, but a valid tier. NOT a decline. */
const thinFile: CanonicalPrequal = {
  ...prequal,
  ficoBand: null,
  dti: null,
  openTradelines: null,
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
const tierMissA = mk({ lenderProductId: 'lp_a1', lenderId: 'l_a1', tier: 'A' });
const tierMissA2 = mk({ lenderProductId: 'lp_a2', lenderId: 'l_a2', tier: 'A' });
const stateMiss = mk({ lenderProductId: 'lp_st', lenderId: 'l_st', permittedStates: ['CA', 'NY'] });
const brandMiss1 = mk({
  lenderProductId: 'lp_br1',
  lenderId: 'l_br1',
  permittedBrands: ['medpay'],
});
const brandMiss2 = mk({
  lenderProductId: 'lp_br2',
  lenderId: 'l_br2',
  permittedBrands: ['medpay'],
});

const decide = (p: CanonicalPrequal, catalog: readonly CatalogProductFingerprint[], opts = {}) =>
  aggregateDecision(p, runDecision(p, catalog, opts));

const ex = (regBReasonCode: RegBReasonCode, lenderId = 'l'): ExcludedLender => ({
  included: false,
  lenderId,
  displayName: lenderId,
  reasonCode: 'internal',
  regBReasonCode,
  principalReasonText: REG_B_PRINCIPAL_TEXT[regBReasonCode],
});

describe('aggregateDecision — OFFERS', () => {
  it('returns OFFERS with the ranked included lenders when ≥1 lender matches', () => {
    const result = decide(prequal, [included1, included2]);
    expect(result.disposition).toBe('OFFERS');
    if (result.disposition !== 'OFFERS') throw new Error('unreachable');
    expect(result.offers).toHaveLength(2);
    expect(result.offers.every(isIncludedLender)).toBe(true);
    expect(result.offers.map((o) => o.rank)).toEqual([1, 2]);
  });

  it('treats a thin file as a routable applicant, NOT a decline (offers when eligible)', () => {
    const result = decide(thinFile, [included1, included2]);
    expect(result.disposition).toBe('OFFERS');
  });
});

describe('aggregateDecision — INCOMPLETE (no fail-open)', () => {
  it('refuses to present offers when income is missing — INCOMPLETE, not OFFERS', () => {
    const result = decide(noIncome, [included1, included2]);
    expect(result).toEqual({ disposition: 'INCOMPLETE', incompleteFields: ['annualIncomeCents'] });
  });

  it('fires INCOMPLETE only when missing income is PIVOTAL (lenders matched)', () => {
    // No matching lender → income is not pivotal → honest adverse action, not INCOMPLETE.
    const result = decide(noIncome, [tierMissA, tierMissA2]);
    expect(result.disposition).toBe('ADVERSE_ACTION');
  });
});

describe('aggregateDecision — ADVERSE_ACTION', () => {
  it('surfaces honest aggregated reasons when no lender matches', () => {
    const result = decide(prequal, [tierMissA, tierMissA2]);
    expect(result).toEqual({
      disposition: 'ADVERSE_ACTION',
      reasonCodes: ['CREDIT_PROFILE_NEGATIVE'],
    });
  });

  it('orders reasons by causation frequency first (most-blocking reason leads)', () => {
    // 2× tier_mismatch (CREDIT_PROFILE_NEGATIVE) + 1× state (GEOGRAPHY).
    // Frequency beats proximity: CPN (freq 2) leads GEOGRAPHY (freq 1, higher priority).
    const result = decide(prequal, [tierMissA, tierMissA2, stateMiss]);
    expect(result.disposition).toBe('ADVERSE_ACTION');
    if (result.disposition !== 'ADVERSE_ACTION') throw new Error('unreachable');
    expect(result.reasonCodes).toEqual(['CREDIT_PROFILE_NEGATIVE', 'GEOGRAPHY']);
  });

  it('breaks a frequency tie by knockout-proximity priority', () => {
    // 1× tier (CPN, priority 2) + 1× state (GEOGRAPHY, priority 1) → GEOGRAPHY first.
    const result = decide(prequal, [tierMissA, stateMiss]);
    expect(result.disposition).toBe('ADVERSE_ACTION');
    if (result.disposition !== 'ADVERSE_ACTION') throw new Error('unreachable');
    expect(result.reasonCodes).toEqual(['GEOGRAPHY', 'CREDIT_PROFILE_NEGATIVE']);
  });
});

describe('aggregateDecision — NO_OFFER (suppression, ADR-0029)', () => {
  it('returns NO_OFFER with no reasons when every lender is a brand-mismatch suppression', () => {
    const result = decide(prequal, [brandMiss1, brandMiss2]);
    expect(result).toEqual({ disposition: 'NO_OFFER' });
  });

  it('returns NO_OFFER when an MLA-covered borrower breaches the 36% cap', () => {
    const overCap: EngineConfig = {
      ...ENGINE_CONFIG_V1,
      tiers: {
        ...ENGINE_CONFIG_V1.tiers,
        B: { ...ENGINE_CONFIG_V1.tiers.B, aprBandBps: { minBps: 3000, maxBps: 3700 } },
      },
    };
    const result = decide(prequal, [included1, included2], { mlaCovered: true, config: overCap });
    expect(result).toEqual({ disposition: 'NO_OFFER' });
  });

  it('stays NO_OFFER (income is moot) when all lenders are suppressed AND income is missing', () => {
    const result = decide(noIncome, [brandMiss1, brandMiss2]);
    expect(result).toEqual({ disposition: 'NO_OFFER' });
  });
});

describe('aggregateDecision — determinism (ADR-0028)', () => {
  it('yields a deeply-equal disposition for identical inputs', () => {
    const rr = runDecision(prequal, [tierMissA, tierMissA2, stateMiss]);
    expect(aggregateDecision(prequal, rr)).toEqual(aggregateDecision(prequal, rr));
  });
});

describe('aggregateRegBReasons — ordering + ≤4 cap', () => {
  it('returns [] for an empty excluded set', () => {
    expect(aggregateRegBReasons([])).toEqual([]);
  });

  it('orders by frequency descending', () => {
    const excluded = [
      ex('GEOGRAPHY'),
      ex('GEOGRAPHY'),
      ex('GEOGRAPHY'),
      ex('CREDIT_PROFILE_NEGATIVE'),
    ];
    expect(aggregateRegBReasons(excluded)).toEqual(['GEOGRAPHY', 'CREDIT_PROFILE_NEGATIVE']);
  });

  it('caps at four principal reasons, dropping the lowest-priority overflow', () => {
    // Five distinct codes, all frequency 1 → priority order, 5th (rank 5) culled.
    const excluded = [
      ex('INCOME_INSUFFICIENT'), // priority 5 — the overflow that must drop
      ex('LOAN_AMOUNT_TOO_LARGE'), // 4
      ex('LOAN_AMOUNT_TOO_SMALL'), // 3
      ex('CREDIT_PROFILE_NEGATIVE'), // 2
      ex('GEOGRAPHY'), // 1
    ];
    const reasons = aggregateRegBReasons(excluded);
    expect(reasons).toHaveLength(MAX_PRINCIPAL_REASONS);
    expect(reasons).toEqual([
      'GEOGRAPHY',
      'CREDIT_PROFILE_NEGATIVE',
      'LOAN_AMOUNT_TOO_SMALL',
      'LOAN_AMOUNT_TOO_LARGE',
    ]);
    expect(reasons).not.toContain('INCOME_INSUFFICIENT');
  });
});

describe('affordabilityAssessable', () => {
  it('is false only when income is absent (≤ 0)', () => {
    expect(affordabilityAssessable(prequal)).toBe(true);
    expect(affordabilityAssessable({ ...prequal, annualIncomeCents: 1 })).toBe(true);
    expect(affordabilityAssessable(noIncome)).toBe(false);
  });
});
