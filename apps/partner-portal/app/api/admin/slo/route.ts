/**
 * GET /api/admin/slo
 *
 * Returns the SLO catalogue with current error-budget state computed
 * from observed metrics. Drives the `/admin/observability/slo` page.
 *
 * Honesty contract
 * ----------------
 * The current observability surface (`lib/observability/metrics.ts`) is
 * a single-replica in-process counter set. It exposes monotonic counters
 * since process boot — NOT a rolling-window rate, NOT latency
 * percentiles, NOT a real availability fraction.
 *
 * Several SLOs in the catalogue measure things this substrate cannot
 * fully observe today (latency p95, rolling 7d / 30d windows). For
 * those, this route returns `observed: null` with a documented reason —
 * the UI then renders "no data yet (awaiting OTel pipeline)" rather
 * than a misleading green tick.
 *
 * Observable today:
 *   • Availability SLOs that map to (success_counter / total_counter)
 *     from the metrics catalogue. We approximate the rolling window
 *     by using since-boot counters; this is documented in the response
 *     as `observation.window: 'since-boot'` so the UI is clear.
 *
 * Not observable today (returns null + reason):
 *   • Latency percentile SLOs — would need OTel histograms.
 *   • Lender-API delivery success rate — would need the
 *     `webhook_deliveries` table aggregated over the window.
 *
 * SEC: Admin-gated via `requireAdmin`. The SLO surface includes
 * operational health signals (which SLOs are burning, which runbooks
 * to follow) that should never be available to a partner-scoped session.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server-guards';
import { getMetricsSnapshot, type MetricName } from '@/lib/observability/metrics';
import { SLO_DEFINITIONS, type SloDefinition } from '@/lib/slo/definitions';
import { computeErrorBudget, type ErrorBudgetState } from '@/lib/slo/error-budget';
import { safeErrorResponse } from '@/lib/safe-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SloBoardRow {
  slo: SloDefinition;
  observation: {
    /** Failure rate observed in the window, or null when not observable today. */
    failureRate: number | null;
    /** Window the observation covers. `since-boot` when we don't yet have a rolling sink. */
    window: 'since-boot' | '7d' | '30d';
    /** Sample size (denominator) the failure rate is over. 0 when no traffic yet. */
    sampleSize: number;
    /** Why a null failureRate — surfaced in the UI tooltip. Never user-fingerprinting info. */
    notObservableReason?: string;
  };
  /** null when the failureRate is null — the dashboard renders "no data yet". */
  budget: ErrorBudgetState | null;
}

/**
 * Map an SLO to the (numerator, denominator) counter pair from the in-
 * process metrics store. Returns null when the SLO is not observable
 * via the current counter surface — that's not a bug, it's a documented
 * gap that the UI surfaces as "awaiting OTel pipeline".
 *
 * Numerator is the FAILURE count (because the SLI is failure-rate);
 * denominator is the TOTAL count of observations. Both must come from
 * the same catalogue or the ratio is meaningless.
 */
function failureRateForSlo(
  slo: SloDefinition,
  metrics: Record<MetricName, number>,
): { failureRate: number; sampleSize: number } | { reason: string } {
  switch (slo.id) {
    case 'consumer-apply-availability': {
      // Today the counter surface only emits `applications.created` on
      // success. We do not yet emit `applications.failed` — that's a
      // follow-up. Until that lands, report "no observability surface
      // wired" rather than imply a 100% availability.
      return {
        reason: 'No failure counter wired yet (applications.failed pending).',
      };
    }
    case 'decision-engine-availability': {
      // Same shape — `decisions.computed` is the success counter; no
      // matching failure counter exists today.
      return {
        reason: 'No failure counter wired yet (decisions.failed pending).',
      };
    }
    case 'webhook-ingestion-availability': {
      // This one we CAN observe with the counters we have today.
      // success: webhook.queued + webhook.duplicate (a duplicate hit
      //   that returns a 200 idempotent receipt IS a success)
      // failure: webhook.rejected
      const queued = metrics['webhook.queued'] ?? 0;
      const duplicate = metrics['webhook.duplicate'] ?? 0;
      const rejected = metrics['webhook.rejected'] ?? 0;
      const total = queued + duplicate + rejected;
      if (total === 0) {
        return { reason: 'No webhook events observed yet.' };
      }
      return {
        failureRate: rejected / total,
        sampleSize: total,
      };
    }
    case 'consumer-apply-latency-p95':
    case 'decision-engine-latency-p95':
      return {
        reason: 'Latency SLOs require OTel histograms; not yet wired.',
      };
    case 'lender-api-integration-health':
      return {
        reason:
          'Aggregate delivery rate sourced from webhook_deliveries table; query not yet wired.',
      };
    default:
      // Defensive: catalogue grew without a matching observability map.
      // Returns null + reason rather than throwing — the page must
      // always render even for an unmapped SLO.
      return { reason: 'No observation source mapped for this SLO.' };
  }
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  try {
    const metrics = getMetricsSnapshot();

    const rows: SloBoardRow[] = SLO_DEFINITIONS.map((slo) => {
      const observation = failureRateForSlo(slo, metrics);
      if ('reason' in observation) {
        return {
          slo,
          observation: {
            failureRate: null,
            window: 'since-boot',
            sampleSize: 0,
            notObservableReason: observation.reason,
          },
          budget: null,
        };
      }
      const budget = computeErrorBudget(slo, observation.failureRate);
      return {
        slo,
        observation: {
          failureRate: observation.failureRate,
          window: 'since-boot',
          sampleSize: observation.sampleSize,
        },
        budget,
      };
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      // Surface the observability gap honestly. The board renders this
      // banner so an operator (or an auditor) never reads a green tile
      // as "we have real telemetry"; it's "we have a wired SLI" until
      // OTel lands.
      observabilityNote:
        'Counters are since-boot (single-replica). Rolling-window + percentile SLIs require the OTel pipeline; affected SLOs report observed: null with a reason.',
      rows,
      viewer: { actor: guard.actor, role: guard.role },
    });
  } catch (err) {
    return safeErrorResponse(err, 'internal_error', 500, '/api/admin/slo');
  }
}
