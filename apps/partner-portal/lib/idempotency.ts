/**
 * Caller-supplied idempotency for state-changing routes.
 *
 * Wraps the `idempotency_keys` table (see drizzle/0007_webhook_inbox.sql).
 *
 * Why a 24h TTL: long enough to cover client-side retries across a
 * mobile session resume + the longest typical browser tab sleep, short
 * enough that a forged stale key can't be replayed weeks later. After
 * the TTL we return 410 Gone — explicitly tells the caller the key is
 * dead so they mint a new one rather than silently retrying forever.
 *
 * Implicit dedupe: same `storeResponse` path, scope set by the caller
 * (e.g. `onboarding.provision.implicit`) with a much shorter TTL (5
 * min) and the key derived from `sha256(partnerId|bodyHash)`.
 */

import { createHash, randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from './db';
import { idempotencyKeys, type IdempotencyKeyRow } from './db/schema';
import { safeLog } from './safe-log';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Default replay window for caller-supplied keys. */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/** Short window for body-hash implicit dedupe (double-click defence). */
export const IMPLICIT_DEDUPE_TTL_SECONDS = 5 * 60;

const IDEMPOTENCY_HEADER = 'idempotency-key';

function problem(
  status: number,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    {
      type: `https://eazepay.com/problems/${title.toLowerCase().replace(/\s+/g, '-')}`,
      title,
      status,
      detail,
      ...extra,
    },
    { status },
  );
}

/**
 * Pull the `Idempotency-Key` header and validate it's a UUID. Returns
 * a NextResponse on failure (400) so the route can early-return.
 */
export function parseIdempotencyKeyHeader(req: NextRequest): string | NextResponse {
  const raw = req.headers.get(IDEMPOTENCY_HEADER);
  if (!raw) {
    return problem(
      400,
      'Idempotency-Key required',
      'This route requires an `Idempotency-Key` request header containing a UUIDv4. See https://eazepay.com/docs/idempotency.',
    );
  }
  if (!UUID_RE.test(raw)) {
    return problem(
      400,
      'Idempotency-Key invalid',
      'The `Idempotency-Key` header must be a UUID (8-4-4-4-12 hex).',
    );
  }
  return raw;
}

/** Stable sha256 of a JSON-serialisable value, hex-encoded. */
export function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

/**
 * Derive an implicit dedupe key from a list of stable inputs (e.g.
 * `[partnerId, requestBodyHash]`). Returns a UUID-shaped string so it
 * can sit alongside caller-supplied UUIDs in the same table without
 * ambiguity for ops queries.
 */
export function deriveImplicitKey(parts: string[]): string {
  const h = createHash('sha256').update(parts.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export interface StoredReplay {
  row: IdempotencyKeyRow;
  expired: boolean;
}

/**
 * Look up a prior call. Returns:
 *   - null            → no prior row, caller proceeds with the mutation
 *   - NextResponse    → replay (200/201/etc) OR 410 Gone OR 422 reuse-mismatch
 *
 * `expectedRequestHash` lets us catch the "same key, different body"
 * caller bug (per Stripe convention — 422 with a specific message so
 * the caller knows to mint a new key).
 */
export async function replayIfStored(
  scope: string,
  key: string,
  expectedRequestHash: string,
): Promise<NextResponse | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const nowMs = Date.now();
  if (row.expiresAt.getTime() <= nowMs) {
    safeLog.info({
      event: 'idempotency.replay.expired',
      scope,
      key,
      expiredAt: row.expiresAt.toISOString(),
    });
    return problem(
      410,
      'Idempotency-Key expired',
      'This idempotency key has expired and can no longer be replayed. Mint a fresh UUID and retry the original request.',
    );
  }

  // NOTE: we (mis-)use response_hash to store the REQUEST hash so a
  // mismatched replay is detectable. A future migration may split this
  // into request_hash + response_hash; until then the column does
  // double duty.
  if (row.responseHash && expectedRequestHash && row.responseHash !== expectedRequestHash) {
    safeLog.warn({ event: 'idempotency.replay.mismatch', scope, key });
    return problem(
      422,
      'Idempotency-Key reused with different body',
      'An idempotency key may only be replayed with the exact same request body. Mint a fresh UUID for the new request.',
    );
  }

  safeLog.info({ event: 'idempotency.replay.hit', scope, key, status: row.statusCode });

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.responseBody);
  } catch {
    safeLog.error({ event: 'idempotency.replay.corrupt_body', scope, key });
    return problem(500, 'Idempotency replay failed', 'Stored response could not be decoded.');
  }
  return NextResponse.json(parsed, { status: row.statusCode });
}

/**
 * Persist the response of a mutation against its idempotency key. The
 * unique index on (scope, key) means a racing caller that beat us to
 * the INSERT will collide here — `onConflictDoNothing` swallows that,
 * and the next replay will hit their stored row.
 */
export async function storeResponse(
  scope: string,
  key: string,
  requestHash: string,
  statusCode: number,
  body: unknown,
  ttlSeconds: number = IDEMPOTENCY_TTL_SECONDS,
): Promise<void> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  try {
    await db
      .insert(idempotencyKeys)
      .values({
        scope,
        key,
        responseHash: requestHash,
        statusCode,
        responseBody: JSON.stringify(body),
        expiresAt,
      })
      .onConflictDoNothing({ target: [idempotencyKeys.scope, idempotencyKeys.key] });
  } catch (err) {
    // Don't fail the request because we couldn't write the dedupe row —
    // the mutation already succeeded. Future retries lose dedupe but
    // that's strictly safer than rolling back a successful state change.
    safeLog.error({ event: 'idempotency.store.failed', scope, key, err });
  }
}

/** Test helper — emit a UUID in tests without importing crypto directly. */
export function newIdempotencyKey(): string {
  return randomUUID();
}
