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
 *   • Bounded tags (provider + eventType only) are supported on metrics
 *     that need a DLQ-style breakdown — see `webhook.handler.not_implemented`.
 *     Both dimensions are bounded by the integration catalogue (4 providers
 *     × ~10 events) so the combination count stays well under the
 *     1000-per-metric cardinality budget.
 *
 * Coverage
 * --------
 * The catalogue tracks the moments operators look for during an incident:
 *   • applications.created     — consumer apply submitted
 *   • decisions.computed       — decision engine returned a ranked set
 *   • webhook.queued           — inbox row inserted (new event)
 *   • webhook.duplicate        — inbox dedupe fired (replay)
 *   • webhook.rejected         — signature / payload validation failure
 *   • webhook.handler.not_implemented
 *                              — stub handler refused to ack (DLQ surface)
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
  | 'webhook.queued'
  | 'webhook.duplicate'
  | 'webhook.rejected'
  | 'webhook.handler.not_implemented'
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
  'webhook.queued',
  'webhook.duplicate',
  'webhook.rejected',
  'webhook.handler.not_implemented',
  'provisioning.completed',
  'provisioning.failed',
  'migration.completed',
  'migration.failed',
];

const COUNTERS = new Map<MetricName, number>();

/**
 * Bounded tag dimensions for the small number of metrics that need
 * a partner/event breakdown for DLQ surfacing. Kept deliberately
 * narrow to honour cardinality discipline — only `provider` and
 * `eventType` are accepted, both bounded by the integration catalogue.
 *
 * Stored as a flat dotted-key (`metric|provider=X|eventType=Y`) so
 * the in-process Map stays simple. Snapshot consumers call
 * `getTaggedMetricsSnapshot` to enumerate the tag breakdown.
 */
export interface MetricTags {
  provider?: string;
  eventType?: string;
}

const TAGGED_COUNTERS = new Map<string, number>();

function taggedKey(name: MetricName, tags: MetricTags): string {
  const parts: string[] = [name];
  if (tags.provider) parts.push(`provider=${tags.provider}`);
  if (tags.eventType) parts.push(`eventType=${tags.eventType}`);
  return parts.join('|');
}

/**
 * Bump a counter by one. No-op-safe: if the name happens to land before
 * a future addition to the vocabulary it still records — TypeScript
 * catches the typo at the call site since `MetricName` is a closed union.
 *
 * Constant-cost (Map lookup + numeric increment). Safe to call inline
 * on the hot path.
 *
 * Optional `tags` adds a bounded breakdown for DLQ-style metrics
 * (provider + eventType only). The aggregate counter is always bumped;
 * the tagged counter is bumped additionally when tags are supplied.
 *
 * Backwards-compatible call shapes:
 *   incrementMetric('x')                       — by 1, no tags
 *   incrementMetric('x', 5)                    — by 5, no tags
 *   incrementMetric('x', { provider: 'p' })    — by 1, tagged
 *   incrementMetric('x', { provider: 'p' }, 5) — by 5, tagged
 */
export function incrementMetric(
  name: MetricName,
  byOrTags: number | MetricTags = 1,
  maybeBy = 1,
): void {
  const by = typeof byOrTags === 'number' ? byOrTags : maybeBy;
  const tags = typeof byOrTags === 'object' ? byOrTags : undefined;
  const next = (COUNTERS.get(name) ?? 0) + by;
  COUNTERS.set(name, next);
  if (tags && (tags.provider || tags.eventType)) {
    const key = taggedKey(name, tags);
    TAGGED_COUNTERS.set(key, (TAGGED_COUNTERS.get(key) ?? 0) + by);
  }
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

/**
 * Read the tagged counter set. Returns a fresh object keyed by the
 * flat dotted-key form. Used by the DLQ surface to render the
 * per-provider breakdown of unimplemented webhook handlers.
 */
export function getTaggedMetricsSnapshot(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of TAGGED_COUNTERS.entries()) {
    out[key] = value;
  }
  return out;
}

/** Test-only: drop all counters between specs. */
export function _resetMetricsForTest(): void {
  COUNTERS.clear();
  TAGGED_COUNTERS.clear();
}
