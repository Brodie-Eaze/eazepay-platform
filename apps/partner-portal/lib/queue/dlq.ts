/**
 * Dead-letter behaviour for the three orchestrator queues.
 *
 * BullMQ's built-in DLQ semantics are minimal: a job that exhausts its
 * attempts ends up in the queue's `failed` set, indexable by `getJobs`.
 * The job data + last error are preserved there. For ops, that's not
 * enough — we want the underlying business row (provisioning_runs,
 * customer_migrations, webhook_inbox) to surface the failure too, so
 * the admin UI can render it without round-tripping to Redis.
 *
 * `recordTerminalFailure` writes the failure reason back to the row's
 * `failure_reason` column (and flips processing_status to 'failed' for
 * webhook_inbox) — best-effort, never throws. If the DB is unreachable
 * (the very thing that may have caused the job to fail in the first
 * place), the BullMQ failed-set IS the fallback artifact and the next
 * ops sweep will pick it up.
 *
 * `listFailedJobs` lets an eventual admin DLQ UI page the failed set
 * without exposing BullMQ types directly to the route layer.
 */

import { eq } from 'drizzle-orm';
import { getDb, hasDb, schema } from '../db';
import { safeLog } from '../safe-log';

export type DlqRecordKind = 'provisioning_run' | 'customer_migration' | 'webhook_inbox';

export interface DlqRecordInput {
  kind: DlqRecordKind;
  id: string;
  reason: string;
}

/**
 * Persist a terminal failure (BullMQ retries exhausted) back to the
 * owning business row. Best-effort: a DB write failure is logged but
 * does not throw — the BullMQ failed set is the fallback artifact.
 *
 * Reason is truncated to 1024 chars to match the webhook_inbox column
 * width; provisioning + migration columns are text but we cap anyway
 * to avoid pathological stack traces filling the row.
 */
export async function recordTerminalFailure(input: DlqRecordInput): Promise<void> {
  if (!hasDb()) {
    safeLog.warn({
      event: 'queue.dlq.record_skipped_no_db',
      kind: input.kind,
      id: input.id,
    });
    return;
  }
  const reason = input.reason.slice(0, 1024);
  try {
    const db = getDb();
    if (input.kind === 'provisioning_run') {
      await db
        .update(schema.provisioningRuns)
        .set({ status: 'failed', failureReason: reason, completedAt: new Date() })
        .where(eq(schema.provisioningRuns.id, input.id));
    } else if (input.kind === 'customer_migration') {
      await db
        .update(schema.customerMigrations)
        .set({ status: 'failed', failureReason: reason, completedAt: new Date() })
        .where(eq(schema.customerMigrations.id, input.id));
    } else {
      await db
        .update(schema.webhookInbox)
        .set({ processingStatus: 'failed', failureReason: reason, processedAt: new Date() })
        .where(eq(schema.webhookInbox.id, input.id));
    }
    safeLog.info({
      event: 'queue.dlq.recorded',
      kind: input.kind,
      id: input.id,
    });
  } catch (err) {
    safeLog.error({
      event: 'queue.dlq.record_failed',
      kind: input.kind,
      id: input.id,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}
