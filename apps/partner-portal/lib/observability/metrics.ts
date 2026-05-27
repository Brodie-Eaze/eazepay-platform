/**
 * In-process metrics counters for the BFF.
 *
 * Why this exists
 * ---------------
 * The `/admin/observability` page is the demo step that says "this is
 * real infrastructure, not Zapier and a spreadsheet." Pre-task it
 * rendered a hard-coded `METRICS` constant — credible from a screenshot,
 * not from a regulator drill-down. This module is the central counter
 * store that route handlers + workers bump on every state change, and
 * the snapshot route reads on every dashboard tick.
 *
 * Design choices
 * --------------
 *   • In-process Map<string, number> — sufficient for a single replica
 *     and zero infra dependency. Multi-replica production will swap to
 *     a Redis HINCRBY (or a Prom collector) without changing call sites.
 *   • Counters are monotonic — `incrementMetric` only goes up. A reset
 *     happens only at process restart, which IS the signal we want
 *     ("metrics reset === deploy or crash").
 *   • Tenant-scoped variants are out of scope here; the metric vocabulary
 *     is platform-wide (e.g. `applications.created` is the count across
 *     every brand + partner). Per-tenant counters live in their own table
 *     when we wire them — that's a separate audit surface.
 *   • Counter names follow `domain.event` dotted notation. The catalogue
 *     below is the canonical list; adding a new name is one line + a
 *     call site.
 *
 * Coverage
 * --------
 * The catalogue tracks the moments operators look for during an incident:
 *   • applications.created     — consumer apply submitted
 *   • decisions.computed       — decision engine returned a ranked set
 *   • webhook.queued           — inbox row inserted (new event)
 *   • webhook.duplicate        — inbox dedupe fired (replay)
 *   • webhook.rejected         — signature / payload validation failure
 *   • provisioning.completed   — orchestrator end-to-end success
 *   • provisioning.failed      — orchestrator step failure (any step)
 *   • migration.completed      — AI Funding → MedPay migration success
 *   • migration.failed         — migration step failure (any step)
 */

/**
 * The canonical metric name vocabulary. Adding a new metric is a
 * two-step change: add it here and add the incrementMetric call at the
 * state transition. Strings are not type-inferred from this list at
 * call sites — keep the call sites readable; the catalogue is the
 * single source of truth for the surface.
 */
export type MetricName =
  | 'applications.created'
  | 'decisions.computed'
  /* Decision-mode breakdown (Task #44 fail-closed contract). The
   * aggregate `decisions.computed` continues to count work; these
   * three counters expose the mix so the dashboard can surface a
   * spike in failed_persisted_to_dlq before it turns into a backlog. */
  | 'decision.mode.normal'
  | 'decision.mode.fallback_internal'
  | 'decision.mode.failed_persisted_to_dlq'
  | 'webhook.queued'
  | 'webhook.duplicate'
  | 'webhook.rejected'
  | 'provisioning.completed'
  | 'provisioning.failed'
  | 'migration.completed'
  | 'migration.failed';

/**
 * All known metric names. Snapshot returns these in a stable order with
 * 0 defaults so the dashboard never has to handle a missing key on a
 * cold replica. The order matches the order metrics are surfaced in the
 * observability tiles; adjust both together if you reorder.
 */
const KNOWN_METRICS: ReadonlyArray<MetricName> = [
  'applications.created',
  'decisions.computed',
  'decision.mode.normal',
  'decision.mode.fallback_internal',
  'decision.mode.failed_persisted_to_dlq',
  'webhook.queued',
  'webhook.duplicate',
  'webhook.rejected',
  'provisioning.completed',
  'provisioning.failed',
  'migration.completed',
  'migration.failed',
];

const COUNTERS = new Map<MetricName, number>();

/**
 * Bump a counter by one. No-op-safe: if the name happens to land before
 * a future addition to the vocabulary it still records — TypeScript
 * catches the typo at the call site since `MetricName` is a closed union.
 *
 * Constant-cost (Map lookup + numeric increment). Safe to call inline
 * on the hot path.
 */
export function incrementMetric(name: MetricName, by = 1): void {
  const next = (COUNTERS.get(name) ?? 0) + by;
  COUNTERS.set(name, next);
}

/**
 * Read the full counter set. Returns a fresh object with every known
 * metric present (defaulting to 0) so the dashboard render doesn't have
 * to branch on absence. The catalogue order is preserved.
 */
export function getMetricsSnapshot(): Record<MetricName, number> {
  const out: Partial<Record<MetricName, number>> = {};
  for (const name of KNOWN_METRICS) {
    out[name] = COUNTERS.get(name) ?? 0;
  }
  return out as Record<MetricName, number>;
}

/** Test-only: drop all counters between specs. */
export function _resetMetricsForTest(): void {
  COUNTERS.clear();
}
