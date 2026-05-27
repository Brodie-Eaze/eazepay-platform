/**
 * Single-use, expiring tokens for the welcome / password-reset flows.
 *
 * SEC-201 closure
 * ---------------
 * Before this module the welcome email URL embedded the raw userId
 * (`/welcome/<brand>?u=<userId>`) and `/api/account/set-password`
 * accepted `{ userId, newPassword }` with no token. Anyone who ever
 * observed the welcome URL could permanently take over the account
 * (and there are MANY places a URL leaks: browser history, referer
 * headers, screen shares, mail-server logs, the recipient's IT MITM
 * box). Replacing the userId with a single-use token closes the
 * leak — once consumed the token cannot reset the password again, and
 * a stolen-but-stale URL silently fails.
 *
 * Storage
 * -------
 * Postgres-backed when `hasDb()`. The consume path is a single atomic
 * UPDATE ... SET consumed_at = now() WHERE consumed_at IS NULL
 * RETURNING user_id, kind — Postgres MVCC guarantees only one
 * concurrent UPDATE wins, so two parallel POSTs of the same token
 * can't both succeed. Race-safe by construction; no application-level
 * locking needed.
 *
 * Dev / Railway-preview deployments without DATABASE_URL fall back to
 * the in-process Map mirror, matching the accounts-store / invites-
 * store convention so local `next dev` works without spinning up
 * Postgres. The fallback is single-replica only — production MUST set
 * DATABASE_URL (already enforced by deploy checklist).
 *
 * Token format
 * ------------
 * 32 bytes (256 bits) of crypto.randomBytes, hex-encoded → 64 chars.
 * Plenty of entropy to make guessing infeasible and short enough to
 * fit a single line in a welcome email. We don't hash the token at
 * rest because (a) it's already high-entropy random and single-use,
 * and (b) a DB compromise gives the attacker the accounts table
 * anyway, which is a strictly worse outcome than an unused token.
 */

import { randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { hasDb, getDb, schema } from './db';

export type WelcomeTokenKind = 'welcome' | 'reset';

/**
 * TTL: welcome tokens live for 14 days (mirrors the consumer-product
 * convention — long enough that a recipient who reads the email on
 * Friday and clicks the link the following weekend still succeeds,
 * short enough that a stale archive is useless). Reset tokens get
 * 1 hour — high-sensitivity, the user is actively waiting.
 */
const TTL_MS_BY_KIND: Record<WelcomeTokenKind, number> = {
  welcome: 14 * 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

interface MemoryRow {
  token: string;
  userId: string;
  kind: WelcomeTokenKind;
  expiresAt: number;
  consumedAt: number | null;
}

const MEMORY = new Map<string, MemoryRow>();

function newTokenString(): string {
  // 32 bytes hex → 64 chars, ~256 bits entropy.
  return randomBytes(32).toString('hex');
}

/**
 * Mint a fresh welcome / reset token for the given user. Returns the
 * URL-safe hex token string the caller embeds in the email link.
 *
 * Not idempotent: every call creates a new row. Callers who re-send
 * a welcome email (e.g. "resend invite") will mint a new token; older
 * unconsumed tokens for the same (user, kind) remain valid until
 * `expires_at`. If we ever need single-active-token semantics, do it
 * with an `UPDATE ... SET consumed_at = now() WHERE consumed_at IS NULL
 * AND user_id = $1 AND kind = $2` before the insert.
 */
export async function mintWelcomeToken(
  userId: string,
  kind: WelcomeTokenKind,
): Promise<string> {
  const token = newTokenString();
  const expiresAt = new Date(Date.now() + TTL_MS_BY_KIND[kind]);

  if (hasDb()) {
    const db = getDb();
    await db.insert(schema.welcomeTokens).values({
      token,
      userId,
      kind,
      expiresAt,
    });
    return token;
  }

  MEMORY.set(token, {
    token,
    userId,
    kind,
    expiresAt: expiresAt.getTime(),
    consumedAt: null,
  });
  return token;
}

export interface ConsumedWelcomeToken {
  userId: string;
  kind: WelcomeTokenKind;
}

/**
 * Atomically consume a token. Returns `{ userId, kind }` on success or
 * `null` when the token is unknown, already consumed, or expired.
 * Callers MUST treat null as the single sentinel for "do not proceed";
 * the caller MUST NOT branch on which sub-case fired (information
 * leak to the attacker).
 *
 * Postgres path: single `UPDATE ... WHERE consumed_at IS NULL AND
 * expires_at > now() RETURNING user_id, kind`. The CAS is the row
 * lock — two parallel callers cannot both win because the second
 * sees `consumed_at IS NOT NULL` and the UPDATE returns zero rows.
 */
export async function consumeWelcomeToken(
  token: string,
): Promise<ConsumedWelcomeToken | null> {
  if (typeof token !== 'string' || token.length === 0) return null;

  if (hasDb()) {
    const db = getDb();
    const rows = await db
      .update(schema.welcomeTokens)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(schema.welcomeTokens.token, token),
          isNull(schema.welcomeTokens.consumedAt),
          sql`${schema.welcomeTokens.expiresAt} > now()`,
        ),
      )
      .returning({
        userId: schema.welcomeTokens.userId,
        kind: schema.welcomeTokens.kind,
      });
    const row = rows[0];
    if (!row) return null;
    if (row.kind !== 'welcome' && row.kind !== 'reset') return null;
    return { userId: row.userId, kind: row.kind };
  }

  const row = MEMORY.get(token);
  if (!row) return null;
  if (row.consumedAt !== null) return null;
  if (row.expiresAt <= Date.now()) return null;
  row.consumedAt = Date.now();
  MEMORY.set(token, row);
  return { userId: row.userId, kind: row.kind };
}

/** Test-only — clear the in-memory mirror between specs. */
export function __resetWelcomeTokensForTests(): void {
  MEMORY.clear();
}
