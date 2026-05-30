import { describe, expect, it } from 'vitest';
import { BuzzPayAdapter } from '../src/adapters/buzzpay.adapter.js';
import type { LenderEvaluationContext } from '../src/lender.types.js';

const ctx = (over: Partial<LenderEvaluationContext> = {}): LenderEvaluationContext => ({
  applicationId: 'app-1',
  userId: 'user-1',
  category: 'personal' as never,
  requestedAmountCents: 1_000_000n, // $10,000
  termMonths: 36,
  residentState: 'CA',
  affordabilityPasses: true,
  riskScore: 700,
  ...over,
});

const ctrl = (): { signal: AbortSignal } => ({ signal: new AbortController().signal });

describe('BuzzPayAdapter — characterisation', () => {
  const a = new BuzzPayAdapter();

  it('exposes stable adapterKey "buzzpay"', () => {
    expect(a.adapterKey).toBe('buzzpay');
  });

  describe('isEligible', () => {
    it('declines with affordability_fail when affordability did not pass', async () => {
      const r = await a.isEligible(ctx({ affordabilityPasses: false }));
      expect(r).toEqual({ eligible: false, reasonCodes: ['affordability_fail'] });
    });

    it('declines with amount_above_max above $50,000 (5_000_001 cents)', async () => {
      const r = await a.isEligible(ctx({ requestedAmountCents: 5_000_001n }));
      expect(r).toEqual({ eligible: false, reasonCodes: ['amount_above_max'] });
    });

    it('accepts exactly $50,000.00 (5_000_000 cents) at the inclusive ceiling', async () => {
      const r = await a.isEligible(ctx({ requestedAmountCents: 5_000_000n }));
      expect(r).toEqual({ eligible: true });
    });

    it('declines with term_out_of_range below 6 months', async () => {
      const r = await a.isEligible(ctx({ termMonths: 5 }));
      expect(r).toEqual({ eligible: false, reasonCodes: ['term_out_of_range'] });
    });

    it('declines with term_out_of_range above 60 months', async () => {
      const r = await a.isEligible(ctx({ termMonths: 61 }));
      expect(r).toEqual({ eligible: false, reasonCodes: ['term_out_of_range'] });
    });

    it('accepts at the 6-month and 60-month inclusive boundaries', async () => {
      expect(await a.isEligible(ctx({ termMonths: 6 }))).toEqual({ eligible: true });
      expect(await a.isEligible(ctx({ termMonths: 60 }))).toEqual({ eligible: true });
    });
  });

  describe('quote', () => {
    it('returns the documented LenderQuote shape on approval', async () => {
      const r = await a.quote(ctx(), ctrl());
      expect(r.outcome).toBe('approved');
      if (r.outcome !== 'approved') throw new Error('unreachable');
      const q = r.quote;
      expect(q.lenderProductId).toBe('buzzpay_personal');
      expect(q.lenderOfRecord).toBe('BuzzPay (issued via partner bank — see ADR-0008)');
      expect(q.amountCents).toBe(1_000_000n);
      expect(q.termMonths).toBe(36);
      expect(q.aprBps).toBe(1499);
      expect(q.comparisonRateBps).toBe(1599);
      // origination fee = 2.5% of $10,000 = $250 = 25_000 cents
      expect(q.feesCents).toBe(25_000n);
      // totalRepayable = principal + (principal * 1499 * 36 / 2400) + fees
      // = 1_000_000 + (1_000_000 * 1499 * 36)/2400 + 25_000
      // = 1_000_000 + 22_485_000 + 25_000 = 23_510_000n (deterministic legacy math)
      expect(q.totalRepayableCents).toBe(23_510_000n);
      expect(q.expiresAt).toBeInstanceOf(Date);
      // 30-minute TTL from now, give a small tolerance
      const delta = q.expiresAt.getTime() - Date.now();
      expect(delta).toBeGreaterThan(29 * 60_000);
      expect(delta).toBeLessThan(31 * 60_000);
    });

    it('forwards eligibility failure to declined outcome (affordability)', async () => {
      const r = await a.quote(ctx({ affordabilityPasses: false }), ctrl());
      expect(r).toEqual({ outcome: 'declined', reasonCodes: ['affordability_fail'] });
    });

    it('does NOT throw on an already-aborted signal — adapter is pure-compute', async () => {
      // Characterisation: BuzzPay quote does not inspect the signal because it
      // performs no external I/O. This pins that contract — if a future change
      // makes it signal-aware it should be a deliberate decision.
      const c = new AbortController();
      c.abort();
      const r = await a.quote(ctx(), { signal: c.signal });
      expect(r.outcome).toBe('approved');
    });
  });
});
