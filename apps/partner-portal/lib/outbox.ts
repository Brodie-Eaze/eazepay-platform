/**
 * Transactional outbox — enqueue side-effects atomically with the
 * business write that needs them.
 *
 * Why this exists
 * ---------------
 * A route handler that mutates Postgres AND fires a notification /
 * outbound webhook / audit-log write has historically done it in two
 * separate steps: the DB commit, then the side-effect call. The two
 * are NOT atomic. If the process dies between them — or the side-
 * effect call fails after the response is already returned — partners
 * end up with state-sync gaps that surface as silent-failure bugs.
 *
 * The fix is the textbook transactional-outbox pattern:
 *
 *   1. The business write opens a Postgres transaction.
 *   2. Inside the same tx, `enqueueOutbox(tx, ...)` INSERTs a row
 *      into `outbox_events`.
 *   3. The tx commits or rolls back as one unit.
 *   4. A separate drain worker (`lib/workers/outbox-drain.ts`)
 *      picks up `pending` rows, dispatches them via the handler
 *      registry, and marks them `sent` / retries / dead.
 *
 * The enqueue function takes a `TxHandle` (Drizzle transaction
 * argument) rather than the top-level `Db`. That is the load-bearing
 * invariant: callers cannot accidentally enqueue outside a tx and
 * lose atomicity. If a caller has no transaction, they should open
 * one with `getDb().transaction(...)` or `withTenantContext(...)`.
 *
 * The `kind` string is the dispatch discriminator — its full vocabulary
 * lives in the drain worker's handler registry. Keep them dotted
 * (`domain.event`) and stable; renaming a kind is a coordinated
 * deploy because rows already in the table may still carry the old
 * value.
 */

import { sql } from 'drizzle-orm';
import { schema } from './db';
import type { TxHandle } from './db';
import { safeLog } from './safe-log';

/**
 * The canonical outbox-kind vocabulary. STUB handlers exist for each
 * of these in `lib/workers/outbox-drain.ts`; real wiring lands in the
 * follow-up tasks (W1.2 notifications, W1.4 audit-log).
 *
 * Closed union forces every call site through TypeScript, which
 * keeps the kind→handler map honest. Adding a new kind is a two-step
 * change: extend this union, then register a handler in the drain
 * worker.
 */
export type OutboxKind = 'notification.send' | 'webhook.outbound' | 'audit.log';

export interface EnqueueOutboxInput {
  kind: OutboxKind;
  /** Handler-specific payload. The drain worker re-parses per `kind`;
   *  the table stores it verbatim as jsonb. */
  payload: Record<string, unknown>;
}

export interface EnqueueOutboxResult {
  id: string;
}

/**
 * Insert an outbox row inside the caller's transaction. The row
 * commits atomically with the business write — either both land
 * or neither does.
 *
 * Returns the newly minted `id` so the caller can correlate the
 * outbox row with the business entity in its own logs.
 *
 * SECURITY: payload is stored verbatim. Callers must not stash raw
 * PII; per the lib/safe-log deny-list convention, hash/tokenise
 * identifiers before they land in `payload_json`.
 */
export async function enqueueOutbox(
  tx: TxHandle,
  input: EnqueueOutboxInput,
): Promise<EnqueueOutboxResult> {
  const rows = await tx
    .insert(schema.outboxEvents)
    .values({
      kind: input.kind,
      // `sql` cast guarantees the jsonb column receives a JSON value
      // rather than a stringified one — Drizzle's `jsonb` mapping
      // already handles this, but the explicit cast documents intent
      // and survives future Drizzle version churn.
      payloadJson: input.payload,
    })
    .returning({ id: schema.outboxEvents.id });

  const row = rows[0];
  if (!row) {
    // Should be unreachable: INSERT ... RETURNING always yields a row
    // unless the statement raised. Defensive throw so a future driver
    // quirk doesn't silently swallow the enqueue.
    throw new Error('outbox.enqueue.no_row_returned');
  }

  safeLog.info({
    event: 'outbox.enqueued',
    outboxId: row.id,
    kind: input.kind,
  });

  return { id: row.id };
}

/**
 * Test-only helper: directly construct an outbox row outside a tx,
 * for specs that need to seed the table without a business write.
 * NOT exported from the package index; only consumed by `*.spec.ts`.
 */
export const __test = {
  pendingSelectClause: sql`status = 'pending'`,
};
