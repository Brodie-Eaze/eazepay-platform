/**
 * GET /api/admin/observability/snapshot
 *
 * Drives the live `/admin/observability` tiles. Returns:
 *
 *   {
 *     metrics:     Record<MetricName, number>,
 *     queues:      { provisioning, migrations, webhooks } | null,
 *     lenderHealth: { healthy, degraded, down, unwired, total }
 *   }
 *
 * Polled every 5s by the page. Admin-gated via `requireAdmin` — the
 * full counter surface includes business signals (webhook rejections,
 * provisioning failures, migration counts) that should never be
 * available to a partner-scoped session.
 *
 * Queue depths come from BullMQ when REDIS_URL is wired (Builder G).
 * When `hasQueue()` is false we return `queues: null` so the dashboard
 * can render a "queue substrate offline" pill instead of fake zeros.
 *
 * Lender health is read from the existing `lib/lender-economics.ts`
 * dossier surface — no new data source.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server-guards';
import { getMetricsSnapshot } from '@/lib/observability/metrics';
import { hasQueue } from '@/lib/queue';
import { listAllDossiers } from '@/lib/lender-economics';
import { safeLog } from '@/lib/safe-log';
import { safeErrorResponse } from '@/lib/safe-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QueueStats {
  /** Jobs waiting to be picked up. */
  waiting: number;
  /** Jobs currently being executed by a worker. */
  active: number;
  /** Jobs that exhausted their retry budget. */
  failed: number;
  /** Jobs scheduled for a future run (BullMQ delayed). */
  delayed: number;
}

/**
 * Fetch BullMQ queue depth for a given queue accessor. Wrapped in
 * try/catch because a transient Redis blip should not 5xx the
 * observability page — we degrade to `null` so the UI shows "?" and
 * the operator can spot the outage from the queue tile itself.
 */
async function safeQueueStats(
  // The BullMQ Queue type is generic on payload shape; we only call
  // getJobCounts which takes JobType strings ('waiting' | 'active' | …).
  // Use `unknown` and a runtime cast so this helper accepts any
  // queue accessor without forcing every caller to import bullmq types.
  getQueue: () => unknown,
): Promise<QueueStats | null> {
  try {
    const queue = getQueue() as {
      getJobCounts: (
        ...kinds: ('waiting' | 'active' | 'failed' | 'delayed')[]
      ) => Promise<Record<string, number>>;
    };
    const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
    return {
      waiting: Number(counts.waiting ?? 0),
      active: Number(counts.active ?? 0),
      failed: Number(counts.failed ?? 0),
      delayed: Number(counts.delayed ?? 0),
    };
  } catch (err) {
    safeLog.warn({
      event: 'observability.queue_stats_failed',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Aggregate per-lender health into a tile-friendly summary. Source of
 * truth is the dossier fixture (`lib/lender-economics.ts`); when that
 * fixture is replaced by the `lenders` table the function body changes
 * — the return shape stays identical for the page.
 */
function summariseLenderHealth(): {
  healthy: number;
  degraded: number;
  down: number;
  unwired: number;
  total: number;
} {
  const dossiers = listAllDossiers();
  let healthy = 0;
  let degraded = 0;
  let down = 0;
  let unwired = 0;
  for (const d of dossiers) {
    switch (d.integration.apiHealth) {
      case 'healthy':
        healthy += 1;
        break;
      case 'degraded':
        degraded += 1;
        break;
      case 'down':
        down += 1;
        break;
      case 'unwired':
        unwired += 1;
        break;
    }
  }
  return { healthy, degraded, down, unwired, total: dossiers.length };
}

export async function GET(req: NextRequest) {
  // SEC-001: admin-only. Counter surface includes operational signals
  // (webhook.rejected, provisioning.failed) that hint at incident state.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  try {
    const metrics = getMetricsSnapshot();
    const lenderHealth = summariseLenderHealth();

    // Queue stats come from BullMQ when REDIS_URL is configured.
    // Lazy-import the queue modules so a Redis-less dev environment
    // never pays the IORedis-import cost on this hot path.
    let queues: {
      provisioning: QueueStats | null;
      migrations: QueueStats | null;
      webhooks: QueueStats | null;
    } | null = null;

    if (hasQueue()) {
      const [{ getProvisioningQueue }, { getMigrationsQueue }, { getWebhooksQueue }] =
        await Promise.all([
          import('@/lib/queue/provisioning'),
          import('@/lib/queue/migrations'),
          import('@/lib/queue/webhooks'),
        ]);
      const [provisioning, migrations, webhooks] = await Promise.all([
        safeQueueStats(getProvisioningQueue),
        safeQueueStats(getMigrationsQueue),
        safeQueueStats(getWebhooksQueue),
      ]);
      queues = { provisioning, migrations, webhooks };
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      metrics,
      queues,
      lenderHealth,
      viewer: { actor: guard.actor, role: guard.role },
    });
  } catch (err) {
    // SEC-007: counter / queue errors get logged + return a generic
    // detail. The page handles a 5xx by displaying its last-known good
    // snapshot, not the raw error.
    return safeErrorResponse(err, 'internal_error', 500, '/api/admin/observability/snapshot');
  }
}
