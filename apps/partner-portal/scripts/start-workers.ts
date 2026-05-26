#!/usr/bin/env tsx
/**
 * Worker entry point — boots all three BullMQ workers and runs
 * indefinitely (Task #50).
 *
 * Runs as a separate Railway service from the Next.js web server. The
 * web service handles HTTP traffic (and enqueues jobs); this service
 * does the actual work — provisioning runs, customer migrations,
 * webhook inbox dispatch.
 *
 * Lifecycle
 * ---------
 *   1. SIGTERM / SIGINT trigger graceful shutdown — every worker
 *      finishes its current job (BullMQ's `await worker.close()`
 *      blocks until in-flight jobs settle), then the Redis connection
 *      closes.
 *   2. An unhandled rejection or uncaught exception logs + exits 1.
 *      Railway restarts the container per `restartPolicyType` in
 *      railway.toml.
 *
 * Boot
 * ----
 *   pnpm --filter @eazepay/partner-portal workers
 *
 * Env requirements
 * ----------------
 *   REDIS_URL       (required)   — Railway-injected when Redis service is linked
 *   DATABASE_URL    (required)   — same Postgres as the web service
 *
 * If REDIS_URL is unset this script logs an error and exits 1.
 * Workers cannot run without a queue; in the dev fallback path
 * (no Redis), the work happens in the Next.js process via the
 * setImmediate path in startProvision / startMigration.
 */

import { startProvisioningWorker } from '../lib/queue/provisioning';
import { startMigrationsWorker } from '../lib/queue/migrations';
import { startWebhooksWorker } from '../lib/queue/webhooks';
import { hasQueue, closeConnection } from '../lib/queue';
import { hasDb } from '../lib/db';
import { safeLog } from '../lib/safe-log';

async function main(): Promise<void> {
  if (!hasQueue()) {
    safeLog.error({
      event: 'workers.boot_failed',
      reason: 'REDIS_URL is not set — workers require Redis. Set REDIS_URL and try again.',
    });
    process.exit(1);
  }
  if (!hasDb()) {
    safeLog.error({
      event: 'workers.boot_failed',
      reason: 'DATABASE_URL is not set — workers require Postgres. Set DATABASE_URL and try again.',
    });
    process.exit(1);
  }

  safeLog.info({ event: 'workers.boot' });

  const provisioning = startProvisioningWorker();
  const migrations = startMigrationsWorker();
  const webhooks = startWebhooksWorker();

  safeLog.info({
    event: 'workers.ready',
    queues: ['provisioning-runs', 'customer-migrations', 'webhook-inbox'],
  });

  // Wire graceful shutdown. We listen for both SIGTERM (Railway send
  // on redeploy) and SIGINT (operator Ctrl-C in dev).
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    safeLog.info({ event: 'workers.shutdown_initiated', signal });
    try {
      // BullMQ Worker#close awaits in-flight jobs. Run in parallel —
      // each Worker owns its own connection from the shared pool but
      // they don't interlock during shutdown.
      await Promise.allSettled([provisioning.close(), migrations.close(), webhooks.close()]);
      await closeConnection();
      safeLog.info({ event: 'workers.shutdown_complete' });
      process.exit(0);
    } catch (err) {
      safeLog.error({
        event: 'workers.shutdown_failed',
        err: err instanceof Error ? err.message : 'unknown',
      });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    safeLog.error({
      event: 'workers.unhandled_rejection',
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
  process.on('uncaughtException', (err) => {
    safeLog.error({
      event: 'workers.uncaught_exception',
      err: err.message,
    });
    // An uncaught exception means we don't know what state we're in —
    // exit and let Railway restart. Workers' in-flight jobs return to
    // BullMQ's stalled set and a fresh container picks them up.
    process.exit(1);
  });
}

main().catch((err) => {
  safeLog.error({
    event: 'workers.boot_failed',
    err: err instanceof Error ? err.message : 'unknown',
  });
  process.exit(1);
});
