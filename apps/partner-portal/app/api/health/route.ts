/**
 * GET /api/health — liveness + readiness probe.
 *
 * Railway's `healthcheckPath` now points here (was `/sign-in`). This
 * endpoint reports both process liveness AND downstream readiness:
 * env vars present + DB reachable.
 *
 * Response shape:
 *
 *   { status: 'ok' | 'degraded',
 *     ts: ISO timestamp,
 *     checks: {
 *       env: 'ok' | { missing },
 *       db:  'ok' | 'unavailable' | { error },
 *     },
 *     build: { sha?, env? } }
 *
 * P0 fix — Returns 503 when env or DB checks fail. Pre-fix this
 * route returned 200 even when the DB was unavailable, which made it
 * useless as a Railway healthcheck: a degraded replica with no DB
 * connectivity (and therefore no FCRA persistence, no audit log
 * writes) would silently keep serving traffic. Returning 503 lets
 * Railway rotate the bad replica out of the pool until the
 * dependency is back.
 *
 * Tracks `docs/runbooks/error-handling.md` § Phase 1.
 */

import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb, hasDb } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DbCheck = 'ok' | 'unavailable' | { error: string };

/**
 * Lightweight env probe co-located with the health route. A richer
 * boot-time validator (`lib/env.ts`) lives behind the env-hardening PR
 * and will be wired in later; for now we just confirm the cookie
 * signing secret is present + long enough so a green health response
 * implies the auth path can mint sessions.
 */
function checkEnv(): 'ok' | { missing: string[] } {
  const missing: string[] = [];
  const secret = process.env.DEMO_COOKIE_SECRET;
  if (!secret || secret.length < 32) missing.push('DEMO_COOKIE_SECRET');
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (!origin) missing.push('NEXT_PUBLIC_APP_ORIGIN');
  return missing.length === 0 ? 'ok' : { missing };
}

async function checkDb(): Promise<DbCheck> {
  if (!hasDb()) return 'unavailable';
  try {
    const db = getDb();
    // Simplest possible round-trip. If this succeeds the pool is up,
    // the network path is reachable, and Postgres is accepting queries.
    await db.execute(sql`SELECT 1`);
    return 'ok';
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'unknown' };
  }
}

export async function GET(): Promise<NextResponse> {
  const env = checkEnv();
  const db = await checkDb();
  const healthy = db === 'ok' && env === 'ok';
  const status = healthy ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      ts: new Date().toISOString(),
      checks: { env, db },
      build: {
        sha: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        env: process.env.NODE_ENV ?? 'development',
      },
    },
    {
      // P0 fix — 503 when degraded so Railway's healthcheck actually
      // rotates the bad replica. 200-on-degraded was the pre-fix
      // behaviour and made the probe useless.
      status: healthy ? 200 : 503,
      headers: {
        // Prevent any caching layer from holding onto a stale snapshot.
        'cache-control': 'no-store',
      },
    },
  );
}
