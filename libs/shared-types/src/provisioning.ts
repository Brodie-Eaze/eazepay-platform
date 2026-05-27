/**
 * Provisioning + migration orchestrator wire schemas.
 *
 * Boundary contracts for the JSON columns persisted by
 * lib/orchestrator/{provision,migration}.ts:
 *
 *  - provisioning_runs.steps_json       → ProvisionStepsSchema
 *    (the spec's `step_state_json` on provisioning_runs maps to this —
 *     the column is named `steps_json` in lib/db/schema.ts; the audit
 *     used the conceptual name.)
 *  - provisioning_runs.config_json      → ProvisionConfigSchema
 *  - customer_migrations.step_state_json → MigrationStepsSchema
 *
 * Mirrors the interfaces in lib/orchestrator/{provision,migration}.ts.
 * Drift is caught by the round-trip tests.
 */

import { z } from 'zod';

/* ---------- provisioning_runs.steps_json ---------- */

export const ProvisionStepNameSchema = z.enum([
  'highsale_subaccount',
  'marketplace_defaults',
  'micamp_mid',
  'partner_portal_seed',
]);

export const StepStatusSchema = z.enum(['pending', 'in_progress', 'done', 'failed', 'skipped']);

export const ProvisionStepSchema = z.object({
  name: ProvisionStepNameSchema,
  status: StepStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  note: z.string().nullable(),
  /** Free-form per-step output. JSONB inside JSONB — kept loose. */
  result: z.record(z.string(), z.unknown()).nullable(),
});
export type ProvisionStep = z.infer<typeof ProvisionStepSchema>;

/** The spec calls this StepStateSchema — exported under both names. */
export const ProvisionStepsSchema = z.array(ProvisionStepSchema);
export type ProvisionSteps = z.infer<typeof ProvisionStepsSchema>;

/** Alias to match the spec's audit naming (`StepStateSchema`). */
export const StepStateSchema = ProvisionStepsSchema;
export type StepState = ProvisionSteps;

/* ---------- provisioning_runs.config_json ---------- */

export const BrandWithAiFundingSchema = z.enum(['medpay', 'tradepay', 'coachpay', 'ai_funding']);

export const ProvisionConfigSchema = z.object({
  partnerId: z.string().min(1),
  legalName: z.string().min(1),
  dba: z.string().nullable(),
  ein: z.string().min(1),
  primaryContactName: z.string().min(1),
  primaryContactEmail: z.string().email(),
  primaryContactPhone: z.string().min(1),
  brand: BrandWithAiFundingSchema,
  bureau: z.enum(['fico8', 'vantage']),
  monthlyPullCap: z.number().int().nullable(),
  billingCadence: z.enum(['weekly', 'biweekly', 'monthly']),
  estimatedAnnualVolumeCents: z.number().int().nonnegative(),
  estimatedTicketCents: z.number().int().nonnegative(),
  mccCode: z.string().min(1),
  funnelUrls: z.array(z.string()),
});
export type ProvisionConfig = z.infer<typeof ProvisionConfigSchema>;

/* ---------- customer_migrations.step_state_json ---------- */

export const MigrationStepNameSchema = z.enum([
  'lookup_source',
  'create_partner',
  'highsale_subaccount',
  'marketplace_defaults',
  'micamp_mid',
  'notify_customer',
  'finalize',
]);

export const MigrationStepStateSchema = z.object({
  name: MigrationStepNameSchema,
  status: z.enum(['pending', 'in_progress', 'done', 'failed', 'skipped']),
  completedAt: z.string().nullable(),
  note: z.string().nullable(),
});
export type MigrationStepState = z.infer<typeof MigrationStepStateSchema>;

export const MigrationStepsSchema = z.array(MigrationStepStateSchema);
export type MigrationSteps = z.infer<typeof MigrationStepsSchema>;
