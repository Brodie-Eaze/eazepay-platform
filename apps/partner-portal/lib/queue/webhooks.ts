/**
 * Webhook inbox queue — BullMQ wiring for `lib/workers/webhook-processor.ts`.
 *
 * Why move this off the manual admin tick: provider webhooks already
 * land in the durable `webhook_inbox` table, but the only way to drain
 * pending rows today is `POST /api/admin/webhook-processor/tick`. That
 * leaves the inbox growing between ops nudges and means a misconfigured
 * cron in production silently halts the entire integration pipeline.
 *
 * Post-fix:
 *   • POST /api/integrations/{micamp,highsale}/webhook INSERTs the
 *     webhook_inbox row, then enqueues a job carrying the row id.
 *   • The worker fetches the row, claims it (pending → processing),
 *     dispatches to the per-provider handler, and marks done/failed.
 *   • Retries: 5 attempts with exponential backoff. On terminal
 *     failure, BullMQ DLQs the job AND the worker's failed-event
 *     listener persists the failure_reason to the inbox row for ops
 *     review (see lib/queue/dlq.ts).
 *   • Concurrency 20: webhook handlers are mostly fast DB writes;
 *     a large backlog after a deploy gap drains in seconds rather
 *     than minutes.
 *
 * The admin tick endpoint is kept (now marked deprecated) as an ops
 * escape hatch: re-process all `pending` rows after a handler bugfix
 * without having to poke individual jobs.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { getConnection } from './index';
import { processInboxRow } from '../workers/webhook-processor';
import { safeLog } from '../safe-log';
import { recordTerminalFailure } from './dlq';
import { injectTraceContext, runWithTraceContext, withSpan } from '../observability/tracing';

export const WEBHOOKS_QUEUE_NAME = 'webhook-inbox';

const CONCURRENCY = 20;
const ATTEMPTS = 5;
const BACKOFF_BASE_MS = 2_000;

export interface WebhookInboxJobData {
  /** webhook_inbox.id — the worker re-fetches the row at start so the
   *  raw provider payload stays out of Redis. */
  inboxId: string;
  /** W3C TraceContext propagation — `traceparent` (and optionally
   *  `tracestate`) injected by the producer so the worker can parent
   *  its dispatch span on the enqueue span. Restored via
   *  `runWithTraceContext` in `processWebhookJob`. */
  traceparent?: string;
  tracestate?: string;
}

let cachedQueue: Queue<WebhookInboxJobData> | null = null;

export function getWebhooksQueue(): Queue<WebhookInboxJobData> {
  if (!cachedQueue) {
    cachedQueue = new Queue<WebhookInboxJobData>(WEBHOOKS_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKOFF_BASE_MS },
        removeOnComplete: { count: 5_000, age: 24 * 3600 },
        removeOnFail: { count: 5_000, age: 7 * 24 * 3600 },
      },
    });
  }
  return cachedQueue;
}

/**
 * Enqueue a webhook inbox row for processing. Idempotent: inboxId is
 * the jobId, so duplicate enqueues collide and no-op. The DB's
 * (provider, event_id) unique index already guarantees one inbox row
 * per upstream event, so duplicate enqueues happen only on operator
 * replay (admin tick endpoint).
 */
export async function enqueueWebhookInbox(inboxId: string): Promise<void> {
  const queue = getWebhooksQueue();
  // Capture the active OTel context (HTTP-side span set up by the
  // webhook route handler) into the job data so the worker can parent
  // its dispatch span on this enqueue span. W3C TraceContext keys only
  // (traceparent + tracestate). When no span is active the carrier
  // stays empty and the job is enqueued normally.
  const carrier: Record<string, string> = {};
  injectTraceContext(carrier);
  await queue.add(
    'webhook-inbox-row',
    { inboxId, traceparent: carrier.traceparent, tracestate: carrier.tracestate },
    { jobId: inboxId },
  );
  safeLog.info({ event: 'queue.webhooks.enqueued', inboxId });
}

export function startWebhooksWorker(): Worker<WebhookInboxJobData> {
  const worker = new Worker<WebhookInboxJobData>(
    WEBHOOKS_QUEUE_NAME,
    async (job) => processWebhookJob(job),
    {
      connection: getConnection(),
      concurrency: CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    const inboxId = job?.data?.inboxId ?? 'unknown';
    const attemptsMade = job?.attemptsMade ?? 0;
    const attemptsAllowed = job?.opts?.attempts ?? ATTEMPTS;
    const terminal = attemptsMade >= attemptsAllowed;
    safeLog.error({
      event: 'queue.webhooks.job_failed',
      inboxId,
      attemptsMade,
      attemptsAllowed,
      terminal,
      error: err.message,
    });
    if (terminal) {
      void recordTerminalFailure({
        kind: 'webhook_inbox',
        id: inboxId,
        reason: err.message,
      });
    }
  });

  worker.on('error', (err) => {
    safeLog.error({ event: 'queue.webhooks.worker_error', error: err.message });
  });

  return worker;
}

export async function processWebhookJob(job: Job<WebhookInboxJobData>): Promise<void> {
  const { inboxId, traceparent, tracestate } = job.data;
  // Restore the producer-side OTel context (set by enqueueWebhookInbox)
  // so the dispatch span parents on the route handler's enqueue span.
  // The empty-carrier path is a no-op — no parent, span becomes a root.
  const carrier: Record<string, string> = {};
  if (traceparent) carrier.traceparent = traceparent;
  if (tracestate) carrier.tracestate = tracestate;
  await runWithTraceContext(carrier, () =>
    withSpan(
      'webhook.inbox.process',
      {
        'business.inbox_id': inboxId,
        'messaging.system': 'bullmq',
        'messaging.destination.name': WEBHOOKS_QUEUE_NAME,
        'messaging.bullmq.job.attempts_made': job.attemptsMade,
      },
      () => processInboxRow(inboxId),
    ),
  );
}
