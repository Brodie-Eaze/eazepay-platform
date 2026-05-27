/**
 * Data-access helpers for `consent_receipts`.
 *
 * Append-only by construction: no `updateReceipt` / `deleteReceipt`
 * helpers are exported and the underlying DB role has UPDATE + DELETE
 * revoked (see drizzle/0011_consent_receipts.sql). The only mutation
 * surface is `storeReceipt` (INSERT) plus the two lookup helpers.
 *
 * Why this file exists (vs. inlining drizzle calls in the route):
 *   * Single chokepoint for the FCRA audit chain — every test, every
 *     route, every backfill goes through the same INSERT shape.
 *   * Keeps `lib/consumer-consent.ts` free of `pg` imports so the
 *     module remains importable from the client bundle (it currently
 *     exposes `captureConsent` to the browser).
 */

import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema } from './index';
import type { ConsentReceiptRow, NewConsentReceiptRow } from './schema';

export type StoredConsentReceipt = ConsentReceiptRow;

/**
 * Insert a consent receipt. Returns the persisted row exactly as the
 * DB stored it, so callers see the server-stamped `capturedAt` /
 * `createdAt` rather than the wall-clock value we passed in.
 *
 * The `id` is supplied by the caller (server-minted UUID surfaced
 * back to the consumer apply flow); we do not let Postgres mint one.
 * Same-session retries reuse the existing receipt id at the caller
 * layer — at the SQL layer every row is a NEW insert because the
 * table is append-only. A duplicate id collision is therefore a
 * legitimate protocol error and is surfaced to the caller.
 */
export async function storeReceipt(input: NewConsentReceiptRow): Promise<StoredConsentReceipt> {
  const db = getDb();
  const [row] = await db.insert(schema.consentReceipts).values(input).returning();
  if (!row) {
    throw new Error('consent_receipts insert returned no row');
  }
  return row;
}

/** O(1) lookup by receipt id — the FCRA verifier's hot path. */
export async function getReceiptById(id: string): Promise<StoredConsentReceipt | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.consentReceipts)
    .where(eq(schema.consentReceipts.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * All receipts captured against a given applicationId, oldest first.
 * Used by the operator dispute viewer + by `storeConsentReceipt` to
 * detect same-session retries before issuing a new id.
 */
export async function getReceiptByApplicationId(
  applicationId: string,
): Promise<StoredConsentReceipt[]> {
  const db = getDb();
  return db
    .select()
    .from(schema.consentReceipts)
    .where(eq(schema.consentReceipts.applicationId, applicationId))
    .orderBy(asc(schema.consentReceipts.capturedAt));
}

/**
 * Find the most recent receipt for a specific (applicationId, sessionId)
 * tuple. Mirrors the pre-fix in-memory composite index — the consumer
 * apply flow retries by re-POSTing with the same applicationId +
 * sessionId, and we want the SAME receipt id to come back so the
 * downstream prequal call doesn't see a "new" receipt mid-session.
 */
export async function getLatestReceiptForSession(
  applicationId: string,
  sessionId: string,
): Promise<StoredConsentReceipt | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.consentReceipts)
    .where(
      and(
        eq(schema.consentReceipts.applicationId, applicationId),
        eq(schema.consentReceipts.sessionId, sessionId),
      ),
    )
    .orderBy(asc(schema.consentReceipts.capturedAt));
  return rows[rows.length - 1] ?? null;
}
