import { z } from 'zod';
import { canonicalPrequalSchema } from './financials.js';
import type { RegBReasonCode } from './reason-codes.js';

/**
 * The `POST /v1/decide` wire contract.
 *
 * The partner-portal already calls this shape today (it posts
 * `{ applicationId, ...prequal }` and reads `{ rankedLenders }`). These
 * types are the canonical, services-side mirror of the portal's
 * `RankedLender` union — they MUST serialise byte-identically because
 * services cannot import from `apps/`. Field names and JSON numeric
 * shapes are copied verbatim from
 * apps/partner-portal/lib/decision-engine.ts.
 */

/** A lender the consumer is included for — carries a propensity score. */
export interface IncludedLender {
  included: true;
  lenderId: string;
  displayName: string;
  /** 0..100 — likelihood of approval, given the consumer's profile. */
  propensityScore: number;
  /** Final rank — 1 = top. */
  rank: number;
  /** Estimated APR band the consumer would see, in basis points. */
  estimatedAprBps: number;
  /** Estimated max approval amount, in cents. */
  estimatedMaxCents: number;
}

/** A lender the consumer is excluded from — carries an AA-safe reason. */
export interface ExcludedLender {
  included: false;
  lenderId: string;
  displayName: string;
  /** Internal rule code that knocked the lender out (never shown to consumer). */
  reasonCode: string;
  /** CFPB Reg B code suitable for an adverse-action notice. */
  regBReasonCode: RegBReasonCode;
  /** Human-readable principal-reason text from CFPB Model Form C-1. */
  principalReasonText: string;
}

export type RankedLender = IncludedLender | ExcludedLender;

/** Runtime discriminator — mirrors the `if (!r.included)` portal idiom. */
export function isIncludedLender(r: RankedLender): r is IncludedLender {
  return r.included;
}

/** Request body: flattened `{ applicationId, ...canonicalPrequal }`. */
export const decideRequestSchema = canonicalPrequalSchema.extend({
  applicationId: z.string().min(1),
});

export type DecideRequest = z.infer<typeof decideRequestSchema>;

/** The decision engine's wire response. */
export interface DecideResponse {
  rankedLenders: RankedLender[];
}
