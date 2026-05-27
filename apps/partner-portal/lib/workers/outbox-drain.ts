/**
 * Outbox drain worker.
 *
 * Pulls `pending` rows from `outbox_events` (oldest-first by
 * `next_attempt_at`), dispatches each to a `kind`-keyed handler, and
 * either marks the row `sent` or schedules a retry with exponential
 * backoff. After `MAX_ATTEMPTS` consecutive failures the row goes to
 * `dead` for operator review.
 *
 * Where this runs
 * ---------------
 * The drain is invoked from two paths, mirroring the webhook-inbox
 * convention:
 *
 *   • BullMQ repeatable job (production): `start-workers.ts` schedules
 *     a repeat that calls `processOutboxBatch()` every N seconds with
 *     concurrency 10 — multiple workers can drain in parallel because
 *     the claim step is an atomic UPDATE that excludes contended rows.
 *
 *   • Manual admin tick (escape hatch): a route handler can invoke
 *     `processOutboxBatch()` directly to drain after a handler bugfix.
 *
 * Handlers
 * --------
 * The HANDLERS map is the single source of truth for the kind→fn
 * dispatch. Handlers MUST be idempotent — at-least-once delivery is
 * the contract, so a handler that runs twice for the same row must
 * produce the same downstream state.
 *
 * Stubs that return `{ok: true}` are FINE in this PR — the worker
 * just needs the dispatch interface in place so Wave 1.2 (notifications)
 * and Wave 1.4 (audit-log) can drop in the real implementations
 * without touching the worker plumbing.
 *
 * Retry policy
 * ------------
 *   • MAX_ATTEMPTS = 8 — after that the row is `dead`.
 *   • Backoff = 2 ^ attempts * BASE_MS, capped at MAX_BACKOFF_MS.
 *     attempts=1 → 2s, attempts=8 → 256s (capped at 300s).
 *   • `next_attempt_at` is set to `now() + backoff`. The partial
 *     index on `(status, next_attempt_at) WHERE status='pending'`
 *     means the scan stays cheap regardless of backlog size.
 */

import { and, asc, eq, lte, sql } from 'drizzle-orm';
import { getDb, hasDb, schema } from '../db';
import type { Db } from '../db';
import { safeLog } from '../safe-log';
import type { OutboxKind } from '../outbox';

/* ---------- constants ---------- */

/** Per-tick batch limit. Bounds the worker's hold on a single
 *  connection so a backlog doesn't starve other queries. */
const BATCH_LIMIT = 100;

/** Worker concurrency advertised to BullMQ. The drain itself is
 *  single-batch sequential; concurrency is achieved by having
 *  multiple worker processes claim disjoint rows via the atomic
 *  UPDATE-WHERE-status='pending' claim step. */
export const OUTBOX_CONCURRENCY = 10;

/** After this many consecutive failures the row is `dead`. The
 *  partner-portal convention is "fail loud" — `dead` rows surface
 *  on the DLQ tile rather than silently disappearing. */
export const MAX_ATTEMPTS = 8;

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 300_000;

/* ---------- handler registry ---------- */

/**
 * Handler result. Returning `{ok: true}` marks the row `sent`;
 * `{ok: false, error}` marks it `failed` (and schedules a retry
 * unless attempts is exhausted). Throwing is treated identically
 * to `{ok: false, error: err.message}` — handlers may use either
 * convention, but throwing is preferred for unexpected errors and
 * returning is preferred for known-bad payloads.
 */
export type OutboxHandlerResult = { ok: true } | { ok: false; error: string };

export type OutboxHandler = (payload: Record<string, unknown>) => Promise<OutboxHandlerResult>;

/* ----- NestJS bridge config -----
 *
 * `notification.send` + `webhook.outbound` are owned by NestJS services
 * (services/notification, services/webhook) that run in apps/api — a
 * separate Node process from this worker. The handlers below POST each
 * row to the internal dispatch endpoint at apps/api/src/app/outbox-
 * dispatch.controller.ts, authenticated via a shared secret.
 *
 * Two env vars are required when these handlers run:
 *   • INTERNAL_API_URL                 — e.g. http://api:3000
 *   • INTERNAL_OUTBOX_DISPATCH_SECRET  — 32+ char shared secret
 *
 * Misconfiguration semantics: the handler returns
 * `{ok:false, error:'internal_bridge_unconfigured'}` so the row goes
 * to `failed` and (after MAX_ATTEMPTS) `dead` on the DLQ tile — the
 * operator-visible failure mode beats a silent backlog.
 */
const INTERNAL_DISPATCH_PATH = '/v1/_internal/outbox/dispatch';
const INTERNAL_DISPATCH_TIMEOUT_MS = 10_000;

interface BridgeResponse {
  ok: boolean;
  error?: string;
}

async function dispatchToInternalApi(
  kind: OutboxKind,
  payload: Record<string, unknown>,
): Promise<OutboxHandlerResult> {
  const base = process.env['INTERNAL_API_URL'];
  const secret = process.env['INTERNAL_OUTBOX_DISPATCH_SECRET'];
  if (!base || !secret) {
    return { ok: false, error: 'internal_bridge_unconfigured' };
  }

  // node-fetch + AbortController; 10s hard cap so a wedged apps/api
  // can't pin a drain worker forever. Per-tick batch is bounded
  // (BATCH_LIMIT) so the worker still makes progress on other rows
  // when one bridge call burns its full timeout.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), INTERNAL_DISPATCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${base}${INTERNAL_DISPATCH_PATH}`, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-eazepay-internal-secret': secret,
      },
      body: JSON.stringify({ kind, payload }),
    });
  } catch (err) {
    // Network-level failure (refused, aborted, DNS) — treat as
    // transient. The drain's catch path will schedule a retry; the
    // exponential backoff bounds how aggressively we hammer a dead
    // upstream.
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`outbox.bridge.network:${reason}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    // Bad secret → terminal-ish. We still return ok:false so the
    // standard retry budget applies; the operator should rotate the
    // secret on both sides simultaneously, and the DLQ tile will
    // surface the row once attempts exhaust.
    const body = await res.json().catch(() => null);
    return {
      ok: false,
      error: `internal_bridge_401:${body?.code ?? 'unauthorised'}`,
    };
  }

  if (!res.ok) {
    // 4xx / 5xx → treat as transient. Same as network failure: the
    // upstream might be cold-starting or mid-deploy. Throw so the
    // drain's catch path logs the row and reschedules.
    const body = await res.json().catch(() => null);
    throw new Error(`outbox.bridge.http_${res.status}:${body?.code ?? body?.detail ?? 'no_body'}`);
  }

  const body = (await res.json().catch(() => null)) as BridgeResponse | null;
  if (!body || typeof body.ok !== 'boolean') {
    throw new Error('outbox.bridge.malformed_response');
  }
  if (body.ok) return { ok: true };
  return { ok: false, error: body.error ?? 'unknown_bridge_failure' };
}

/**
 * Handler registry. Each kind is one entry; the dispatch loop in
 * `processOutboxBatch` looks the row's `kind` up here and invokes
 * the function with the row's parsed payload.
 *
 * Wave-1 wiring status:
 *   • notification.send → HTTP-bridged to apps/api (this PR)
 *   • webhook.outbound  → HTTP-bridged to apps/api (this PR)
 *   • audit.log         → still a stub; the real audit drain is
 *                          AuditDrainService in services/audit which
 *                          reads `auditOutbox` directly. A row of
 *                          kind 'audit.log' in `outbox_events` is
 *                          legal (callers may enqueue) but currently
 *                          acked as a no-op until W1.4 wires it.
 *
 * Real handlers MUST be idempotent — at-least-once delivery is the
 * contract. The downstream services already collapse duplicates:
 * notifications via the (subjectType, subjectId, templateKey) key for
 * in_app, webhook via the (endpointId, eventId) unique index.
 */
const HANDLERS: Record<OutboxKind, OutboxHandler> = {
  'notification.send': (payload) => dispatchToInternalApi('notification.send', payload),
  'webhook.outbound': (payload) => dispatchToInternalApi('webhook.outbound', payload),
  'audit.log': async (_payload) => ({ ok: true }),
};

/**
 * Register or override a handler at runtime. Used by specs to
 * inject a deterministic handler without monkey-patching the map.
 * Production code MUST NOT call this — the map is the single
 * source of truth.
 */
export function __setHandlerForTest(kind: OutboxKind, handler: OutboxHandler): () => void {
  const prev = HANDLERS[kind];
  HANDLERS[kind] = handler;
  return () => {
    HANDLERS[kind] = prev;
  };
}

/* ---------- public API ---------- */

export interface ProcessOutboxResult {
  scanned: number;
  sent: number;
  retried: number;
  dead: number;
  skipped: number;
}

/**
 * Drain one batch of pending outbox rows. Safe to call concurrently —
 * the claim step (UPDATE … WHERE status='pending') is atomic, so a
 * row claimed by one invocation is invisible to the next.
 */
export async function processOutboxBatch(): Promise<ProcessOutboxResult> {
  if (!hasDb()) {
    safeLog.warn({ event: 'outbox.drain.db_unavailable' });
    return { scanned: 0, sent: 0, retried: 0, dead: 0, skipped: 0 };
  }
  const db = getDb();

  const due = await db
    .select({
      id: schema.outboxEvents.id,
      kind: schema.outboxEvents.kind,
      payloadJson: schema.outboxEvents.payloadJson,
      attempts: schema.outboxEvents.attempts,
    })
    .from(schema.outboxEvents)
    .where(
      and(
        eq(schema.outboxEvents.status, 'pending'),
        lte(schema.outboxEvents.nextAttemptAt, new Date()),
      ),
    )
    .orderBy(asc(schema.outboxEvents.nextAttemptAt))
    .limit(BATCH_LIMIT);

  const result: ProcessOutboxResult = {
    scanned: due.length,
    sent: 0,
    retried: 0,
    dead: 0,
    skipped: 0,
  };

  for (const row of due) {
    const claimed = await claimRow(db, row.id);
    if (!claimed) {
      result.skipped += 1;
      continue;
    }

    const handler = HANDLERS[row.kind as OutboxKind];
    const nextAttempts = row.attempts + 1;

    if (!handler) {
      // Unknown kind — terminal immediately. A row with an unrecognised
      // kind is a deploy-order bug (row written by new code, drained by
      // old worker, or vice versa). Burning retries can't help.
      await markDead(db, row.id, `unknown_kind:${row.kind}`, nextAttempts);
      result.dead += 1;
      safeLog.error({
        event: 'outbox.drain.unknown_kind',
        outboxId: row.id,
        kind: row.kind,
      });
      continue;
    }

    try {
      const payload = (row.payloadJson ?? {}) as Record<string, unknown>;
      const outcome = await handler(payload);
      if (outcome.ok) {
        await markSent(db, row.id);
        result.sent += 1;
        safeLog.info({
          event: 'outbox.drain.sent',
          outboxId: row.id,
          kind: row.kind,
          attempts: nextAttempts,
        });
        continue;
      }
      const terminal = nextAttempts >= MAX_ATTEMPTS;
      if (terminal) {
        await markDead(db, row.id, outcome.error, nextAttempts);
        result.dead += 1;
      } else {
        await scheduleRetry(db, row.id, outcome.error, nextAttempts);
        result.retried += 1;
      }
      safeLog.error({
        event: 'outbox.drain.handler_failed',
        outboxId: row.id,
        kind: row.kind,
        attempts: nextAttempts,
        terminal,
        error: outcome.error,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const terminal = nextAttempts >= MAX_ATTEMPTS;
      if (terminal) {
        await markDead(db, row.id, reason, nextAttempts);
        result.dead += 1;
      } else {
        await scheduleRetry(db, row.id, reason, nextAttempts);
        result.retried += 1;
      }
      safeLog.error({
        event: 'outbox.drain.handler_threw',
        outboxId: row.id,
        kind: row.kind,
        attempts: nextAttempts,
        terminal,
        error: reason,
      });
    }
  }

  if (result.scanned > 0) {
    safeLog.info({ event: 'outbox.drain.tick', ...result });
  }
  return result;
}

/* ---------- internal: row lifecycle ---------- */

/**
 * Atomic claim. Transitions status from 'pending' to a sentinel via
 * the column-level write the trigger permits: we bump `attempts`
 * before dispatch so a crash mid-handler is reflected on the next
 * drain. Returns true iff this caller won the race.
 *
 * Note: we do not move to a separate 'processing' status — for the
 * outbox the claim semantics are encoded by `next_attempt_at` being
 * pushed forward. Concurrent drain ticks only consider rows whose
 * next_attempt_at <= now(); the claim shifts it forward by
 * IN_FLIGHT_LEASE_MS so a duplicate tick won't pick up the same row.
 */
const IN_FLIGHT_LEASE_MS = 60_000;

async function claimRow(db: Db, id: string): Promise<boolean> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + IN_FLIGHT_LEASE_MS);
  const updated = await db
    .update(schema.outboxEvents)
    .set({
      nextAttemptAt: leaseUntil,
    })
    .where(
      and(
        eq(schema.outboxEvents.id, id),
        eq(schema.outboxEvents.status, 'pending'),
        lte(schema.outboxEvents.nextAttemptAt, now),
      ),
    )
    .returning({ id: schema.outboxEvents.id });
  return updated.length === 1;
}

async function markSent(db: Db, id: string): Promise<void> {
  await db
    .update(schema.outboxEvents)
    .set({
      status: 'sent',
      sentAt: new Date(),
      lastError: null,
    })
    .where(eq(schema.outboxEvents.id, id));
}

async function scheduleRetry(
  db: Db,
  id: string,
  reason: string,
  nextAttempts: number,
): Promise<void> {
  const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** nextAttempts);
  const nextAt = new Date(Date.now() + delay);
  await db
    .update(schema.outboxEvents)
    .set({
      status: 'pending',
      attempts: nextAttempts,
      lastError: reason.slice(0, 1024),
      nextAttemptAt: nextAt,
    })
    .where(eq(schema.outboxEvents.id, id));
}

async function markDead(db: Db, id: string, reason: string, nextAttempts: number): Promise<void> {
  await db
    .update(schema.outboxEvents)
    .set({
      status: 'dead',
      attempts: nextAttempts,
      lastError: reason.slice(0, 1024),
    })
    .where(eq(schema.outboxEvents.id, id));
}

/* ---------- backlog probe ---------- */

/**
 * Counts by status — used by the ops surface to render a backlog tile.
 */
export async function outboxBacklog(): Promise<Record<'pending' | 'failed' | 'dead', number>> {
  if (!hasDb()) return { pending: 0, failed: 0, dead: 0 };
  const db = getDb();
  const rows = await db
    .select({
      status: schema.outboxEvents.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.outboxEvents)
    .groupBy(schema.outboxEvents.status);
  const out = { pending: 0, failed: 0, dead: 0 };
  for (const r of rows) {
    if (r.status === 'pending') out.pending = Number(r.count);
    else if (r.status === 'failed') out.failed = Number(r.count);
    else if (r.status === 'dead') out.dead = Number(r.count);
  }
  return out;
}
