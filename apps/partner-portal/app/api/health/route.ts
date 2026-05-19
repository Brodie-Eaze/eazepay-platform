/**
 * GET /api/health — liveness + readiness probe.
 *
 * Railway's `healthcheckPath` currently points at `/sign-in` (the
 * landing surface). That works as a liveness probe — "the process is
 * up and serving HTML" — but it tells you nothing about whether the
 * database, env, or downstream deps are healthy. This endpoint covers
 * the gap.
 *
 * Response shape:
 *
 *   { status: 'ok' | 'degraded',
 *     ts: ISO timestamp,
 *     checks: {
 *       env: 'ok' | { errors, warnings },
 *       db:  'ok' | 'unavailable' | { error },
 *     },
 *     build: { sha?, env? } }
 *
 * Returns 200 in BOTH `ok` and `degraded` states — degraded means
 * something downstream isn't ready (typically: DB not yet provisioned)
 * but the process is healthy and the response is meaningful. A 5xx
 * here would let Railway think the process itself is broken and
 * rotate back.
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
  const status = db === 'ok' && env === 'ok' ? 'ok' : 'degraded';

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
      status: 200,
      headers: {
        // Prevent any caching layer from holding onto a stale snapshot.
        'cache-control': 'no-store',
      },
    },
  );
}
