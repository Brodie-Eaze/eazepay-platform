import type {
  LenderEligibility,
  LenderEvaluationContext,
  LenderQuoteResult,
} from '../lender.types.js';

/**
 * Single interface every lender — internal (BuzzPay) and external —
 * implements. Identical contract on both sides keeps orchestration honest:
 * routing decisions cannot branch on internal-vs-external in a way that
 * disadvantages the consumer.
 */
export interface LenderAdapter {
  /** Stable string id matched against `lenders.adapter_key` in the DB. */
  readonly adapterKey: string;

  /** Cheap, synchronous-feeling eligibility check (no external I/O ideally).
   *  Called within the orchestrator's hot path before any quote() call. */
  isEligible(ctx: LenderEvaluationContext): Promise<LenderEligibility>;

  /** Real quote. Adapter should respect the timeout signal — orchestrator
   *  enforces a hard timeout on top regardless. */
  quote(ctx: LenderEvaluationContext, opts: { signal: AbortSignal }): Promise<LenderQuoteResult>;
}

export const LENDER_ADAPTERS = Symbol('LENDER_ADAPTERS');
