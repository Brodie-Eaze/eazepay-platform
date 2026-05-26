/**
 * BullMQ queue substrate — single Redis connection per process.
 *
 * Why a singleton on globalThis: same reason the Postgres pool in
 * `lib/db/index.ts` is — Next.js App Router runs server code in a
 * long-running Node worker and HMR re-evaluates this module on every
 * change in dev. Stashing on globalThis lets the connection survive
 * the reload instead of leaking a fresh socket per HMR cycle.
 *
 * Why graceful degradation: local dev + the existing CI suite both
 * run without Redis. `hasQueue()` mirrors the `hasDb()` contract — a
 * `false` return is the caller's signal to fall back to the legacy
 * `setImmediate` / poll path. After the Redis service lands in
 * Railway, the env var flips on, the workers boot, and the same code
 * path enqueues to Redis.
 *
 * Connection string priority:
 *   1. REDIS_URL  (Railway-injected when you add a Redis service)
 *   2. (none)     → hasQueue() returns false, getConnection() throws
 *
 * The Worker entry point in scripts/start-workers.ts and every
 * enqueue site must call `hasQueue()` first; never call
 * `getConnection()` unconditionally — it will throw in environments
 * where Redis is not configured.
 */

import IORedis, { type Redis, type RedisOptions } from 'ioredis';

type GlobalWithRedis = typeof globalThis & {
  __ezpRedis?: Redis;
};

const globalForRedis = globalThis as GlobalWithRedis;

function resolveRedisUrl(): string | null {
  return process.env.REDIS_URL ?? null;
}

/**
 * True iff a REDIS_URL is configured. Used by enqueue sites to decide
 * between the BullMQ path and the in-process fallback.
 */
export function hasQueue(): boolean {
  return Boolean(resolveRedisUrl());
}

/**
 * BullMQ requires `maxRetriesPerRequest: null` on the connection it
 * uses for blocking commands (Worker, QueueEvents). Without it, BullMQ
 * throws `maxRetriesPerRequest` on every reconnect — see
 * https://docs.bullmq.io/guide/going-to-production#maxretriesperrequest.
 *
 * `enableReadyCheck: false` skips a CLUSTER ping which Railway-managed
 * Redis doesn't always answer in time on cold start.
 */
function buildConnectionOptions(url: string): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Keep the lazyConnect default — IORedis opens on first command.
    // tls is signalled by the rediss:// scheme; ioredis auto-handles it.
    // No need for explicit TLS options on Railway.
    // Lower keepalive than the default 0 so idle connections aren't
    // killed by Railway's proxy. 10s mirrors what the webhook service
    // (services/webhook) uses successfully today.
    keepAlive: 10_000,
  } satisfies RedisOptions;
}

/**
 * Get the shared IORedis connection. Throws if REDIS_URL is not
 * configured — callers must gate on `hasQueue()` first.
 *
 * Returning the raw IORedis instance (vs. a wrapped Queue) is
 * deliberate: BullMQ's `Queue` + `Worker` constructors both accept
 * an IORedis instance directly and reuse its connection pool,
 * avoiding fan-out of TCP sockets per queue.
 */
export function getConnection(): Redis {
  if (!globalForRedis.__ezpRedis) {
    const url = resolveRedisUrl();
    if (!url) {
      throw new Error(
        'REDIS_URL is not set. Add a Redis service in Railway (it injects REDIS_URL automatically) or export REDIS_URL locally. Use hasQueue() to gate before calling getConnection().',
      );
    }
    globalForRedis.__ezpRedis = new IORedis(url, buildConnectionOptions(url));
  }
  return globalForRedis.__ezpRedis;
}

/**
 * Close the shared connection. Only called by the worker entry point
 * during shutdown — route handlers must never close it, the Next.js
 * runtime reuses the same process across requests.
 */
export async function closeConnection(): Promise<void> {
  const conn = globalForRedis.__ezpRedis;
  if (!conn) return;
  globalForRedis.__ezpRedis = undefined;
  await conn.quit();
}
