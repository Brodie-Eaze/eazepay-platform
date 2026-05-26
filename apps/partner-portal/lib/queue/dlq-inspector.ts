/**
 * DLQ inspector — read-only view of the three queues' failed sets.
 *
 * Used by the eventual admin DLQ UI to page failed jobs without
 * exposing BullMQ's Job type to the route layer. The route handler
 * just calls `listFailedJobs('provisioning-runs', 50)` and renders
 * the returned rows.
 *
 * Read-only by design: requeue/retry actions belong in a follow-up
 * file that ALSO writes an audit_log row — never quietly mutate
 * orchestrator state from an inspector.
 */

import { hasQueue } from './index';
import { getProvisioningQueue, PROVISIONING_QUEUE_NAME } from './provisioning';
import { getMigrationsQueue, MIGRATIONS_QUEUE_NAME } from './migrations';
import { getWebhooksQueue, WEBHOOKS_QUEUE_NAME } from './webhooks';
import { safeLog } from '../safe-log';

export type FailedJobQueueName =
  | typeof PROVISIONING_QUEUE_NAME
  | typeof MIGRATIONS_QUEUE_NAME
  | typeof WEBHOOKS_QUEUE_NAME;

export interface FailedJobSummary {
  /** BullMQ jobId — same as runId / migrationId / inboxId for our queues. */
  id: string;
  queue: FailedJobQueueName;
  /** Last error message from the failed attempt. */
  failedReason: string | null;
  /** When BullMQ first received the job. */
  enqueuedAtMs: number;
  /** When BullMQ marked it failed (last attempt). */
  finishedOnMs: number | null;
  attemptsMade: number;
  attemptsAllowed: number;
  data: Record<string, unknown>;
}

/**
 * Return the most-recent failed jobs for one of the three queues.
 * Empty list if `hasQueue()` is false (no Redis) — caller renders
 * "DLQ unavailable" instead of an error.
 */
export async function listFailedJobs(
  queue: FailedJobQueueName,
  limit: number,
): Promise<FailedJobSummary[]> {
  if (!hasQueue()) return [];
  if (limit <= 0) return [];
  // Cap at 500 to avoid an accidental admin click hammering Redis.
  const capped = Math.min(limit, 500);
  try {
    const q = resolveQueue(queue);
    // BullMQ paginates with [start, end] inclusive — getJobs(['failed'], 0, N-1).
    const jobs = await q.getJobs(['failed'], 0, capped - 1, false);
    return jobs.map((j) => ({
      id: j.id ?? 'unknown',
      queue,
      failedReason: j.failedReason ?? null,
      enqueuedAtMs: j.timestamp,
      finishedOnMs: j.finishedOn ?? null,
      attemptsMade: j.attemptsMade,
      attemptsAllowed: j.opts.attempts ?? 1,
      data: j.data as unknown as Record<string, unknown>,
    }));
  } catch (err) {
    safeLog.error({
      event: 'queue.dlq.list_failed',
      queue,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return [];
  }
}

function resolveQueue(name: FailedJobQueueName) {
  switch (name) {
    case PROVISIONING_QUEUE_NAME:
      return getProvisioningQueue();
    case MIGRATIONS_QUEUE_NAME:
      return getMigrationsQueue();
    case WEBHOOKS_QUEUE_NAME:
      return getWebhooksQueue();
  }
}
