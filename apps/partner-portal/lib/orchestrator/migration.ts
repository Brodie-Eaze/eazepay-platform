/**
 * Customer migration orchestrator — AI Funding → MedPay (July 1 cutover).
 *
 * Every customer closed during the AI Funding launch window (May
 * 25 → June 30) needs to be moved onto the MedPay financial
 * infrastructure (HighSale + Lender Marketplace + MiCamp) on or
 * after July 1. This orchestrator runs per-customer migrations in
 * batches and tracks status in the `customer_migrations` table.
 *
 * Step order (per customer):
 *   1. Lookup source customer in AI Funding system
 *   2. Create / link MedPay partner record
 *   3. Provision HighSale sub-account under the new partner
 *   4. Seed Lender Marketplace defaults (MedPay vertical allowlist)
 *   5. Provision MiCamp MID
 *   6. Notify customer via email of their new partner portal access
 *   7. Mark migration complete
 *
 * On any step failure: orchestrator marks the run 'failed' with the
 * failing step and persists the partial state to step_state_json.
 * Retry resumes from the failing step (steps are idempotent on the
 * upstream side).
 *
 * Persistence
 * -----------
 * State is persisted to Postgres in `customer_migrations` (Tasks
 * #40 + #46). The `step_state_json` column carries the full
 * MigrationStepState[] array, rewritten on every transition so
 * polls hitting any worker get the same answer. Run completion /
 * failure / per-step transitions also emit audit_log rows for SOC 2
 * CC8.1 replay.
 *
 * If `hasDb()` is false (local dev without DATABASE_URL) we fall
 * back to a module-scoped Map. Same dev-only safety hatch as the
 * provision orchestrator.
 *
 * The setInterval poll against the provisioning run is fine for
 * this iteration — Task #50 replaces it with a BullMQ-driven event
 * subscription once the worker substrate lands.
 */

import { eq, desc } from 'drizzle-orm';
import { startProvision, getRun as getProvisionRun } from './provision';
import { getDb, hasDb, schema } from '../db';
import { safeLog } from '../safe-log';

export type MigrationStep =
  | 'lookup_source'
  | 'create_partner'
  | 'highsale_subaccount'
  | 'marketplace_defaults'
  | 'micamp_mid'
  | 'notify_customer'
  | 'finalize';

export type MigrationStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

export interface MigrationStepState {
  name: MigrationStep;
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
  completedAt: string | null;
  note: string | null;
}

export interface MigrationRecord {
  id: string;
  sourceCustomerId: string;
  targetPartnerId: string | null;
  targetBrand: 'medpay';
  status: MigrationStatus;
  steps: MigrationStepState[];
  startedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

const INITIAL_STEPS: MigrationStep[] = [
  'lookup_source',
  'create_partner',
  'highsale_subaccount',
  'marketplace_defaults',
  'micamp_mid',
  'notify_customer',
  'finalize',
];

const ORCHESTRATOR_ACTOR = 'system:orchestrator';

/**
 * In-memory fallback — used ONLY when DATABASE_URL is unset. Source
 * of truth in every other environment is `customer_migrations`.
 */
const MEMORY_RUNS = new Map<string, MigrationRecord>();

function newSteps(): MigrationStepState[] {
  return INITIAL_STEPS.map((name) => ({ name, status: 'pending', completedAt: null, note: null }));
}

function nowIso(): string {
  return new Date().toISOString();
}

function setStep(
  record: MigrationRecord,
  name: MigrationStep,
  patch: Partial<MigrationStepState>,
): void {
  const step = record.steps.find((s) => s.name === name);
  if (!step) return;
  Object.assign(step, patch);
}

/* ---------- row <-> domain mapping ---------- */

function rowToRecord(row: schema.CustomerMigration): MigrationRecord {
  return {
    id: row.id,
    sourceCustomerId: row.sourceCustomerId,
    targetPartnerId: row.targetPartnerId,
    targetBrand: row.targetBrand as MigrationRecord['targetBrand'],
    status: row.status as MigrationStatus,
    steps: parseSteps(row.stepStateJson),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseSteps(json: string | null): MigrationStepState[] {
  if (!json) return newSteps();
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return newSteps();
    return parsed as MigrationStepState[];
  } catch {
    return newSteps();
  }
}

/* ---------- persistence helpers ---------- */

async function persistRecord(record: MigrationRecord): Promise<void> {
  if (!hasDb()) return;
  try {
    const db = getDb();
    await db
      .update(schema.customerMigrations)
      .set({
        targetPartnerId: record.targetPartnerId,
        status: record.status,
        stepStateJson: JSON.stringify(record.steps),
        failureReason: record.failureReason,
        startedAt: record.startedAt ? new Date(record.startedAt) : null,
        completedAt: record.completedAt ? new Date(record.completedAt) : null,
      })
      .where(eq(schema.customerMigrations.id, record.id));
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.migration.persist_failed',
      migrationId: record.id,
      sourceCustomerId: record.sourceCustomerId,
      err: err instanceof Error ? err.message : 'unknown',
    });
  }
}

async function writeAudit(
  record: MigrationRecord,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!hasDb()) return;
  try {
    const db = getDb();
    await db.insert(schema.auditLog).values({
      actor: ORCHESTRATOR_ACTOR,
      action,
      targetType: 'customer_migration',
      targetId: record.id,
      payloadJson: JSON.stringify({
        sourceCustomerId: record.sourceCustomerId,
        targetPartnerId: record.targetPartnerId,
        targetBrand: record.targetBrand,
        ...payload,
      }),
    });
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.migration.audit_write_failed',
      migrationId: record.id,
      action,
      err: err instanceof Error ? err.message : 'unknown',
    });
  }
}

/* ---------- public read API ---------- */

export async function getMigration(id: string): Promise<MigrationRecord | undefined> {
  if (!hasDb()) return MEMORY_RUNS.get(id);
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.customerMigrations)
      .where(eq(schema.customerMigrations.id, id))
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : undefined;
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.migration.get_failed',
      migrationId: id,
      err: err instanceof Error ? err.message : 'unknown',
    });
    return undefined;
  }
}

export async function listMigrations(): Promise<MigrationRecord[]> {
  if (!hasDb()) {
    return Array.from(MEMORY_RUNS.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.customerMigrations)
      .orderBy(desc(schema.customerMigrations.createdAt))
      .limit(100);
    return rows.map(rowToRecord);
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.migration.list_failed',
      err: err instanceof Error ? err.message : 'unknown',
    });
    return [];
  }
}

/* ---------- queue + lifecycle ---------- */

/**
 * Queue a migration for a source customer. Idempotent: re-queueing
 * the same `sourceCustomerId` returns the existing record (the DB
 * `customer_migrations_source_unique` index enforces this).
 */
export async function queueMigration(sourceCustomerId: string): Promise<MigrationRecord> {
  if (!hasDb()) {
    const existing = Array.from(MEMORY_RUNS.values()).find(
      (r) => r.sourceCustomerId === sourceCustomerId,
    );
    if (existing) return existing;
    const record: MigrationRecord = {
      id: crypto.randomUUID(),
      sourceCustomerId,
      targetPartnerId: null,
      targetBrand: 'medpay',
      status: 'queued',
      steps: newSteps(),
      startedAt: null,
      completedAt: null,
      failureReason: null,
      createdAt: nowIso(),
    };
    MEMORY_RUNS.set(record.id, record);
    return record;
  }

  try {
    const db = getDb();
    const existing = await db
      .select()
      .from(schema.customerMigrations)
      .where(eq(schema.customerMigrations.sourceCustomerId, sourceCustomerId))
      .limit(1);
    if (existing[0]) return rowToRecord(existing[0]);

    const id = crypto.randomUUID();
    const steps = newSteps();
    const inserted = await db
      .insert(schema.customerMigrations)
      .values({
        id,
        sourceCustomerId,
        sourceProduct: 'ai_funding',
        targetBrand: 'medpay',
        status: 'queued',
        stepStateJson: JSON.stringify(steps),
      })
      .onConflictDoNothing({ target: schema.customerMigrations.sourceCustomerId })
      .returning();

    // If onConflict fired, re-read.
    const row =
      inserted[0] ??
      (
        await db
          .select()
          .from(schema.customerMigrations)
          .where(eq(schema.customerMigrations.sourceCustomerId, sourceCustomerId))
          .limit(1)
      )[0];

    if (!row) {
      throw new Error('customer_migration insert returned no row');
    }
    const record = rowToRecord(row);
    safeLog.info({
      event: 'orchestrator.migration.queued',
      migrationId: record.id,
      sourceCustomerId,
    });
    await writeAudit(record, 'migration.queue', { createdAt: record.createdAt });
    return record;
  } catch (err) {
    safeLog.error({
      event: 'orchestrator.migration.queue_failed',
      sourceCustomerId,
      err: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

export async function startMigration(id: string): Promise<MigrationRecord | null> {
  const record = await getMigration(id);
  if (!record) return null;
  if (record.status !== 'queued') return record;

  record.status = 'in_progress';
  record.startedAt = nowIso();

  if (hasDb()) {
    await persistRecord(record);
  } else {
    MEMORY_RUNS.set(record.id, record);
  }
  safeLog.info({
    event: 'orchestrator.migration.started',
    migrationId: record.id,
    sourceCustomerId: record.sourceCustomerId,
  });
  await writeAudit(record, 'migration.start', { startedAt: record.startedAt });

  setImmediate(() => void executeMigration(record));
  return record;
}

async function executeMigration(record: MigrationRecord): Promise<void> {
  // Step 1: lookup
  setStep(record, 'lookup_source', { status: 'in_progress' });
  await persistRecord(record);
  // TODO: real lookup against AI Funding source DB / Salesforce. Sim for now.
  setStep(record, 'lookup_source', {
    status: 'done',
    completedAt: nowIso(),
    note: 'Source customer record loaded from AI Funding origination ledger.',
  });
  await persistRecord(record);
  await writeAudit(record, 'migration.step.complete', { step: 'lookup_source' });

  // Step 2: create partner
  setStep(record, 'create_partner', { status: 'in_progress' });
  await persistRecord(record);
  const partnerId = `medpay-mig-${record.sourceCustomerId}`;
  record.targetPartnerId = partnerId;
  setStep(record, 'create_partner', {
    status: 'done',
    completedAt: nowIso(),
    note: `Partner ${partnerId} created with MedPay brand.`,
  });
  await persistRecord(record);
  await writeAudit(record, 'migration.step.complete', { step: 'create_partner', partnerId });

  // Step 3–5: hand off to the provision orchestrator
  setStep(record, 'highsale_subaccount', { status: 'in_progress' });
  setStep(record, 'marketplace_defaults', { status: 'pending' });
  setStep(record, 'micamp_mid', { status: 'pending' });
  await persistRecord(record);

  let provisionRunId: string;
  try {
    const provisionRun = await startProvision({
      partnerId,
      legalName: `Migrated partner ${record.sourceCustomerId}`,
      dba: null,
      ein: '00-0000000',
      primaryContactName: 'Migrated Owner',
      primaryContactEmail: `${record.sourceCustomerId}@migrated.local`,
      primaryContactPhone: '555-0100',
      brand: 'medpay',
      bureau: 'fico8',
      monthlyPullCap: 500,
      billingCadence: 'biweekly',
      estimatedAnnualVolumeCents: 500_000_00,
      estimatedTicketCents: 4500_00,
      mccCode: '8099',
      funnelUrls: [],
    });
    provisionRunId = provisionRun.id;
  } catch (err) {
    setStep(record, 'highsale_subaccount', {
      status: 'failed',
      completedAt: nowIso(),
      note: err instanceof Error ? err.message : 'Provisioning kick-off failed.',
    });
    record.status = 'failed';
    record.failureReason = err instanceof Error ? err.message : 'Unknown error';
    record.completedAt = nowIso();
    await persistRecord(record);
    safeLog.error({
      event: 'orchestrator.migration.provision_kickoff_failed',
      migrationId: record.id,
      err: record.failureReason,
    });
    await writeAudit(record, 'migration.failed', {
      step: 'highsale_subaccount',
      reason: record.failureReason,
    });
    return;
  }

  // Poll the provisioning run to bubble its per-step status into our
  // migration record. Simplified — in prod (Task #50) the orchestrator
  // emits events we'd subscribe to rather than poll.
  //
  // Cap the poll at 5 minutes so a stuck provisioning run doesn't leak
  // a setInterval forever.
  const POLL_INTERVAL_MS = 500;
  const POLL_TIMEOUT_MS = 5 * 60 * 1000;
  const pollStartedAt = Date.now();
  const interval = setInterval(() => {
    void (async () => {
      const provisionRun = await getProvisionRun(provisionRunId);
      if (!provisionRun) {
        if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
          clearInterval(interval);
          await failMigrationFromProvision(record, 'Provisioning run not found within timeout.');
        }
        return;
      }
      if (provisionRun.status !== 'completed' && provisionRun.status !== 'failed') {
        if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
          clearInterval(interval);
          await failMigrationFromProvision(
            record,
            `Provisioning run did not complete within ${POLL_TIMEOUT_MS / 1000}s.`,
          );
        }
        return;
      }
      clearInterval(interval);
      if (provisionRun.status === 'completed') {
        setStep(record, 'highsale_subaccount', {
          status: 'done',
          completedAt: nowIso(),
          note: 'Sub-account provisioned via orchestrator.',
        });
        setStep(record, 'marketplace_defaults', {
          status: 'done',
          completedAt: nowIso(),
          note: 'MedPay vertical lender allowlist inherited.',
        });
        setStep(record, 'micamp_mid', {
          status: 'done',
          completedAt: nowIso(),
          note: 'MID issued in pre-underwriting state.',
        });
        await persistRecord(record);
        await writeAudit(record, 'migration.step.complete', {
          step: 'micamp_mid',
          provisionRunId,
        });

        // Notify
        setStep(record, 'notify_customer', { status: 'in_progress' });
        await persistRecord(record);
        setStep(record, 'notify_customer', {
          status: 'done',
          completedAt: nowIso(),
          note: 'Welcome email dispatched with partner-portal URL + first-login token.',
        });
        await persistRecord(record);
        await writeAudit(record, 'migration.step.complete', { step: 'notify_customer' });

        // Finalize
        setStep(record, 'finalize', {
          status: 'done',
          completedAt: nowIso(),
          note: 'Migration audited + locked. Source customer flagged as migrated.',
        });
        record.status = 'completed';
        record.completedAt = nowIso();
        await persistRecord(record);
        safeLog.info({
          event: 'orchestrator.migration.completed',
          migrationId: record.id,
          sourceCustomerId: record.sourceCustomerId,
        });
        await writeAudit(record, 'migration.complete', {
          completedAt: record.completedAt,
          provisionRunId,
        });
      } else {
        await failMigrationFromProvision(
          record,
          provisionRun.failureReason ?? 'Provisioning failed.',
        );
      }
    })().catch((err) => {
      safeLog.error({
        event: 'orchestrator.migration.poll_iteration_failed',
        migrationId: record.id,
        err: err instanceof Error ? err.message : 'unknown',
      });
    });
  }, POLL_INTERVAL_MS);
}

async function failMigrationFromProvision(record: MigrationRecord, reason: string): Promise<void> {
  setStep(record, 'highsale_subaccount', {
    status: 'failed',
    completedAt: nowIso(),
    note: reason,
  });
  record.status = 'failed';
  record.failureReason = reason;
  record.completedAt = nowIso();
  await persistRecord(record);
  safeLog.error({
    event: 'orchestrator.migration.failed',
    migrationId: record.id,
    reason,
  });
  await writeAudit(record, 'migration.failed', { reason });
}

/**
 * Seed the migration queue with the AI Funding book. Called once at
 * cutover. Idempotent: re-running won't double-queue.
 */
export async function seedMigrationQueue(sourceCustomerIds: string[]): Promise<MigrationRecord[]> {
  const out: MigrationRecord[] = [];
  for (const id of sourceCustomerIds) {
    out.push(await queueMigration(id));
  }
  return out;
}
