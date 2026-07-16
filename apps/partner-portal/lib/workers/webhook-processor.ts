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
 * Handlers are STUBS during the build-out window. The dispatch skeleton
 * is correct + idempotent; the actual state mutations (mids, decisions,
 * audit_log writes) are downstream work tracked on each handler's TODO.
 *
 * Stubs throw NotImplementedError → inbox row stays in `failed` for ops
 * review. This is intentional fail-loud during the build-out window;
 * safer than silent acks that mask real partner state-sync gaps. The
 * earlier "log + return ok" posture was only defensible while the
 * alternative was a crashing worker — now that the dispatch skeleton is
 * stable, an unimplemented handler MUST surface in the DLQ so a partner
 * event like MiCamp `loan.funded` cannot vanish without an operator
 * seeing it. The catch path treats NotImplementedError as an immediate
 * terminal failure (no backoff, no retries — retries can't help a
 * handler that doesn't exist) and bumps
 * `webhook.handler.not_implemented{provider,eventType}` so the
 * observability tile counts the gap.
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import {
  HighsaleWebhookEventSchema,
  MicampWebhookEventSchema,
  type HighsaleWebhookEvent,
  type MicampWebhookEvent,
} from '@eazepay/shared-types';
import { IntegrationErrorException } from '@eazepay/integrations-core';
import { hasDb, schema, SYSTEM_WEBHOOK_CONTEXT, withRawTenantContext } from '../db';
import type { Db, TxHandle } from '../db';
import { incrementMetric } from '../observability/metrics';
import { withSpan } from '../observability/tracing';
import { safeLog } from '../safe-log';
import { handleLenderInboxRow, isLenderProvider } from './lender-webhook-handler';

/**
 * Thrown by stub handlers that haven't been wired to their state
 * mutations yet. The processor treats this as an immediate terminal
 * failure: the inbox row is marked `failed` (not `pending`) with a
 * structured `failure_reason`, no retry is scheduled, and the row
 * shows up in the DLQ surface for an operator to triage.
 *
 * Why terminal-immediate: a handler that hasn't been implemented won't
 * succeed on attempt 5 either, so burning retries just delays the
 * operator signal. The whole point of the fail-loud posture is to make
 * partner state-sync gaps loud + early.
 */
/**
 * Thrown when an inbound webhook body fails Zod parse against the
 * provider's discriminated-union schema. Extends
 * `IntegrationErrorException(MalformedResponse)` so the DLQ surface
 * treats it identically to a malformed integration RESPONSE (per
 * Builder F's fail-loud pattern) — same kind, same provider attribution,
 * same operator runbook. The handler dispatch path raises this in lieu
 * of an unchecked `Record<string, unknown>` switch that would silently
 * accept any shape.
 */
export class MalformedWebhookError extends IntegrationErrorException {
  constructor(provider: 'micamp' | 'highsale', eventType: string, detail: string) {
    super({
      provider,
      endpoint: `webhook:${eventType || 'unknown'}`,
      kind: 'MalformedResponse',
      message: `malformed_webhook_payload:${provider}:${eventType || 'unknown'}`,
      detail,
    });
    this.name = 'MalformedWebhookError';
  }
}

export class NotImplementedError extends Error {
  readonly code = 'handler_not_implemented' as const;
  readonly meta: { provider: string; eventType: string };
  constructor(provider: string, eventType: string) {
    super(`handler_not_implemented:${provider}:${eventType}`);
    this.name = 'NotImplementedError';
    this.meta = { provider, eventType };
  }
}

/* SEC-RLS-2 — every DB call in this worker runs through
 * `withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, ...)` so the RLS GUCs
 * are bound to the transaction. The worker fires for both the
 * admin-tick handler and the BullMQ webhook job; the synthetic operator
 * context lets the trusted server-side actor write into RLS-protected
 * tables once handlers ship, while keeping the GUC posture identical
 * across call sites. `webhook_inbox` itself is platform-global today
 * but the wrapper is forward-compatible if RLS is added later. */

/** Max rows the worker drains per tick. Keeps each invocation bounded
 * so a backlog doesn't lock a connection for minutes. BullMQ will
 * re-tick frequently; the manual admin endpoint is fine with 50. */
const BATCH_LIMIT = 50;

/** After this many consecutive failures we stop retrying on the next
 * poll. The row stays in 'failed' for ops review — eventual DLQ table.
 * 5 matches the BullMQ default attempt count we'll wire in Task #50. */
const MAX_ATTEMPTS = 5;

/**
 * Built-in providers with hand-rolled dispatch tables. Lenders are
 * handled separately — the route writes the canonical lender id
 * (e.g. `lp_buzzpay_prime`) into `webhook_inbox.provider`, and the
 * dispatcher routes any matching row to `handleLenderInboxRow`.
 * Widened to `string` here so we don't need to enumerate every lender
 * id in this type; the dispatcher's `isLenderProvider` is the gate.
 */
type Provider = string;

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
 * Process a single inbox row by id. Used by the BullMQ webhook worker
 * (`lib/queue/webhooks.ts`) — the route handler enqueues a job carrying
 * the inbox id, and the worker calls this to claim + dispatch + record.
 *
 * Throws on handler failure so BullMQ can apply its retry / backoff
 * policy. The row's `attempts` counter is incremented inside catch so
 * an ops view of the inbox still reflects retry pressure even when
 * the actual retry scheduling has moved to Redis.
 *
 * If the row is not found (e.g. a job arrives after a hard rollback)
 * we return early without throwing — there's nothing to retry against.
 *
 * NotImplementedError is special-cased: the row is marked `failed`
 * immediately (no retry budget consumed) and the
 * `webhook.handler.not_implemented` metric is bumped for the DLQ tile.
 */
export async function processInboxRow(inboxId: string): Promise<void> {
  if (!hasDb()) {
    safeLog.warn({ event: 'webhook.processor.db_unavailable', inboxId });
    return;
  }
  // SEC-RLS-2: bind operator-tier GUCs for the inbox lookup + claim.
  const lookup = await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, async (tx) => {
    const rows = await tx
      .select({
        id: schema.webhookInbox.id,
        provider: schema.webhookInbox.provider,
        eventId: schema.webhookInbox.eventId,
        eventType: schema.webhookInbox.eventType,
        rawBody: schema.webhookInbox.rawBody,
        attempts: schema.webhookInbox.attempts,
        processingStatus: schema.webhookInbox.processingStatus,
      })
      .from(schema.webhookInbox)
      .where(eq(schema.webhookInbox.id, inboxId))
      .limit(1);
    const row = rows[0];
    if (!row) return { kind: 'not_found' as const };
    if (row.processingStatus === 'done') return { kind: 'already_done' as const };
    const claimed = await claimRow(tx, row.id);
    if (!claimed) return { kind: 'claimed_by_other' as const, row };
    return { kind: 'claimed' as const, row };
  });

  if (lookup.kind === 'not_found') {
    safeLog.warn({ event: 'webhook.processor.row_not_found', inboxId });
    return;
  }
  if (lookup.kind === 'already_done') return;
  if (lookup.kind === 'claimed_by_other') {
    safeLog.info({
      event: 'webhook.processor.row_claimed_by_other',
      inboxId,
      provider: lookup.row.provider,
    });
    return;
  }
  const row = lookup.row;
  try {
    const parsed = JSON.parse(row.rawBody) as Record<string, unknown>;
    await dispatchEvent(row.provider as Provider, row.eventType, parsed, row);
    await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, (tx) => markDone(tx, row.id));
  } catch (err) {
    if (err instanceof NotImplementedError) {
      const { provider, eventType } = err.meta;
      const reason = `handler_not_implemented:${provider}:${eventType}`;
      await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, (tx) =>
        markTerminalFailed(tx, row.id, reason, row.attempts + 1),
      );
      incrementMetric('webhook.handler.not_implemented', { provider, eventType });
      safeLog.error({
        event: 'webhook.processor.handler_not_implemented',
        provider,
        eventType,
        eventId: row.eventId,
        inboxId: row.id,
        terminal: true,
      });
      // Re-throw so BullMQ marks the job failed and the DLQ listener
      // sees the structured reason. No backoff/retry budget consumed
      // for an unimplemented handler.
      throw err;
    }
    const reason = err instanceof Error ? err.message : String(err);
    const nextAttempts = row.attempts + 1;
    await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, (tx) =>
      markFailed(tx, row.id, reason, nextAttempts),
    );
    safeLog.error({
      event: 'webhook.processor.handler_failed',
      provider: row.provider,
      eventType: row.eventType,
      eventId: row.eventId,
      attempts: nextAttempts,
      terminal: nextAttempts >= MAX_ATTEMPTS,
      error: reason,
    });
    // Re-throw so BullMQ applies its retry/backoff. The DLQ listener
    // on the worker writes the terminal failure_reason on attempts
    // exhausted (see lib/queue/dlq.ts).
    throw err;
  }
}

/**
 * Drain the inbox once. Safe to call concurrently — the
 * status='pending' → 'processing' update is the claim, and a row that
 * another invocation already moved out of 'pending' is skipped.
 *
 * @deprecated Task #50: now an ops escape hatch. The primary path is
 *   the BullMQ worker (`lib/queue/webhooks.ts`) — the route handlers
 *   enqueue a job per inbox row. Use this to drain pre-Task-#50 rows
 *   that never got an enqueue, or to re-run all `pending` rows after
 *   a handler bugfix.
 */
export async function processInbox(): Promise<ProcessInboxResult> {
  return withSpan('webhook.outbox.drain', {}, () => processInboxInner());
}

async function processInboxInner(): Promise<ProcessInboxResult> {
  if (!hasDb()) {
    safeLog.warn({ event: 'webhook.processor.db_unavailable' });
    return { scanned: 0, done: 0, failed: 0, skipped: 0 };
  }

  // SEC-RLS-2: GUC-bind the SELECT. Each row's claim + finalisation
  // get their own txn below so a slow handler doesn't hold a row lock
  // across the entire batch.
  const rows = await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, (tx) =>
    tx
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
      .limit(BATCH_LIMIT),
  );

  const result: ProcessInboxResult = {
    scanned: rows.length,
    done: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const claimed = await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, (tx) =>
      claimRow(tx, row.id),
    );
    if (!claimed) {
      // Another worker grabbed it first. Move on — counters reflect this.
      result.skipped += 1;
      continue;
    }

    try {
      const parsed = JSON.parse(row.rawBody) as Record<string, unknown>;
      await dispatchEvent(row.provider as Provider, row.eventType, parsed, row);
      await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, (tx) => markDone(tx, row.id));
      result.done += 1;
    } catch (err) {
      if (err instanceof NotImplementedError) {
        const { provider, eventType } = err.meta;
        const reason = `handler_not_implemented:${provider}:${eventType}`;
        await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, (tx) =>
          markTerminalFailed(tx, row.id, reason, row.attempts + 1),
        );
        incrementMetric('webhook.handler.not_implemented', { provider, eventType });
        result.failed += 1;
        safeLog.error({
          event: 'webhook.processor.handler_not_implemented',
          provider,
          eventType,
          eventId: row.eventId,
          inboxId: row.id,
          terminal: true,
        });
        continue;
      }
      const reason = err instanceof Error ? err.message : String(err);
      await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, (tx) =>
        markFailed(tx, row.id, reason, row.attempts + 1),
      );
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

async function claimRow(db: Db | TxHandle, id: string): Promise<boolean> {
  const updated = await db
    .update(schema.webhookInbox)
    .set({ processingStatus: 'processing' })
    .where(and(eq(schema.webhookInbox.id, id), eq(schema.webhookInbox.processingStatus, 'pending')))
    .returning({ id: schema.webhookInbox.id });
  return updated.length === 1;
}

async function markDone(db: Db | TxHandle, id: string): Promise<void> {
  await db
    .update(schema.webhookInbox)
    .set({
      processingStatus: 'done',
      processedAt: new Date(),
      failureReason: null,
    })
    .where(eq(schema.webhookInbox.id, id));
}

/**
 * Mark a row as immediately terminal-failed regardless of attempts.
 * Used when the failure mode is non-retryable (e.g. a stub handler
 * that hasn't been implemented). Skips backoff, leaves the row in
 * `failed` for ops review on the very first encounter.
 */
async function markTerminalFailed(
  db: Db | TxHandle,
  id: string,
  reason: string,
  nextAttempts: number,
): Promise<void> {
  await db
    .update(schema.webhookInbox)
    .set({
      processingStatus: 'failed',
      attempts: nextAttempts,
      failureReason: reason.slice(0, 1024),
      processedAt: new Date(),
    })
    .where(eq(schema.webhookInbox.id, id));
}

async function markFailed(
  db: Db | TxHandle,
  id: string,
  reason: string,
  nextAttempts: number,
): Promise<void> {
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
 * Per-provider event router. Each branch is a STUB that THROWS
 * `NotImplementedError` until the persistence logic (writes into
 * `mids`, `decisions`, `audit_log`, applications, etc.) is wired by
 * the orchestrator team. The processor's catch path turns that into
 * an immediate terminal `failed` row — no silent ack, no wasted
 * retries — and bumps `webhook.handler.not_implemented` so the gap
 * is visible on the observability tile.
 *
 * Adding real processing later is purely additive: replace the
 * `throw new NotImplementedError(...)` with the persistence logic and
 * the row will be acked on the next delivery. The inbox row remains
 * the source of truth + replay fixture, so historical `failed` rows
 * can be re-driven through `processInbox()` once the handler ships.
 */
async function dispatchEvent(
  provider: Provider,
  eventType: string,
  body: Record<string, unknown>,
  row: InboxRow,
): Promise<void> {
  // Wrap every handler dispatch in a span so a hung MiCamp or HighSale
  // handler shows up in the trace timeline rather than as a generic
  // BullMQ job duration. Attributes are deliberately bounded —
  // provider + eventType are both members of the integration catalogue
  // (4 providers × ~10 events) so cardinality stays well inside budget.
  return withSpan(
    'webhook.handler.dispatch',
    {
      'business.provider': provider,
      'business.event_type': eventType,
      'business.event_id': row.eventId,
      'business.inbox_id': row.id,
    },
    async () => {
      // Lender slugs (e.g. `lp_buzzpay_prime`) live in their own dispatch
      // module — checked FIRST so a lender id never accidentally matches
      // a built-in provider literal.
      if (isLenderProvider(provider)) {
        return handleLenderInboxRow({ provider, rawBody: row.rawBody });
      }
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
    },
  );
}

/**
 * Parse a webhook body against a provider's discriminated-union schema
 * before dispatch. The wire format from both providers is `{ type, ...fields }`
 * so we merge `type` into the body to drive Zod's discriminator. Parse
 * failure → `MalformedWebhookError` → terminal DLQ entry (Builder F
 * fail-loud).
 *
 * We can't validate `type` against the union's literals here (Zod's
 * discriminatedUnion does that internally), so any unknown event type
 * also lands as a malformed payload — which is correct: an event type
 * the contract doesn't list is, by definition, a contract drift.
 */
function parseWebhookEvent<T>(
  provider: 'micamp' | 'highsale',
  eventType: string,
  body: Record<string, unknown>,
  schema: {
    safeParse: (
      v: unknown,
    ) => { success: true; data: T } | { success: false; error: { message: string } };
  },
): T {
  const result = schema.safeParse({ ...body, type: eventType });
  if (!result.success) {
    throw new MalformedWebhookError(provider, eventType, result.error.message);
  }
  return result.data;
}

/**
 * Exhaustiveness helper — if a new variant is added to the schema
 * without a handler branch, the `never` narrowing fails at compile
 * time. Safer than a runtime default-case alone.
 */
function assertNever(x: never): never {
  throw new Error(`unhandled_webhook_variant:${JSON.stringify(x)}`);
}

async function handleMicamp(
  eventType: string,
  body: Record<string, unknown>,
  row: InboxRow,
): Promise<void> {
  // Fail-loud stubs. Each TODO below names the downstream wiring;
  // until that lands, NotImplementedError → terminal `failed` row in
  // the inbox so a real partner event (e.g. `loan.funded`) cannot
  // vanish under a silent ack. See file header for the posture.
  void row;
  const event: MicampWebhookEvent = parseWebhookEvent(
    'micamp',
    eventType,
    body,
    MicampWebhookEventSchema,
  );
  switch (event.type) {
    case 'mid.underwriting.approved':
      // TODO(orchestrator): UPDATE mids SET provisioning_status='active', micamp_mid=$1, rate_card_json=$2 WHERE id=$3
      throw new NotImplementedError('micamp', event.type);
    case 'mid.underwriting.rejected':
      // TODO(orchestrator): UPDATE mids SET provisioning_status='rejected' WHERE id=$1; INSERT INTO audit_log ...
      throw new NotImplementedError('micamp', event.type);
    case 'mid.post_underwriting':
      // TODO(orchestrator): UPDATE mids SET provisioning_status='underwriting_post', post_underwriting_at=now() WHERE id=$1
      throw new NotImplementedError('micamp', event.type);
    case 'payment.captured':
      // TODO(orchestrator): UPDATE mids SET volume_cents_to_date = volume_cents_to_date + $1 WHERE id=$2
      throw new NotImplementedError('micamp', event.type);
    case 'payment.refunded':
      // TODO(orchestrator): UPDATE mids SET volume_cents_to_date = GREATEST(0, volume_cents_to_date - $1) WHERE id=$2
      throw new NotImplementedError('micamp', event.type);
    case 'settlement.paid':
      // TODO(orchestrator): UPDATE mids SET last_settled_at=$1 WHERE id=$2
      throw new NotImplementedError('micamp', event.type);
    default:
      return assertNever(event);
  }
}

async function handleHighsale(
  eventType: string,
  body: Record<string, unknown>,
  row: InboxRow,
): Promise<void> {
  void row;
  const event: HighsaleWebhookEvent = parseWebhookEvent(
    'highsale',
    eventType,
    body,
    HighsaleWebhookEventSchema,
  );
  switch (event.type) {
    case 'pull.completed':
      // TODO(orchestrator): INSERT INTO decisions ...; fan out to lender marketplace
      throw new NotImplementedError('highsale', event.type);
    case 'pull.failed':
      // TODO(orchestrator): UPDATE applications SET status='declined', mark FCRA reason
      throw new NotImplementedError('highsale', event.type);
    case 'subaccount.suspended':
      // TODO(orchestrator): UPDATE partners SET status='throttled'; INSERT INTO audit_log
      throw new NotImplementedError('highsale', event.type);
    case 'milly.invoice.issued':
      // TODO(billing): wire to invoicing.ts to persist + render in partner dashboard
      throw new NotImplementedError('highsale', event.type);
    case 'milly.invoice.paid':
      // TODO(billing): mark invoice settled
      throw new NotImplementedError('highsale', event.type);
    case 'milly.invoice.failed':
      // TODO(ops): extend probation, Slack alert
      throw new NotImplementedError('highsale', event.type);
    default:
      return assertNever(event);
  }
}

async function handleTrutopia(
  eventType: string,
  _body: Record<string, unknown>,
  row: InboxRow,
): Promise<void> {
  // Trutopia decision-engine callbacks. No event types are wired yet;
  // route is here so a new provider drop-in only touches this file.
  // Fail-loud: every Trutopia delivery is a NotImplementedError until
  // the contract is finalised + a handler ships. The prior "accept +
  // log so we don't loop a row" rationale was the silent-ack failure
  // mode that this PR exists to remove — a Trutopia event arriving
  // before its handler ships SHOULD land in the DLQ so an operator
  // notices the timing mismatch.
  void row;
  throw new NotImplementedError('trutopia', eventType || 'unknown');
}

/* ---------- helpers used by the inbox routes ---------- */

/**
 * Pending-count helper for the admin tick endpoint so the operator
 * can see backlog at a glance without an extra query.
 */
export async function inboxBacklog(): Promise<{ pending: number; failed: number }> {
  if (!hasDb()) return { pending: 0, failed: 0 };
  // SEC-RLS-2: GUC-bound count even though webhook_inbox is non-RLS.
  const rows = await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, (tx) =>
    tx
      .select({
        status: schema.webhookInbox.processingStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.webhookInbox)
      .groupBy(schema.webhookInbox.processingStatus),
  );
  let pending = 0;
  let failed = 0;
  for (const r of rows) {
    if (r.status === 'pending') pending = Number(r.count);
    if (r.status === 'failed') failed = Number(r.count);
  }
  return { pending, failed };
}
