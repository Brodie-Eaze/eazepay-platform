import { Injectable } from '@nestjs/common';
import type { LenderAdapter } from '../ports/lender-adapter.port.js';
import type {
  LenderEligibility,
  LenderEvaluationContext,
  LenderQuoteResult,
} from '../lender.types.js';

const TWENTY_FIVE_K_CENTS = 2_500_000n; // $25,000.00
const APR_BPS = 999; // 9.99% — cheaper than BuzzPay for tier-1 customers
const COMPARISON_BPS = 1049;
const ORIGINATION_FEE_BPS = 100; // 1%
const OFFER_TTL_MINUTES = 30;

/**
 * Mock prime-tier external lender. Tighter eligibility envelope but
 * cheaper APR — intentionally beats BuzzPay on consumer cost in its
 * eligibility window so orchestration's "consumer-best" sort surfaces it
 * first. This is the test that rules out internal-favouritism: when this
 * adapter quotes, BuzzPay should rank below it on the offers screen.
 */
@Injectable()
export class MockPrimeAdapter implements LenderAdapter {
  readonly adapterKey = 'mock_prime';

  async isEligible(ctx: LenderEvaluationContext): Promise<LenderEligibility> {
    if (!ctx.affordabilityPasses) {
      return { eligible: false, reasonCodes: ['affordability_fail'] };
    }
    if (ctx.requestedAmountCents > TWENTY_FIVE_K_CENTS) {
      return { eligible: false, reasonCodes: ['amount_above_max'] };
    }
    if (ctx.termMonths < 12 || ctx.termMonths > 48) {
      return { eligible: false, reasonCodes: ['term_out_of_range'] };
    }
    if (ctx.riskScore !== null && ctx.riskScore < 650) {
      return { eligible: false, reasonCodes: ['risk_score_below_threshold'] };
    }
    return { eligible: true };
  }

  async quote(
    ctx: LenderEvaluationContext,
    _opts: { signal: AbortSignal },
  ): Promise<LenderQuoteResult> {
    const elig = await this.isEligible(ctx);
    if (!elig.eligible) return { outcome: 'declined', reasonCodes: elig.reasonCodes };

    const principal = ctx.requestedAmountCents;
    const fees = (principal * BigInt(ORIGINATION_FEE_BPS)) / 10_000n;
    const interestApprox =
      (principal * BigInt(APR_BPS) * BigInt(ctx.termMonths)) / ((12n * 100n * 200n) / 100n);
    const totalRepayable = principal + interestApprox + fees;

    return {
      outcome: 'approved',
      quote: {
        lenderProductId: 'mock_prime_personal',
        lenderOfRecord: 'Mock Prime Bank, N.A.',
        amountCents: principal,
        termMonths: ctx.termMonths,
        aprBps: APR_BPS,
        comparisonRateBps: COMPARISON_BPS,
        feesCents: fees,
        totalRepayableCents: totalRepayable,
        expiresAt: new Date(Date.now() + OFFER_TTL_MINUTES * 60 * 1000),
      },
    };
  }
}
