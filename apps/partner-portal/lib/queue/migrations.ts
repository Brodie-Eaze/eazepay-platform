/**
 * Migrations queue — BullMQ wiring for `lib/orchestrator/migration.ts`.
 *
 * Why move this off `setImmediate` + `setInterval`: the polling loop
 * leaked timers on every long-running provisioning run, and the
 * 500ms tick rate was both wasteful (one DB SELECT per migration per
 * half-second) and slow (a poll could lag the provisioning completion
 * by half a second per step). Worse, a hard process restart mid-migration
 * abandoned the work — the customer_migrations row was left in
 * `in_progress` until ops manually cleaned up.
 *
 * Post-fix:
 *   • startMigration enqueues a job carrying the migration id.
 *   • The worker calls executeMigrationRun(id), which now uses
 *     `Job.waitUntilFinished` instead of `setInterval` to await the
 *     child provisioning run. waitUntilFinished is BullMQ's recommended
 *     synchronous-await primitive for parent-child dependencies and is
 *     simpler than a Flow Producer for our straight-line case (one
 *     migration awaits one provisioning run, never a DAG).
 *   • Retries: 5 attempts with exponential backoff for transient
 *     upstream failures. Steps are idempotent on the upstream side.
 *   • Concurrency 10: migrations are cheap (mostly DB writes +
 *     awaiting a child provisioning) so we run more in parallel than
 *     provisioning itself. 500-customer July-1 batch finishes in ~10
 *     minutes at this concurrency.
 *
 * Graceful degradation: callers gate on `hasQueue()` before importing
 * `enqueueMigrationRun`. When Redis is absent, the orchestrator falls
 * back to the legacy `setImmediate(executeMigrationRun)` path.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { getConnection } from './index';
import { executeMigrationRun } from '../orchestrator/migration';
import { safeLog } from '../safe-log';
import { recordTerminalFailure } from './dlq';

export const MIGRATIONS_QUEUE_NAME = 'customer-migrations';

const CONCURRENCY = 10;
const ATTEMPTS = 5;
const BACKOFF_BASE_MS = 2_000;

export interface MigrationJobData {
  /** customer_migrations.id — re-fetched in the processor. */
  migrationId: string;
}

let cachedQueue: Queue<MigrationJobData> | null = null;

export function getMigrationsQueue(): Queue<MigrationJobData> {
  if (!cachedQueue) {
    cachedQueue = new Queue<MigrationJobData>(MIGRATIONS_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKOFF_BASE_MS },
        removeOnComplete: { count: 1_000, age: 24 * 3600 },
        removeOnFail: { count: 1_000, age: 7 * 24 * 3600 },
      },
    });
  }
  return cachedQueue;
}

/**
 * Enqueue a migration run. Idempotent on migrationId — operator can
 * safely re-POST without spawning a duplicate worker.
 */
export async function enqueueMigrationRun(migrationId: string): Promise<void> {
  const queue = getMigrationsQueue();
  await queue.add('migration-run', { migrationId }, { jobId: migrationId });
  safeLog.info({ event: 'queue.migrations.enqueued', migrationId });
}

export function startMigrationsWorker(): Worker<MigrationJobData> {
  const worker = new Worker<MigrationJobData>(
    MIGRATIONS_QUEUE_NAME,
    async (job) => processMigrationJob(job),
    {
      connection: getConnection(),
      concurrency: CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    const migrationId = job?.data?.migrationId ?? 'unknown';
    const attemptsMade = job?.attemptsMade ?? 0;
    const attemptsAllowed = job?.opts?.attempts ?? ATTEMPTS;
    const terminal = attemptsMade >= attemptsAllowed;
    safeLog.error({
      event: 'queue.migrations.job_failed',
      migrationId,
      attemptsMade,
      attemptsAllowed,
      terminal,
      error: err.message,
    });
    if (terminal) {
      void recordTerminalFailure({
        kind: 'customer_migration',
        id: migrationId,
        reason: err.message,
      });
    }
  });

  worker.on('error', (err) => {
    safeLog.error({ event: 'queue.migrations.worker_error', error: err.message });
  });

  return worker;
}

export async function processMigrationJob(job: Job<MigrationJobData>): Promise<void> {
  const { migrationId } = job.data;
  await executeMigrationRun(migrationId);
}
