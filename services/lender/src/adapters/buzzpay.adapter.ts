import { Injectable } from '@nestjs/common';
import type { LenderAdapter } from '../ports/lender-adapter.port.js';
import type {
  LenderEligibility,
  LenderEvaluationContext,
  LenderQuoteResult,
} from '../lender.types.js';

const TWO_HUNDRED = 200n;
const FIFTY_K_CENTS = 5_000_000n; // $50,000.00
const APR_BPS = 1499; // 14.99%
const COMPARISON_BPS = 1599; // ~comparison incl fees
const ORIGINATION_FEE_BPS = 250; // 2.5% of principal
const OFFER_TTL_MINUTES = 30;

/**
 * BuzzPay (TrueTopia) adapter — first-look internal lender. Approves up
 * to $50,000 / 60 months for any non-rejected application; declines
 * anything else. Pricing is deterministic so orchestration tests are
 * reproducible. Lender-of-record will be the partner bank string once
 * ADR-0008 is finalised; for now we use the canonical placeholder.
 *
 * IMPORTANT: This adapter must NOT receive preferential routing for
 * EazePay revenue. Orchestration ranks by consumer cost, not by tier
 * label. BuzzPay only goes first when its quote is also the best.
 */
@Injectable()
export class BuzzPayAdapter implements LenderAdapter {
  readonly adapterKey = 'buzzpay';

  async isEligible(ctx: LenderEvaluationContext): Promise<LenderEligibility> {
    if (!ctx.affordabilityPasses) {
      return { eligible: false, reasonCodes: ['affordability_fail'] };
    }
    if (ctx.requestedAmountCents > FIFTY_K_CENTS) {
      return { eligible: false, reasonCodes: ['amount_above_max'] };
    }
    if (ctx.termMonths < 6 || ctx.termMonths > 60) {
      return { eligible: false, reasonCodes: ['term_out_of_range'] };
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
      (principal * BigInt(APR_BPS) * BigInt(ctx.termMonths)) / (TWO_HUNDRED * 12n * 100n / 100n);
    // Above is an approximation only — real APR amortization happens in
    // the contract service. Adapters return indicative totals; final
    // disclosures are computed once the consumer accepts.
    const totalRepayable = principal + interestApprox + fees;

    return {
      outcome: 'approved',
      quote: {
        lenderProductId: 'buzzpay_personal',
        lenderOfRecord: 'BuzzPay (issued via partner bank — see ADR-0008)',
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
