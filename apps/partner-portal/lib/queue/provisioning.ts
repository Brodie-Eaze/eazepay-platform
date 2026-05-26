/**
 * Provisioning queue — BullMQ wiring for `lib/orchestrator/provision.ts`.
 *
 * Why move this off `setImmediate`: the in-process path serialises every
 * partner provisioning run on whichever Node replica handled the POST.
 * One slow MiCamp upstream blocks all subsequent provisions on that
 * replica, and a hard process restart mid-run abandons the work — the
 * DB row is left in `running` forever until ops manually cleans up.
 *
 * Post-fix:
 *   • POST /api/onboarding/provision INSERTs the provisioning_runs row
 *     and enqueues a job carrying the run id.
 *   • The worker fetches the row from Postgres (NOT from the job
 *     payload — keeps sensitive partner data out of Redis), then runs
 *     the steps via `executeProvisionRun(id, config)`.
 *   • Retries: 3 attempts with exponential backoff (2s base) for
 *     transient upstream failures (HighSale 503, MiCamp throttling).
 *     Step idempotency is owned by the upstream client (each integration
 *     dedupes on partnerId we send) so a retry resumes safely.
 *   • Concurrency 5: HighSale + MiCamp can sustain ~5 simultaneous
 *     provisioning attempts per partner without rate-limit issues.
 *     Bumping past this requires upstream coordination.
 *
 * Graceful degradation: callers gate on `hasQueue()` before importing
 * `enqueueProvisioningRun`. When Redis is absent, the orchestrator
 * falls back to the legacy `setImmediate(executeProvisionRun)` path
 * so local dev + tests still work end-to-end.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { getConnection } from './index';
import { executeProvisionRun, loadProvisionConfig } from '../orchestrator/provision';
import { safeLog } from '../safe-log';
import { recordTerminalFailure } from './dlq';

export const PROVISIONING_QUEUE_NAME = 'provisioning-runs';

const CONCURRENCY = 5;
const ATTEMPTS = 3;
const BACKOFF_BASE_MS = 2_000;

export interface ProvisioningJobData {
  /** provisioning_runs.id — the worker re-fetches everything from the
   *  row + config so the job payload stays minimal. */
  runId: string;
}

let cachedQueue: Queue<ProvisioningJobData> | null = null;

/**
 * Lazy queue accessor. Constructing the Queue eagerly at import time
 * would open a Redis socket from every Next.js route file that
 * transitively imports the orchestrator, even when only handling reads.
 */
export function getProvisioningQueue(): Queue<ProvisioningJobData> {
  if (!cachedQueue) {
    cachedQueue = new Queue<ProvisioningJobData>(PROVISIONING_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKOFF_BASE_MS },
        // Keep recent successes for ops debugging; cap to avoid Redis
        // memory growth at fleet scale (500+ provisions / day post-launch).
        removeOnComplete: { count: 500, age: 24 * 3600 },
        // Failed jobs stay around 7d for DLQ inspection.
        removeOnFail: { count: 500, age: 7 * 24 * 3600 },
      },
    });
  }
  return cachedQueue;
}

/**
 * Enqueue a provisioning run. Idempotent: BullMQ dedupes on jobId so
 * a duplicate enqueue for the same runId (e.g. operator double-clicked
 * the wizard) is a no-op.
 */
export async function enqueueProvisioningRun(runId: string): Promise<void> {
  const queue = getProvisioningQueue();
  await queue.add(
    'provisioning-run',
    { runId },
    {
      // runId IS the natural idempotency key — see DB-side insert in
      // startProvision. Two ticks that both pick up the same row
      // collapse to one job.
      jobId: runId,
    },
  );
  safeLog.info({ event: 'queue.provisioning.enqueued', runId });
}

/**
 * Boot the provisioning worker. Returns the Worker for lifecycle
 * management (e.g. `await worker.close()` on shutdown). Only called
 * from `scripts/start-workers.ts` in the worker process — never from
 * a route handler.
 */
export function startProvisioningWorker(): Worker<ProvisioningJobData> {
  const worker = new Worker<ProvisioningJobData>(
    PROVISIONING_QUEUE_NAME,
    async (job) => processProvisioningJob(job),
    {
      connection: getConnection(),
      concurrency: CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    const runId = job?.data?.runId ?? 'unknown';
    const attemptsMade = job?.attemptsMade ?? 0;
    const attemptsAllowed = job?.opts?.attempts ?? ATTEMPTS;
    const terminal = attemptsMade >= attemptsAllowed;
    safeLog.error({
      event: 'queue.provisioning.job_failed',
      runId,
      attemptsMade,
      attemptsAllowed,
      terminal,
      error: err.message,
    });
    if (terminal) {
      // Persist the DLQ reason on the run row so the ops UI surfaces
      // it without having to round-trip through Redis. Fire-and-forget;
      // the listener can't `await` because BullMQ doesn't await its
      // event handlers and we don't want to block the next job.
      void recordTerminalFailure({
        kind: 'provisioning_run',
        id: runId,
        reason: err.message,
      });
    }
  });

  worker.on('error', (err) => {
    safeLog.error({ event: 'queue.provisioning.worker_error', error: err.message });
  });

  return worker;
}

/**
 * Job processor — exported so tests can call it directly without a
 * live Redis. Re-fetches the run + config from Postgres (NOT the job
 * payload) so a job that arrives after a deploy still works against
 * the current schema, and so PII in the config never lives in Redis.
 */
export async function processProvisioningJob(job: Job<ProvisioningJobData>): Promise<void> {
  const { runId } = job.data;
  const config = await loadProvisionConfig(runId);
  if (!config) {
    // The run row exists but we have no config to drive it. This
    // happens only if the orchestrator's runtime contract drifts —
    // throw so BullMQ retries, then DLQs.
    throw new Error(`provisioning_run_config_missing:${runId}`);
  }
  await executeProvisionRun(runId, config);
}
