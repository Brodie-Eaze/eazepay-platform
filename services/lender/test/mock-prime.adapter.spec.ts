import { describe, expect, it } from 'vitest';
import { MockPrimeAdapter } from '../src/adapters/mock-prime.adapter.js';
import type { LenderEvaluationContext } from '../src/lender.types.js';

const ctx = (over: Partial<LenderEvaluationContext> = {}): LenderEvaluationContext => ({
  applicationId: 'app-1',
  userId: 'user-1',
  category: 'personal' as never,
  requestedAmountCents: 1_000_000n,
  termMonths: 24,
  residentState: 'CA',
  affordabilityPasses: true,
  riskScore: 720,
  ...over,
});
const ctrl = () => ({ signal: new AbortController().signal });

describe('MockPrimeAdapter — characterisation', () => {
  const a = new MockPrimeAdapter();

  it('adapterKey is "mock_prime"', () => {
    expect(a.adapterKey).toBe('mock_prime');
  });

  it('declines: affordability_fail', async () => {
    expect(await a.isEligible(ctx({ affordabilityPasses: false }))).toEqual({
      eligible: false,
      reasonCodes: ['affordability_fail'],
    });
  });

  it('declines above $25,000 (2_500_001 cents)', async () => {
    expect(await a.isEligible(ctx({ requestedAmountCents: 2_500_001n }))).toEqual({
      eligible: false,
      reasonCodes: ['amount_above_max'],
    });
  });

  it('declines term < 12 or > 48 months', async () => {
    expect(await a.isEligible(ctx({ termMonths: 11 }))).toEqual({
      eligible: false,
      reasonCodes: ['term_out_of_range'],
    });
    expect(await a.isEligible(ctx({ termMonths: 49 }))).toEqual({
      eligible: false,
      reasonCodes: ['term_out_of_range'],
    });
  });

  it('declines risk_score_below_threshold when score < 650', async () => {
    expect(await a.isEligible(ctx({ riskScore: 649 }))).toEqual({
      eligible: false,
      reasonCodes: ['risk_score_below_threshold'],
    });
  });

  it('accepts when riskScore is null (no score available, no gating)', async () => {
    expect(await a.isEligible(ctx({ riskScore: null }))).toEqual({ eligible: true });
  });

  it('approves and returns the documented quote shape', async () => {
    const r = await a.quote(ctx({ requestedAmountCents: 1_000_000n, termMonths: 24 }), ctrl());
    expect(r.outcome).toBe('approved');
    if (r.outcome !== 'approved') throw new Error('unreachable');
    expect(r.quote.lenderProductId).toBe('mock_prime_personal');
    expect(r.quote.lenderOfRecord).toBe('Mock Prime Bank, N.A.');
    expect(r.quote.aprBps).toBe(999);
    expect(r.quote.comparisonRateBps).toBe(1049);
    // fee = 1% of $10,000 = 10_000 cents
    expect(r.quote.feesCents).toBe(10_000n);
    // interest = 1_000_000 * 999 * 24 / 2400 = 9_990_000
    expect(r.quote.totalRepayableCents).toBe(1_000_000n + 9_990_000n + 10_000n);
  });

  it('quote forwards eligibility decline (term too low)', async () => {
    const r = await a.quote(ctx({ termMonths: 11 }), ctrl());
    expect(r).toEqual({ outcome: 'declined', reasonCodes: ['term_out_of_range'] });
  });
});
