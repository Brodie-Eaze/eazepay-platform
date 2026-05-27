/**
 * Decision-engine wire schemas.
 *
 * These Zod schemas are the boundary contract for the `decisions` table.
 * Before migration 0014 those columns were `text` and call sites used
 * `JSON.stringify` on write and `JSON.parse(...) as X` on read — the
 * unchecked cast was the silent corruption hazard the type-design audit
 * flagged.
 *
 * Post-0014 the columns are `jsonb` and Drizzle returns structured
 * objects. Every read site validates with `.parse(...)` and every write
 * site validates with `.parse(...)` before insert, so the database is
 * the second line of defence, not the first.
 *
 * Shape sources:
 *  - PrequalInputs  → lib/decision-engine.ts (snapshot of HighSale soft
 *                     pull + intake form, frozen at decision time)
 *  - RankedLender   → lib/decision-engine.ts (engine output row, one
 *                     entry per evaluated lender)
 */

import { z } from 'zod';

/* ---------- decisions.inputs_json — DecisionInputsSchema ---------- */

/**
 * CFPB Reg B / Model Form C-1 adverse-action reason codes. Mirrors
 * the union in lib/decision-engine.ts — keep both in lockstep.
 */
export const RegBReasonCodeSchema = z.enum([
  'INCOME_INSUFFICIENT',
  'CREDIT_HISTORY_INSUFFICIENT',
  'CREDIT_PROFILE_NEGATIVE',
  'DTI_EXCESSIVE',
  'RESIDENCE_DURATION',
  'EMPLOYMENT_DURATION',
  'GEOGRAPHY',
  'LOAN_AMOUNT_TOO_SMALL',
  'LOAN_AMOUNT_TOO_LARGE',
]);
export type RegBReasonCode = z.infer<typeof RegBReasonCodeSchema>;

/**
 * The frozen prequal snapshot persisted into `decisions.inputs_json`.
 * Mirrors PrequalInputs in lib/decision-engine.ts. Drift between the
 * two is caught by the round-trip test in lib/db/jsonb-boundary.spec.ts.
 *
 * Why these fields nullable: HighSale returns NULL on thin-file
 * consumers; we still persist the decision so the operator queue can
 * surface them.
 */
export const DecisionInputsSchema = z.object({
  tier: z.enum(['A', 'B', 'C', 'D']),
  ficoBand: z.number().int().nullable(),
  dti: z.number().nullable(),
  openTradelines: z.number().int().nullable(),
  amountCents: z.number().int().nonnegative(),
  annualIncomeCents: z.number().int().nonnegative(),
  /** 2-letter US state. Validated loosely here — the strict UsStateSchema
   *  lives in primitives.ts but the persisted snapshot may carry
   *  legacy 'XX' rows we don't want to break on read. */
  state: z.string().length(2),
  brand: z.string(),
});
export type DecisionInputs = z.infer<typeof DecisionInputsSchema>;

/* ---------- decisions.ranked_lenders_json — RankedLenderSchema ---------- */

/**
 * One row in the propensity-ranked output of the decision engine.
 * Mirrors RankedLender in lib/decision-engine.ts.
 *
 * The persisted column holds an ARRAY of these — see
 * RankedLendersSchema below.
 */
export const RankedLenderSchema = z.object({
  lenderId: z.string().min(1),
  displayName: z.string(),
  propensityScore: z.number().min(0).max(100),
  rank: z.number().int().positive(),
  included: z.boolean(),
  reasonCode: z.string().nullable(),
  regBReasonCode: RegBReasonCodeSchema.nullable(),
  principalReasonText: z.string().nullable(),
  estimatedAprBps: z.number().int().nullable(),
  estimatedMaxCents: z.number().int().nullable(),
});
export type RankedLender = z.infer<typeof RankedLenderSchema>;

export const RankedLendersSchema = z.array(RankedLenderSchema);
export type RankedLenders = z.infer<typeof RankedLendersSchema>;
