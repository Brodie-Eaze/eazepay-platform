/**
 * Read/write boundary helpers for the jsonb columns converted in
 * migration 0014.
 *
 * Use at every write site to validate INPUT before insert, and at
 * every read site (where the caller cares about shape) to validate
 * OUTPUT before handing the object to domain code.
 *
 * The DB now stores `jsonb` so Drizzle returns parsed objects — there
 * is no JSON.parse anywhere downstream. These helpers are the only
 * shape gate.
 *
 * Failure model:
 *  - Write boundary: throws on invalid input. Callers must catch and
 *    decide (e.g. the decision engine routes to its DLQ on persist
 *    failures). Letting a bad shape into the DB is worse than failing
 *    the user-visible action.
 *  - Read boundary: returns the schema's narrow type on success, and
 *    throws on shape drift. Reads in this codebase are best-effort
 *    domain reconstructions — the caller usually has a fallback (an
 *    in-memory copy, or rebuild-from-defaults). The throw surfaces
 *    the drift loudly.
 */

import {
  AuditLogPayloadSchema,
  DecisionInputsSchema,
  MigrationStepsSchema,
  ProvisionConfigSchema,
  ProvisionStepsSchema,
  RankedLendersSchema,
  type AuditLogPayload,
  type DecisionInputs,
  type MigrationSteps,
  type ProvisionConfig,
  type ProvisionSteps,
  type RankedLenders,
} from '@eazepay/shared-types';
import type { z } from 'zod';

/* ---------- generic helper ---------- */

function parseAt<T>(schema: z.ZodType<T>, value: unknown, where: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `jsonb_boundary_violation:${where}:${result.error.issues
        .map((i) => `${i.path.join('.')}=${i.code}`)
        .join(',')}`,
    );
  }
  return result.data;
}

/* ---------- decisions.inputs_json ---------- */

export function parseDecisionInputsForWrite(input: unknown): DecisionInputs {
  return parseAt(DecisionInputsSchema, input, 'decisions.inputs_json:write');
}
export function parseDecisionInputsForRead(value: unknown): DecisionInputs {
  return parseAt(DecisionInputsSchema, value, 'decisions.inputs_json:read');
}

/* ---------- decisions.ranked_lenders_json ---------- */

export function parseRankedLendersForWrite(input: unknown): RankedLenders {
  return parseAt(RankedLendersSchema, input, 'decisions.ranked_lenders_json:write');
}
export function parseRankedLendersForRead(value: unknown): RankedLenders {
  return parseAt(RankedLendersSchema, value, 'decisions.ranked_lenders_json:read');
}

/* ---------- audit_log.payload_json ---------- */

export function parseAuditPayloadForWrite(input: unknown): AuditLogPayload {
  return parseAt(AuditLogPayloadSchema, input, 'audit_log.payload_json:write');
}

/* ---------- provisioning_runs.steps_json ---------- */

export function parseProvisionStepsForWrite(input: unknown): ProvisionSteps {
  return parseAt(ProvisionStepsSchema, input, 'provisioning_runs.steps_json:write');
}
export function parseProvisionStepsForRead(value: unknown): ProvisionSteps {
  return parseAt(ProvisionStepsSchema, value, 'provisioning_runs.steps_json:read');
}

/* ---------- provisioning_runs.config_json ---------- */

export function parseProvisionConfigForWrite(input: unknown): ProvisionConfig {
  return parseAt(ProvisionConfigSchema, input, 'provisioning_runs.config_json:write');
}
export function parseProvisionConfigForRead(value: unknown): ProvisionConfig {
  return parseAt(ProvisionConfigSchema, value, 'provisioning_runs.config_json:read');
}

/* ---------- customer_migrations.step_state_json ---------- */

export function parseMigrationStepsForWrite(input: unknown): MigrationSteps {
  return parseAt(MigrationStepsSchema, input, 'customer_migrations.step_state_json:write');
}
export function parseMigrationStepsForRead(value: unknown): MigrationSteps {
  return parseAt(MigrationStepsSchema, value, 'customer_migrations.step_state_json:read');
}
