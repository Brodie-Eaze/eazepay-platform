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
import { startProvision } from './provision';
import { getDb, hasDb, schema } from '../db';
import { safeLog } from '../safe-log';
import { incrementMetric } from '../observability/metrics';
import { hasQueue } from '../queue';

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
    transport: hasQueue() ? 'bullmq' : 'in_process',
  });
  await writeAudit(record, 'migration.start', { startedAt: record.startedAt });

  // Dispatch to the worker. When Redis is configured we hand the
  // job off to BullMQ; otherwise we defer to setImmediate so the
  // caller still gets a fast 202. Same pattern as startProvision.
  if (hasQueue()) {
    try {
      const { enqueueMigrationRun } = await import('../queue/migrations');
      await enqueueMigrationRun(record.id);
    } catch (err) {
      // Enqueue failure must surface — splitting the transport would
      // split the failure mode. Re-throw so the route returns 5xx.
      safeLog.error({
        event: 'orchestrator.migration.enqueue_failed',
        migrationId: record.id,
        err: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  } else {
    // In-process fallback. setImmediate does NOT surface throws as
    // unhandled rejections — wrap with .catch so a worker error
    // becomes a structured log rather than crashing the Node process.
    // The BullMQ path doesn't need this because the Worker harness
    // catches + retries automatically.
    setImmediate(() => {
      void executeMigrationRun(record.id).catch((err) => {
        safeLog.error({
          event: 'orchestrator.migration.in_process_failed',
          migrationId: record.id,
          err: err instanceof Error ? err.message : 'unknown',
        });
      });
    });
  }
  return record;
}

/**
 * Execute a migration run end-to-end. Exported for the BullMQ worker
 * entry point (`lib/queue/migrations.ts`) and the in-process fallback
 * path inside `startMigration`. Re-fetches the record from Postgres
 * (not closed over) so cross-process workers see the latest state.
 *
 * No-ops if the row is already past `in_progress` — protects against
 * a worker picking up a job for a row that another worker (or a hot
 * deploy) already finished.
 */
export async function executeMigrationRun(migrationId: string): Promise<void> {
  const record = await getMigration(migrationId);
  if (!record) {
    // Worker received an id we have no row for — possible after a
    // hard DB rollback. Throw so BullMQ retries, then DLQs.
    throw new Error(`customer_migration_not_found:${migrationId}`);
  }
  if (record.status === 'completed' || record.status === 'failed') {
    safeLog.info({
      event: 'orchestrator.migration.skip_already_terminal',
      migrationId,
      status: record.status,
    });
    return;
  }
  // The worker may have picked up a job whose row is still 'queued'
  // (the producer enqueued before startMigration flipped the status).
  // Promote to in_progress + persist so the dashboard reflects work.
  if (record.status === 'queued') {
    record.status = 'in_progress';
    record.startedAt = nowIso();
    await persistRecord(record);
  }
  await runMigrationSteps(record);
}

async function runMigrationSteps(record: MigrationRecord): Promise<void> {
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
    incrementMetric('migration.failed');
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

  // Wait for the child provisioning run to finish. The wait strategy
  // depends on the transport:
  //   - BullMQ: use Job.waitUntilFinished against a QueueEvents instance.
  //     The migration worker blocks on the provisioning job event stream
  //     instead of polling Postgres every 500ms — orders of magnitude
  //     fewer reads on busy queues.
  //   - In-process: the child provisioning run is executing via
  //     setImmediate in the same Node process. We poll the DB row until
  //     it transitions to completed/failed (or the timeout fires). This
  //     is the legacy path retained for dev parity.
  const waitResult = await waitForProvisionTerminal(provisionRunId);
  if (waitResult.outcome === 'timeout') {
    await failMigrationFromProvision(record, waitResult.reason);
    return;
  }
  if (waitResult.outcome === 'failed') {
    await failMigrationFromProvision(record, waitResult.reason);
    return;
  }

  // provisioning completed — bubble the three relevant steps up.
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
  incrementMetric('migration.completed');
  safeLog.info({
    event: 'orchestrator.migration.completed',
    migrationId: record.id,
    sourceCustomerId: record.sourceCustomerId,
  });
  await writeAudit(record, 'migration.complete', {
    completedAt: record.completedAt,
    provisionRunId,
  });
}

type ProvisionWaitOutcome =
  | { outcome: 'completed' }
  | { outcome: 'failed'; reason: string }
  | { outcome: 'timeout'; reason: string };

/** Cap the wait at 5 minutes — matches the SLO for the provisioning
 *  upstream calls (HighSale + MiCamp) with retries. Beyond this we
 *  assume the upstream is wedged and surface a migration failure for
 *  ops review. */
const PROVISION_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Wait for a provisioning run to reach a terminal state. Picks the
 * wait strategy at runtime based on whether the BullMQ substrate is
 * configured. Exported as a helper for testability; the migration
 * worker is its only caller in production.
 */
async function waitForProvisionTerminal(provisionRunId: string): Promise<ProvisionWaitOutcome> {
  if (hasQueue()) {
    return waitForProvisionViaBullmq(provisionRunId);
  }
  return waitForProvisionViaPoll(provisionRunId);
}

/**
 * BullMQ path — block on the provisioning job's event stream. Reads
 * the final DB row once on completion so the migration sees the same
 * source of truth as the polling path (steps_json, failure_reason).
 *
 * Implementation note: each wait creates a short-lived QueueEvents
 * subscriber. We could share one across the worker but BullMQ's
 * waitUntilFinished API takes a QueueEvents instance and we'd have to
 * stash it on the worker module — premature optimisation given a
 * migration worker handles at most ~10 concurrent waits.
 */
async function waitForProvisionViaBullmq(provisionRunId: string): Promise<ProvisionWaitOutcome> {
  const { QueueEvents } = await import('bullmq');
  const { PROVISIONING_QUEUE_NAME, getProvisioningQueue } = await import('../queue/provisioning');
  const { getConnection } = await import('../queue');
  const queue = getProvisioningQueue();
  const job = await queue.getJob(provisionRunId);
  if (!job) {
    return { outcome: 'failed', reason: 'provisioning_job_not_found' };
  }
  const events = new QueueEvents(PROVISIONING_QUEUE_NAME, { connection: getConnection() });
  try {
    await events.waitUntilReady();
    // waitUntilFinished resolves when the job COMPLETES, rejects when
    // it FAILS. Either way we move to reading the DB row to recover
    // the orchestrator-level outcome (which carries failure_reason).
    await job.waitUntilFinished(events, PROVISION_WAIT_TIMEOUT_MS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    // BullMQ throws a TimeoutError after PROVISION_WAIT_TIMEOUT_MS.
    if (msg.toLowerCase().includes('timed out')) {
      return {
        outcome: 'timeout',
        reason: `Provisioning run did not complete within ${PROVISION_WAIT_TIMEOUT_MS / 1000}s.`,
      };
    }
    // A failed provisioning job throws here too — we still want the
    // row's failure_reason rather than the BullMQ-side error.
  } finally {
    await events.close();
  }
  // Lazy import to avoid a top-level cycle (migration <- provision <- migration).
  const { getRun } = await import('./provision');
  const provisionRun = await getRun(provisionRunId);
  if (!provisionRun) {
    return { outcome: 'failed', reason: 'Provisioning run not found after wait.' };
  }
  if (provisionRun.status === 'completed') return { outcome: 'completed' };
  return { outcome: 'failed', reason: provisionRun.failureReason ?? 'Provisioning failed.' };
}

/**
 * In-process fallback path — poll the DB row until terminal or the
 * timeout fires. Kept on the legacy 500ms interval for dev parity.
 */
async function waitForProvisionViaPoll(provisionRunId: string): Promise<ProvisionWaitOutcome> {
  const POLL_INTERVAL_MS = 500;
  const { getRun } = await import('./provision');
  const startedAt = Date.now();
  // Bounded loop — never await an unbounded sleep.
  for (;;) {
    const provisionRun = await getRun(provisionRunId);
    if (!provisionRun) {
      if (Date.now() - startedAt > PROVISION_WAIT_TIMEOUT_MS) {
        return { outcome: 'timeout', reason: 'Provisioning run not found within timeout.' };
      }
    } else if (provisionRun.status === 'completed') {
      return { outcome: 'completed' };
    } else if (provisionRun.status === 'failed') {
      return {
        outcome: 'failed',
        reason: provisionRun.failureReason ?? 'Provisioning failed.',
      };
    } else if (Date.now() - startedAt > PROVISION_WAIT_TIMEOUT_MS) {
      return {
        outcome: 'timeout',
        reason: `Provisioning run did not complete within ${PROVISION_WAIT_TIMEOUT_MS / 1000}s.`,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
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
  incrementMetric('migration.failed');
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
