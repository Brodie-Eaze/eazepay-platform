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
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';
import type { SessionContext } from '../session';

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

/* ============================================================
 * Tenant-scoped transaction helper (migration 0013_rls_policies)
 * ============================================================
 *
 * Postgres RLS policies on tenant-scoped tables filter every row by
 * the GUCs `app.current_partner_id` + `app.role`. Those GUCs must be
 * set at the start of every transaction the BFF runs — otherwise the
 * policies match nothing and the query returns zero rows (fail-CLOSED
 * by design).
 *
 * Usage:
 *   const rows = await withTenantContext(session, async (tx) => {
 *     return tx.select().from(applications).where(...);
 *   });
 *
 * SET LOCAL (via set_config(..., true)) scopes the GUCs to the
 * transaction so a pool connection returned to the pool does NOT
 * carry the context into the next caller — defence-in-depth against
 * a stale-context bug leaking rows across requests.
 *
 * Role mapping:
 *   - operator demo presets   → role='operator'   (sees all rows)
 *   - brand demo presets      → role='operator'   (app layer narrows by brand)
 *   - account sessions        → role='partner', partner_id=session.partnerId
 *   - real / none             → role='none'       (fail-CLOSED)
 *
 * Synthetic-session helpers below cover the routes that legitimately
 * act outside a user session (e.g. the public POST /apply route,
 * which must insert an application row with a server-resolved
 * partnerId).
 *
 * TODO(SEC-RLS-2): wrap the remaining DB-touching routes
 *   (lender adapters, webhook handlers, marketplace + MID routes,
 *   audit-log writers, orchestrator persistence) in withTenantContext
 *   or withRawTenantContext as they're touched. This PR ships the
 *   policy enforcement + the helper + the four hot routes; the rest
 *   continue to work because RLS treats an unset GUC as fail-CLOSED,
 *   so the first un-wrapped route to read tenant data after this
 *   lands will return empty and trip its own alarms — the desired
 *   forcing function.
 */

export interface TenantContext {
  partnerId: string | null;
  role: 'partner' | 'operator' | 'none';
}

/**
 * Pure derivation of (partner_id, role) from a session. No I/O.
 */
export function tenantContextFromSession(session: SessionContext): TenantContext {
  if (session.mode === 'demo' && session.isOperator) {
    return { partnerId: null, role: 'operator' };
  }
  if (session.mode === 'demo') {
    // Brand-scoped demo preset. Treat as operator at the DB layer; the
    // app-layer `allowedPartnerIdsForBrand` narrows to the brand's
    // partner roster. (Pinning a per-partner GUC would require demo
    // presets to commit to a single partnerId, which they don't.)
    return { partnerId: null, role: 'operator' };
  }
  if (session.mode === 'account') {
    return { partnerId: session.partnerId, role: 'partner' };
  }
  // real (placeholder) + none → fail-CLOSED. role='none' matches no
  // policy branch without a partner_id, so every read returns zero rows.
  return { partnerId: null, role: 'none' };
}

/**
 * Synthetic operator context for trusted server-side actors that aren't
 * tied to a user session — e.g. the public consumer apply POST route
 * (the BFF itself is the actor, resolving partner attribution server-
 * side) and webhook ingestors. Use sparingly; the audit trail must
 * make the synthetic actor explicit.
 */
export const SYNTHETIC_OPERATOR_CONTEXT: TenantContext = {
  partnerId: null,
  role: 'operator',
};

export type TxHandle = Parameters<Parameters<Db['transaction']>[0]>[0];

async function applyTenantGucs(tx: TxHandle, ctx: TenantContext): Promise<void> {
  // set_config(name, value, is_local=true) is the parameterised
  // equivalent of SET LOCAL — partner_id is never string-concatenated.
  await tx.execute(
    sql`SELECT set_config('app.current_partner_id', ${ctx.partnerId ?? ''}, true)`,
  );
  await tx.execute(sql`SELECT set_config('app.role', ${ctx.role}, true)`);
}

/**
 * Run `fn` inside a Drizzle transaction whose first action is to bind
 * the RLS GUCs derived from `session`. Returns fn's return value.
 */
export async function withTenantContext<T>(
  session: SessionContext,
  fn: (tx: TxHandle) => Promise<T>,
): Promise<T> {
  const ctx = tenantContextFromSession(session);
  const db = getDb();
  return db.transaction(async (tx) => {
    await applyTenantGucs(tx, ctx);
    return fn(tx);
  });
}

/**
 * Like `withTenantContext` but accepts a raw `TenantContext` —
 * used by routes that intentionally run as a synthetic actor
 * (consumer apply POST, webhook ingestors).
 */
export async function withRawTenantContext<T>(
  ctx: TenantContext,
  fn: (tx: TxHandle) => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await applyTenantGucs(tx, ctx);
    return fn(tx);
  });
}
