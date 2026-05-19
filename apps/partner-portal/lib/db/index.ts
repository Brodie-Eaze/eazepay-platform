/**
 * Postgres client — singleton pool + Drizzle wrapper.
 *
 * Why a module-level pool instead of per-request connections:
 * Next.js App Router executes server code in a long-running Node
 * worker. A fresh `pg.Pool` per route handler would exhaust Railway
 * Postgres's connection limit (default 100) within seconds. A
 * module-scoped pool is created once per worker and reused.
 *
 * In `next dev` with HMR the module is re-evaluated on every change.
 * We stash the pool on `globalThis` to survive the reload — the
 * canonical Next.js pattern.
 *
 * Connection string priority:
 *   1. DATABASE_URL  (Railway-injected when you add a Postgres service)
 *   2. POSTGRES_URL  (legacy alias some platforms use)
 *
 * If neither is set, `getDb()` throws on first use. Callers should
 * either gate on `hasDb()` or catch the error and degrade to the
 * legacy localStorage path during the cutover window. After cutover
 * `hasDb()` becomes a hard requirement.
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

type GlobalWithPool = typeof globalThis & {
  __ezpPgPool?: Pool;
};

const globalForPool = globalThis as GlobalWithPool;

function resolveConnectionString(): string | null {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? null;
}

/**
 * True iff a DATABASE_URL is configured. Used by routes that want to
 * fall back to the legacy localStorage path during the cutover.
 */
export function hasDb(): boolean {
  return Boolean(resolveConnectionString());
}

function buildPool(): Pool {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Add a Postgres service in Railway (it injects DATABASE_URL automatically) or export POSTGRES_URL locally.',
    );
  }
  return new Pool({
    connectionString,
    /* Tighter pool ceiling than the Postgres default — leaves room
     * for the migrate / seed scripts to grab connections too. Tune
     * upward if `pg_stat_activity` shows pool exhaustion. */
    max: 10,
    /* Idle timeout matches the typical Railway proxy keepalive so
     * connections aren't held open across long quiet periods. */
    idleTimeoutMillis: 30_000,
    /* Postgres SSL is required on Railway's hosted service. The
     * standard library auto-detects via the URL but we set this
     * explicitly so local docker-compose with `sslmode=disable` is
     * honoured without code changes. */
    ssl: connectionString.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
  });
}

function getPool(): Pool {
  if (!globalForPool.__ezpPgPool) {
    globalForPool.__ezpPgPool = buildPool();
  }
  return globalForPool.__ezpPgPool;
}

export type Db = NodePgDatabase<typeof schema>;

let cachedDb: Db | null = null;

/**
 * Get the Drizzle client. Throws if DATABASE_URL is not configured —
 * callers that need graceful degradation should call `hasDb()` first.
 */
export function getDb(): Db {
  if (!cachedDb) {
    cachedDb = drizzle(getPool(), { schema, logger: false });
  }
  return cachedDb;
}

export { schema };
