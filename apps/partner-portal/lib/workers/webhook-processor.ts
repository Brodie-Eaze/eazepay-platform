/**
 * Webhook inbox processor (Task #43).
 *
 * Drains `webhook_inbox` rows that the integration routes parked in
 * write-then-200 fashion. The routes' only job is to durably persist
 * the verified delivery; this worker owns:
 *
 *   • Claiming pending rows (status='pending' → 'processing')
 *   • Dispatching to the event-type handler for the provider
 *   • Recording success (status='done', processed_at=now())
 *   • Recording failure (status='failed', attempts++, leave for retry
 *     until attempts >= 5, then leave for ops review)
 *
 * Where this runs (today vs. soon):
 *   • Today: `POST /api/admin/webhook-processor/tick` invokes
 *     `processInbox()` synchronously. Lets the platform demo close the
 *     loop without standing up BullMQ.
 *   • Soon: BullMQ repeatable job (Task #50) calls `processInbox()`
 *     every N seconds and emits per-row metrics.
 *
 * Handlers are STUBS. The dispatch skeleton is correct + idempotent;
 * the actual state mutations (mids, decisions, audit_log writes) are
 * downstream work tracked on each handler's TODO. A stub that logs +
 * returns ok is strictly safer than the pre-task behaviour (200 +
 * silent drop) — the inbox now keeps the raw payload so any future
 * handler can replay.
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb, hasDb, schema } from '../db';
import type { Db } from '../db';
import { safeLog } from '../safe-log';

/** Max rows the worker drains per tick. Keeps each invocation bounded
 * so a backlog doesn't lock a connection for minutes. BullMQ will
 * re-tick frequently; the manual admin endpoint is fine with 50. */
const BATCH_LIMIT = 50;

/** After this many consecutive failures we stop retrying on the next
 * poll. The row stays in 'failed' for ops review — eventual DLQ table.
 * 5 matches the BullMQ default attempt count we'll wire in Task #50. */
const MAX_ATTEMPTS = 5;

type Provider = 'micamp' | 'highsale' | 'trutopia';

interface InboxRow {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  rawBody: string;
  attempts: number;
}

export interface ProcessInboxResult {
  scanned: number;
  done: number;
  failed: number;
  skipped: number;
}

/**
 * Defensive event id extractor. MiCamp uses `id`, HighSale uses
 * `event_id`, Trutopia's docs flip between the two. Either is fine;
 * neither means the payload is malformed.
 */
export function extractProviderEventId(payload: Record<string, unknown>): string | null {
  const direct = payload.id ?? payload.event_id ?? payload.eventId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  if (typeof direct === 'number' && Number.isFinite(direct)) return String(direct);
  return null;
}

/**
 * Drain the inbox once. Safe to call concurrently — the
 * status='pending' → 'processing' update is the claim, and a row that
 * another invocation already moved out of 'pending' is skipped.
 */
export async function processInbox(): Promise<ProcessInboxResult> {
  if (!hasDb()) {
    safeLog.warn({ event: 'webhook.processor.db_unavailable' });
    return { scanned: 0, done: 0, failed: 0, skipped: 0 };
  }
  const db = getDb();

  const rows = await db
    .select({
      id: schema.webhookInbox.id,
      provider: schema.webhookInbox.provider,
      eventId: schema.webhookInbox.eventId,
      eventType: schema.webhookInbox.eventType,
      rawBody: schema.webhookInbox.rawBody,
      attempts: schema.webhookInbox.attempts,
    })
    .from(schema.webhookInbox)
    .where(eq(schema.webhookInbox.processingStatus, 'pending'))
    .orderBy(asc(schema.webhookInbox.receivedAt))
    .limit(BATCH_LIMIT);

  const result: ProcessInboxResult = {
    scanned: rows.length,
    done: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const claimed = await claimRow(db, row.id);
    if (!claimed) {
      // Another worker grabbed it first. Move on — counters reflect this.
      result.skipped += 1;
      continue;
    }

    try {
      const parsed = JSON.parse(row.rawBody) as Record<string, unknown>;
      await dispatchEvent(row.provider as Provider, row.eventType, parsed, row);
      await markDone(db, row.id);
      result.done += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await markFailed(db, row.id, reason, row.attempts + 1);
      result.failed += 1;
      safeLog.error({
        event: 'webhook.processor.handler_failed',
        provider: row.provider,
        eventType: row.eventType,
        eventId: row.eventId,
        attempts: row.attempts + 1,
        terminal: row.attempts + 1 >= MAX_ATTEMPTS,
        error: reason,
      });
    }
  }

  if (result.scanned > 0) {
    safeLog.info({ event: 'webhook.processor.tick', ...result });
  }

  return result;
}

/* ---------- internal: row lifecycle ---------- */

async function claimRow(db: Db, id: string): Promise<boolean> {
  const updated = await db
    .update(schema.webhookInbox)
    .set({ processingStatus: 'processing' })
    .where(and(eq(schema.webhookInbox.id, id), eq(schema.webhookInbox.processingStatus, 'pending')))
    .returning({ id: schema.webhookInbox.id });
  return updated.length === 1;
}

async function markDone(db: Db, id: string): Promise<void> {
  await db
    .update(schema.webhookInbox)
    .set({
      processingStatus: 'done',
      processedAt: new Date(),
      failureReason: null,
    })
    .where(eq(schema.webhookInbox.id, id));
}

async function markFailed(db: Db, id: string, reason: string, nextAttempts: number): Promise<void> {
  // Below MAX_ATTEMPTS: leave as 'pending' so the next tick retries.
  // At/above MAX_ATTEMPTS: mark 'failed' for ops review (eventual DLQ).
  const terminal = nextAttempts >= MAX_ATTEMPTS;
  await db
    .update(schema.webhookInbox)
    .set({
      processingStatus: terminal ? 'failed' : 'pending',
      attempts: nextAttempts,
      failureReason: reason.slice(0, 1024),
      processedAt: terminal ? new Date() : null,
    })
    .where(eq(schema.webhookInbox.id, id));
}

/* ---------- dispatch table ---------- */

/**
 * Per-provider event router. Each branch is a STUB that logs the
 * delivery and returns ok — the actual state mutations (DB writes
 * into `mids`, `decisions`, `audit_log`, etc.) are intentionally
 * deferred so we ship the inbox primitive without entangling Task #43
 * with the orchestrator + billing wiring.
 *
 * Adding real processing later is purely additive: replace the
 * `handle*` body with the persistence logic; the inbox row stays the
 * source of truth + replay fixture.
 */
async function dispatchEvent(
  provider: Provider,
  eventType: string,
  body: Record<string, unknown>,
  row: InboxRow,
): Promise<void> {
  switch (provider) {
    case 'micamp':
      return handleMicamp(eventType, body, row);
    case 'highsale':
      return handleHighsale(eventType, body, row);
    case 'trutopia':
      return handleTrutopia(eventType, body, row);
    default:
      throw new Error(`unknown_provider:${provider}`);
  }
}

async function handleMicamp(
  eventType: string,
  _body: Record<string, unknown>,
  row: InboxRow,
): Promise<void> {
  // Stubs: log + return. Each TODO below is the downstream wiring.
  switch (eventType) {
    case 'mid.underwriting.approved':
      // TODO(orchestrator): UPDATE mids SET provisioning_status='active', micamp_mid=$1, rate_card_json=$2 WHERE id=$3
      logHandled(row);
      return;
    case 'mid.underwriting.rejected':
      // TODO(orchestrator): UPDATE mids SET provisioning_status='rejected' WHERE id=$1; INSERT INTO audit_log ...
      logHandled(row);
      return;
    case 'mid.post_underwriting':
      // TODO(orchestrator): UPDATE mids SET provisioning_status='underwriting_post', post_underwriting_at=now() WHERE id=$1
      logHandled(row);
      return;
    case 'payment.captured':
      // TODO(orchestrator): UPDATE mids SET volume_cents_to_date = volume_cents_to_date + $1 WHERE id=$2
      logHandled(row);
      return;
    case 'payment.refunded':
      // TODO(orchestrator): UPDATE mids SET volume_cents_to_date = GREATEST(0, volume_cents_to_date - $1) WHERE id=$2
      logHandled(row);
      return;
    case 'settlement.paid':
      // TODO(orchestrator): UPDATE mids SET last_settled_at=$1 WHERE id=$2
      logHandled(row);
      return;
    default:
      throw new Error(`unknown_event_type:micamp:${eventType}`);
  }
}

async function handleHighsale(
  eventType: string,
  _body: Record<string, unknown>,
  row: InboxRow,
): Promise<void> {
  switch (eventType) {
    case 'pull.completed':
      // TODO(orchestrator): INSERT INTO decisions ...; fan out to lender marketplace
      logHandled(row);
      return;
    case 'pull.failed':
      // TODO(orchestrator): UPDATE applications SET status='declined', mark FCRA reason
      logHandled(row);
      return;
    case 'subaccount.suspended':
      // TODO(orchestrator): UPDATE partners SET status='throttled'; INSERT INTO audit_log
      logHandled(row);
      return;
    case 'milly.invoice.issued':
      // TODO(billing): wire to invoicing.ts to persist + render in partner dashboard
      logHandled(row);
      return;
    case 'milly.invoice.paid':
      // TODO(billing): mark invoice settled
      logHandled(row);
      return;
    case 'milly.invoice.failed':
      // TODO(ops): extend probation, Slack alert
      logHandled(row);
      return;
    default:
      throw new Error(`unknown_event_type:highsale:${eventType}`);
  }
}

async function handleTrutopia(
  eventType: string,
  _body: Record<string, unknown>,
  row: InboxRow,
): Promise<void> {
  // Trutopia decision-engine callbacks. No event types are wired yet;
  // route is here so a new provider drop-in only touches this file.
  logHandled(row);
  // Unknown event types are NOT a hard error for Trutopia until the
  // contract is finalised — accept + log so we don't loop a row that
  // arrived a day before the handler ships.
  void eventType;
}

function logHandled(row: InboxRow): void {
  safeLog.info({
    event: 'webhook.processor.handled',
    provider: row.provider,
    eventType: row.eventType,
    eventId: row.eventId,
    inboxId: row.id,
  });
}

/* ---------- helpers used by the inbox routes ---------- */

/**
 * Pending-count helper for the admin tick endpoint so the operator
 * can see backlog at a glance without an extra query.
 */
export async function inboxBacklog(): Promise<{ pending: number; failed: number }> {
  if (!hasDb()) return { pending: 0, failed: 0 };
  const db = getDb();
  const rows = await db
    .select({
      status: schema.webhookInbox.processingStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.webhookInbox)
    .groupBy(schema.webhookInbox.processingStatus);
  let pending = 0;
  let failed = 0;
  for (const r of rows) {
    if (r.status === 'pending') pending = Number(r.count);
    if (r.status === 'failed') failed = Number(r.count);
  }
  return { pending, failed };
}
