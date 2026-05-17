import type {
  LenderTier as PrismaLenderTier,
  LoanCategory as PrismaLoanCategory,
} from '@prisma/client';

export type LenderTier = PrismaLenderTier;
export type LoanCategory = PrismaLoanCategory;

/** Application context handed to lender adapters at evaluation time. */
export interface LenderEvaluationContext {
  applicationId: string;
  userId: string;
  category: LoanCategory;
  requestedAmountCents: bigint;
  termMonths: number;
  /** US-state of residence; used for state-rules-matrix gating. */
  residentState: string | null;
  /** True if the orchestrator's affordability check passed. Adapters may
   *  apply their own additional rules but cannot ignore this signal. */
  affordabilityPasses: boolean;
  /** Risk-tier hint from the decision service, if any. */
  riskScore: number | null;
}

export interface LenderQuote {
  lenderProductId: string;
  lenderOfRecord: string;
  amountCents: bigint;
  termMonths: number;
  aprBps: number;
  comparisonRateBps: number | null;
  feesCents: bigint;
  totalRepayableCents: bigint;
  /** Wall-clock validity for the offer. Orchestrator clamps to its own
   *  ceiling regardless of what the adapter returns. */
  expiresAt: Date;
}

export type LenderEligibility = { eligible: true } | { eligible: false; reasonCodes: string[] };

export type LenderQuoteResult =
  | { outcome: 'approved'; quote: LenderQuote }
  | { outcome: 'declined'; reasonCodes: string[] }
  | { outcome: 'error'; reasonCodes: string[] };
