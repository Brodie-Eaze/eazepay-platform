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
  __ezpPgMigrationPool?: Pool;
};

const globalForPool = globalThis as GlobalWithPool;

function resolveConnectionString(): string | null {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? null;
}

/**
 * Connection string for structural DDL / migrations. In production
 * this should hold credentials for `eazepay_migration_role` (BYPASSRLS,
 * privileged DDL grants). Falls back to DATABASE_URL in local dev where
 * there is typically only one role. ONLY `scripts/migrate.ts` should
 * use this — see `getMigrationDb()`.
 */
function resolveMigrationConnectionString(): string | null {
  return (
    process.env.MIGRATION_DATABASE_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    null
  );
}

/**
 * Optional Postgres role to SET on every checked-out app-pool
 * connection. In deployed envs set this to `eazepay_service_role` so
 * the BFF runs constrained by RLS + the append-only REVOKEs from
 * `0019_append_only_grants.sql`, even if the connection string itself
 * was provisioned with a higher-privileged role. Defense in depth: a
 * mis-configured DATABASE_URL can't accidentally hand the app a role
 * that can mutate audit_log.
 */
function resolveAppRole(): string | null {
  return process.env.DATABASE_APP_ROLE ?? null;
}

/**
 * True iff a DATABASE_URL is configured. Used by routes that want to
 * fall back to the legacy localStorage path during the cutover.
 */
export function hasDb(): boolean {
  return Boolean(resolveConnectionString());
}

function buildPool(connectionString: string, appRole: string | null): Pool {
  const pool = new Pool({
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

  if (appRole) {
    /* Switch every freshly-checked-out connection to the constrained
     * app role. SET ROLE persists for the session, which is the scope
     * we want: the connection stays constrained for every checkout
     * until it's evicted. Validate the identifier defensively so an
     * env-var injection can't smuggle SQL. */
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(appRole)) {
      throw new Error(
        `DATABASE_APP_ROLE must be a bare Postgres identifier; got: ${JSON.stringify(appRole)}`,
      );
    }
    pool.on('connect', (client) => {
      client.query(`SET ROLE "${appRole}"`).catch((err) => {
        // Surface loudly — silently falling back to a privileged role
        // would defeat the purpose of the REVOKEs in 0019.
        console.error('[db] failed to SET ROLE', appRole, err);
      });
    });
  }

  return pool;
}

function getPool(): Pool {
  if (!globalForPool.__ezpPgPool) {
    const connectionString = resolveConnectionString();
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Add a Postgres service in Railway (it injects DATABASE_URL automatically) or export POSTGRES_URL locally.',
      );
    }
    globalForPool.__ezpPgPool = buildPool(connectionString, resolveAppRole());
  }
  return globalForPool.__ezpPgPool;
}

export type Db = NodePgDatabase<typeof schema>;

let cachedDb: Db | null = null;
let cachedMigrationDb: Db | null = null;

/**
 * Get the Drizzle client. Throws if DATABASE_URL is not configured —
 * callers that need graceful degradation should call `hasDb()` first.
 *
 * Returns a client bound to the constrained app role (when
 * `DATABASE_APP_ROLE` is set). This client CANNOT update/delete
 * audit_log / application_events / decisions — see 0019_append_only_grants.
 */
export function getDb(): Db {
  if (!cachedDb) {
    cachedDb = drizzle(getPool(), { schema, logger: false });
  }
  return cachedDb;
}

/**
 * Get a Drizzle client privileged for structural DDL and migrations.
 * Bound to `MIGRATION_DATABASE_URL` (or DATABASE_URL in local dev) and
 * does NOT SET ROLE down to the constrained app role.
 *
 * ONLY `scripts/migrate.ts` should call this. Importing it from a
 * route handler is a code smell — file a PR review comment.
 */
export function getMigrationDb(): Db {
  if (!cachedMigrationDb) {
    const connectionString = resolveMigrationConnectionString();
    if (!connectionString) {
      throw new Error(
        'MIGRATION_DATABASE_URL (or DATABASE_URL) is not set. Cannot run migrations.',
      );
    }
    if (!globalForPool.__ezpPgMigrationPool) {
      // Migration pool: privileged, NO SET ROLE.
      globalForPool.__ezpPgMigrationPool = buildPool(connectionString, null);
    }
    cachedMigrationDb = drizzle(globalForPool.__ezpPgMigrationPool, { schema, logger: false });
  }
  return cachedMigrationDb;
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
 * SEC-RLS-2 (this PR): every remaining DB-touching route handler is
 *   now wrapped — operator routes via `withTenantContext(session, ...)`,
 *   HMAC-verified inbound webhooks via `withRawTenantContext(
 *   SYSTEM_WEBHOOK_CONTEXT, ...)`, and unauthenticated public routes
 *   that only touch non-RLS tables via `withRawTenantContext(
 *   PUBLIC_CONSUMER_CONTEXT, ...)`. A grep-based fitness function in
 *   CI fails any new `getDb()` call inside `app/api/` that isn't
 *   reached via one of those wrappers.
 */

export interface TenantContext {
  partnerId: string | null;
  /**
   * Logical role bound to `app.role` GUC at txn start.
   *
   *   - 'operator' — sees all rows (admin endpoints, signature-verified
   *     inbound webhooks that must persist into tenant tables).
   *   - 'partner'  — sees only rows where partner_id = `partnerId`.
   *   - 'consumer' — public unauthenticated actor. Matches NO policy
   *     branch, so every read returns zero rows and every write is
   *     blocked by RLS. Used by public routes that only touch non-RLS
   *     tables (webhook_inbox ingestion, consent receipt acks) — the
   *     GUC is still bound so a future migration that adds RLS to
   *     those tables fails-CLOSED rather than silently leaking.
   *   - 'none'     — fail-closed sentinel for unresolved sessions.
   */
  role: 'partner' | 'operator' | 'consumer' | 'none';
}

/**
 * Synthetic identifier used in `partner_id` for actors that aren't a
 * single partner — public consumer routes, webhook ingestors that
 * persist a delivery before the target partner is resolved. The string
 * starts with a double underscore so it can NEVER collide with a real
 * partner_id (slug-prefixed `p_…`).
 */
export const UNATTRIBUTED_PARTNER_ID = '__unattributed__';

/**
 * Synthetic operator context for trusted server-side actors that aren't
 * tied to a user session — HMAC-verified inbound webhooks from lenders,
 * MiCamp, HighSale. The signature check IS the auth; the GUC binding
 * lets the resulting writes into RLS-protected tenant tables succeed
 * without smuggling a real user partnerId. Use sparingly; an audit row
 * with actor='system:<provider>' must accompany every state change.
 */
export const SYSTEM_WEBHOOK_CONTEXT: TenantContext = {
  partnerId: UNATTRIBUTED_PARTNER_ID,
  role: 'operator',
};

/**
 * Synthetic consumer context for public unauthenticated routes that
 * only touch non-RLS tables (webhook_inbox ingest, consent receipt
 * acks). Fails-CLOSED on any RLS-protected table by design.
 */
export const PUBLIC_CONSUMER_CONTEXT: TenantContext = {
  partnerId: UNATTRIBUTED_PARTNER_ID,
  role: 'consumer',
};

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
 * @deprecated Use `SYSTEM_WEBHOOK_CONTEXT` (for HMAC-verified inbound
 * webhooks) or build a one-off `{partnerId, role:'operator'}` literal.
 * Kept as an alias for any caller that pinned the older name pre-
 * SEC-RLS-2.
 */
export const SYNTHETIC_OPERATOR_CONTEXT: TenantContext = SYSTEM_WEBHOOK_CONTEXT;

export type TxHandle = Parameters<Parameters<Db['transaction']>[0]>[0];

async function applyTenantGucs(tx: TxHandle, ctx: TenantContext): Promise<void> {
  // set_config(name, value, is_local=true) is the parameterised
  // equivalent of SET LOCAL — partner_id is never string-concatenated.
  await tx.execute(sql`SELECT set_config('app.current_partner_id', ${ctx.partnerId ?? ''}, true)`);
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
