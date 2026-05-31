import { describe, expect, it } from 'vitest';
import {
  ENGINE_CONFIG_V1,
  scorePropensity,
  type CanonicalPrequal,
  type EngineConfig,
} from '../src/decision/engine/index.js';

/** Baseline applicant: tier B, FICO 720, DTI 0.32, 6 tradelines, $10,000. */
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

describe('scorePropensity — fixed-point accumulation', () => {
  it('anchors on the tier base and applies each config weight', () => {
    // base 7500 + fico (720-300)*10=4200 − dti 32*50=1600 + tradelines 6*100=600
    // = 10700 raw → clamp to 10000 → 100.
    const s = scorePropensity(prequal, ENGINE_CONFIG_V1);
    expect(s.baseScoreScaled).toBe(7500);
    expect(s.contributions).toEqual([
      { factor: 'fico_above_floor', deltaScaled: 4200 },
      { factor: 'dti_penalty', deltaScaled: -1600 },
      { factor: 'open_tradelines', deltaScaled: 600 },
    ]);
    expect(s.internalScoreScaled).toBe(10000);
    expect(s.clamped).toBe(true);
    expect(s.propensityScore).toBe(100);
    expect(s.scoreScale).toBe(100);
  });

  it('scores a lower-tier profile without clamping', () => {
    // D base 4500 + fico (580-300)*10=2800 − dti 55*50=2750 + tradelines 2*100=200
    // = 4750 raw → 47.
    const d: CanonicalPrequal = {
      ...prequal,
      tier: 'D',
      ficoBand: 580,
      dti: 0.55,
      openTradelines: 2,
    };
    const s = scorePropensity(d, ENGINE_CONFIG_V1);
    expect(s.internalScoreScaled).toBe(4750);
    expect(s.clamped).toBe(false);
    expect(s.propensityScore).toBe(47);
  });

  it('scores a thin file from the tier base alone (no decline)', () => {
    const thin: CanonicalPrequal = {
      ...prequal,
      tier: 'C',
      ficoBand: null,
      dti: null,
      openTradelines: null,
    };
    const s = scorePropensity(thin, ENGINE_CONFIG_V1);
    expect(s.baseScoreScaled).toBe(6000);
    expect(s.contributions).toEqual([]);
    expect(s.internalScoreScaled).toBe(6000);
    expect(s.clamped).toBe(false);
    expect(s.propensityScore).toBe(60);
  });

  it('omits a null DTI factor but keeps the others', () => {
    const noDti: CanonicalPrequal = { ...prequal, dti: null };
    const s = scorePropensity(noDti, ENGINE_CONFIG_V1);
    expect(s.contributions.map((c) => c.factor)).toEqual(['fico_above_floor', 'open_tradelines']);
  });
});

describe('scorePropensity — bounded factors', () => {
  it('caps the open-tradeline credit at maxTradelineCredit', () => {
    // 20 * 100 = 2000 uncapped → capped to 1000.
    const deep: CanonicalPrequal = { ...prequal, openTradelines: 20 };
    const s = scorePropensity(deep, ENGINE_CONFIG_V1);
    const tradelines = s.contributions.find((c) => c.factor === 'open_tradelines');
    expect(tradelines?.deltaScaled).toBe(1000);
  });

  it('gives FICO no credit (and never a penalty) at or below the floor', () => {
    const highFloor: EngineConfig = {
      ...ENGINE_CONFIG_V1,
      weights: { ...ENGINE_CONFIG_V1.weights, ficoFloor: 740 },
    };
    const below: CanonicalPrequal = { ...prequal, ficoBand: 700 };
    const s = scorePropensity(below, highFloor);
    expect(s.contributions.find((c) => c.factor === 'fico_above_floor')).toBeUndefined();
  });

  it('floors the internal score at zero when penalties dominate', () => {
    // Score a $10,000 request against a $500 product max → ~1900% over →
    // penalty 1900*200 = 380000, swamps the base → clamp to 0.
    const s = scorePropensity(prequal, ENGINE_CONFIG_V1, { productMaxAmountCents: '50000' });
    expect(s.contributions.find((c) => c.factor === 'amount_over_penalty')).toBeTruthy();
    expect(s.internalScoreScaled).toBe(0);
    expect(s.clamped).toBe(true);
    expect(s.propensityScore).toBe(0);
  });

  it('applies no amount-over penalty when the request is within the product max', () => {
    const s = scorePropensity(prequal, ENGINE_CONFIG_V1, { productMaxAmountCents: '2000000' });
    expect(s.contributions.find((c) => c.factor === 'amount_over_penalty')).toBeUndefined();
  });

  it('applies no amount-over penalty when no product max is supplied', () => {
    const s = scorePropensity(prequal, ENGINE_CONFIG_V1, {});
    expect(s.contributions.find((c) => c.factor === 'amount_over_penalty')).toBeUndefined();
  });
});

describe('scorePropensity — DTI quantization boundary', () => {
  it('rounds DTI half-up to whole percent', () => {
    // 0.325 → 33% (half-up) → penalty 33*50 = 1650.
    const s = scorePropensity({ ...prequal, dti: 0.325 }, ENGINE_CONFIG_V1);
    expect(s.contributions.find((c) => c.factor === 'dti_penalty')?.deltaScaled).toBe(-1650);
  });

  it('treats DTI 0 as no penalty', () => {
    const s = scorePropensity({ ...prequal, dti: 0 }, ENGINE_CONFIG_V1);
    expect(s.contributions.find((c) => c.factor === 'dti_penalty')).toBeUndefined();
  });

  it('treats DTI 1.0 (100%) as the maximum penalty', () => {
    const s = scorePropensity({ ...prequal, dti: 1 }, ENGINE_CONFIG_V1);
    expect(s.contributions.find((c) => c.factor === 'dti_penalty')?.deltaScaled).toBe(-5000);
  });
});

describe('scorePropensity — replay + integrity invariants', () => {
  it('is deterministic — identical input yields a deeply-equal result', () => {
    expect(scorePropensity(prequal, ENGINE_CONFIG_V1)).toEqual(
      scorePropensity(prequal, ENGINE_CONFIG_V1),
    );
  });

  it('emits only integers — no float leaks into the scored output', () => {
    const s = scorePropensity({ ...prequal, dti: 0.337 }, ENGINE_CONFIG_V1);
    expect(Number.isInteger(s.internalScoreScaled)).toBe(true);
    expect(Number.isInteger(s.propensityScore)).toBe(true);
    expect(Number.isInteger(s.baseScoreScaled)).toBe(true);
    for (const c of s.contributions) expect(Number.isInteger(c.deltaScaled)).toBe(true);
  });

  it('reconstructs the raw sum from base + contributions (SR 11-7 audit)', () => {
    const d: CanonicalPrequal = {
      ...prequal,
      tier: 'D',
      ficoBand: 600,
      dti: 0.4,
      openTradelines: 3,
    };
    const s = scorePropensity(d, ENGINE_CONFIG_V1);
    const raw = s.baseScoreScaled + s.contributions.reduce((acc, c) => acc + c.deltaScaled, 0);
    // No clamp here, so internal equals the reconstructed raw exactly.
    expect(s.clamped).toBe(false);
    expect(s.internalScoreScaled).toBe(raw);
  });

  it('is monotonic in FICO — more FICO never lowers the score', () => {
    const low = scorePropensity({ ...prequal, ficoBand: 640 }, ENGINE_CONFIG_V1);
    const high = scorePropensity({ ...prequal, ficoBand: 780 }, ENGINE_CONFIG_V1);
    expect(high.internalScoreScaled).toBeGreaterThanOrEqual(low.internalScoreScaled);
  });

  it('is monotonic in DTI — more DTI never raises the score', () => {
    const low = scorePropensity(
      { ...prequal, tier: 'D', ficoBand: 600, dti: 0.2 },
      ENGINE_CONFIG_V1,
    );
    const high = scorePropensity(
      { ...prequal, tier: 'D', ficoBand: 600, dti: 0.6 },
      ENGINE_CONFIG_V1,
    );
    expect(high.internalScoreScaled).toBeLessThanOrEqual(low.internalScoreScaled);
  });

  it('orders tiers A ≥ B ≥ C ≥ D for an identical profile', () => {
    const at = (tier: CanonicalPrequal['tier']) =>
      scorePropensity(
        { ...prequal, tier, ficoBand: 660, dti: 0.3, openTradelines: 5 },
        ENGINE_CONFIG_V1,
      ).internalScoreScaled;
    expect(at('A')).toBeGreaterThanOrEqual(at('B'));
    expect(at('B')).toBeGreaterThanOrEqual(at('C'));
    expect(at('C')).toBeGreaterThanOrEqual(at('D'));
  });
});
