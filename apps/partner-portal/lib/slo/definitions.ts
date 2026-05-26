/**
 * SLO catalogue for the EazePay platform.
 *
 * The canonical machine-readable companion to `docs/SLO.md`. The
 * markdown doc is the narrative version (audience: compliance / SOC2
 * evidence); this module is what the `/admin/observability/slo` page,
 * the error-budget helper, and any future alerting integration read.
 *
 * Single source of truth — adding an SLO is a one-line entry here.
 * The error-budget computation is in `error-budget.ts`; the page in
 * `app/admin/observability/slo/page.tsx`; the route handler in
 * `app/api/admin/slo/route.ts`.
 *
 * Why we have BOTH this and the markdown doc:
 *   • Markdown is what an auditor or partner reads. Plain English,
 *     contains action-when-breached + named owner. Lives in source
 *     control so it goes through code review.
 *   • This module is what the runtime reads. It enforces type-checked
 *     consistency between the SLO board UI and the error-budget math,
 *     and ensures every SLO has a runbook link.
 *   • A drift between the two is a code review smell, NOT a runtime
 *     bug — the `slo-doc-consistency` spec checks both sides match.
 */

/**
 * SLI category — what kind of measurement the SLO is built on.
 *
 *   • `availability` → ratio of successful operations / total ops.
 *     Target is a fraction (e.g. 0.999 = 99.9% successful).
 *   • `latency`      → percentile of response time below a threshold.
 *     Target is a fraction of requests meeting the latency budget
 *     (e.g. 0.95 = 95% of requests under the budget).
 *   • `correctness`  → operations producing the right answer / passing
 *     a downstream invariant check. Used for outbound webhook
 *     deliveries — "we did the right thing" vs. "we replied 200".
 */
export type SliCategory = 'availability' | 'latency' | 'correctness';

/**
 * SLO measurement window. We standardise on two:
 *
 *   • `7d`  — short-window SLOs. Useful for latency where a rolling
 *     week catches drift fast without being noisy.
 *   • `30d` — long-window SLOs. Used for availability where the budget
 *     translates to "minutes of downtime per month" — the version
 *     business stakeholders understand.
 *
 * Other windows (1h, 24h, 90d) are valid but not in use today. Adding
 * one is a one-line union extension + matching minutesInWindow case.
 */
export type SloWindow = '7d' | '30d';

/**
 * Structured SLI definition. The shape carries enough metadata for the
 * SLO board to render a meaningful "observed" value without a
 * service-specific switch in the UI.
 */
export interface SliDefinition {
  category: SliCategory;
  /** Human description — appears in the runbook + the board card. */
  description: string;
  /**
   * Where the observed value comes from. The metric name is intentionally
   * loose-typed (string) because not every SLO is backed by a counter in
   * `lib/observability/metrics.ts` today — several measure latency
   * percentiles via OTel histograms (`http.server.duration`) which the
   * in-process counter store doesn't model. The route handler returns
   * `observed: null` for those until the OTel pipeline lands.
   */
  source: string;
  /** For latency SLIs: the threshold (ms) the percentile is measured against. */
  latencyBudgetMs?: number;
}

/**
 * Canonical SLO row.
 *
 * Invariants enforced by the type:
 *   • `target` is a fraction in (0, 1) — 0.95 not 95.
 *   • `window` is one of the two supported values.
 *   • `errorBudgetMinutes` is computed at module load and frozen.
 *     We don't store the raw number from a literal — the calculation
 *     (1 - target) × minutesInWindow(window) is the same math the
 *     error-budget helper does, just denormalised onto the SLO so the
 *     UI doesn't have to re-derive it on every render.
 */
export interface SloDefinition {
  /** Stable id — used as React key + alerting label. Kebab-case. */
  id: string;
  /** Human name — appears as the card title on the board. */
  name: string;
  /**
   * Service / subsystem the SLO measures. Free-form for now; future
   * work can pivot to a closed union once the service taxonomy is
   * locked. Aligns with the `service` column in incident records.
   */
  service:
    | 'consumer-apply'
    | 'decision-engine'
    | 'webhook-ingestion'
    | 'admin-portal'
    | 'lender-api';
  sli: SliDefinition;
  /** Fraction in (0, 1). e.g. 0.999 = three nines. */
  target: number;
  window: SloWindow;
  /** Pre-computed: (1 - target) × minutesInWindow(window). */
  errorBudgetMinutes: number;
  /**
   * Relative path to the runbook that responds to a breach of this SLO.
   * Resolved against `docs/runbooks/` so the SLO board can render
   * "Runbook: webhook-dlq.md" as a deep link. Builder J's runbooks
   * are the destination; if a runbook is missing the link will 404
   * which is the correct signal for "we need to write the runbook".
   */
  runbookLink: string;
}

/** Convert a window literal to a duration in minutes. Closed over the
 *  small set of supported windows so the math is honest — we don't
 *  silently round 30d to 30 calendar days when months have 28-31 days.
 *  Months are not the unit; rolling windows are. */
export function minutesInWindow(window: SloWindow): number {
  switch (window) {
    case '7d':
      return 7 * 24 * 60; // 10 080
    case '30d':
      return 30 * 24 * 60; // 43 200
    default: {
      // Exhaustiveness check — adding a new window literal forces a
      // matching case here at compile time.
      const _exhaustive: never = window;
      return _exhaustive;
    }
  }
}

/**
 * Internal helper used at module-load time to denormalise the error
 * budget onto each SLO row. Kept here (not exported) so the only way
 * to mutate an SLO's budget is to change the target / window.
 */
function computeBudget(target: number, window: SloWindow): number {
  // Round to the nearest minute. Sub-minute precision is meaningless
  // for budgets reported as "you have 3.6 hours of downtime this month".
  return Math.round((1 - target) * minutesInWindow(window));
}

/**
 * The catalogue. Every consumer SHOULD treat this as read-only —
 * mutations at runtime would desync the page from the route + cached
 * snapshots. TypeScript marks the array as readonly but the SLO objects
 * themselves are not deep-frozen for cost reasons (we ship to Edge in
 * one route; Object.freeze on every render is wasted CPU).
 *
 * Order matters — this is the display order on the SLO board. Group
 * by service so on-call sees "all consumer-apply SLOs together".
 */
export const SLO_DEFINITIONS: ReadonlyArray<SloDefinition> = [
  // ── Consumer apply ─────────────────────────────────────────────────
  {
    id: 'consumer-apply-availability',
    name: 'Consumer apply availability',
    service: 'consumer-apply',
    sli: {
      category: 'availability',
      description:
        'Fraction of consumer apply submissions that return 2xx within 30 s, vs. total submissions.',
      source: 'applications.created / (applications.created + applications.failed)',
    },
    target: 0.999, // three nines
    window: '30d',
    errorBudgetMinutes: computeBudget(0.999, '30d'), // 43.2 min
    runbookLink: 'docs/runbooks/incident-response.md',
  },
  {
    id: 'consumer-apply-latency-p95',
    name: 'Consumer apply latency (p95)',
    service: 'consumer-apply',
    sli: {
      category: 'latency',
      description:
        '95th percentile of POST /api/applications submission latency, end-to-end including decision-engine fan-out, under 1500 ms.',
      source: 'http.server.duration{route="/api/applications"}',
      latencyBudgetMs: 1500,
    },
    // For latency SLOs the "target" is the fraction of requests that
    // must meet the latency budget. 0.95 ≡ p95 < 1500 ms.
    target: 0.95,
    window: '7d',
    errorBudgetMinutes: computeBudget(0.95, '7d'), // 504 min (5% of week)
    runbookLink: 'docs/runbooks/observability.md',
  },

  // ── Decision engine ────────────────────────────────────────────────
  {
    id: 'decision-engine-availability',
    name: 'Decision engine availability',
    service: 'decision-engine',
    sli: {
      category: 'availability',
      description:
        'Fraction of decision-engine evaluations that complete successfully (engine + fallback path), vs. total evaluations.',
      source: 'decisions.computed / (decisions.computed + decisions.failed)',
    },
    target: 0.9995, // three-and-a-half nines
    window: '30d',
    errorBudgetMinutes: computeBudget(0.9995, '30d'), // 21.6 min
    runbookLink: 'docs/runbooks/incident-response.md',
  },
  {
    id: 'decision-engine-latency-p95',
    name: 'Decision engine latency (p95)',
    service: 'decision-engine',
    sli: {
      category: 'latency',
      description:
        '95th percentile of POST /api/v1/decision-engine latency under 250 ms. Engine is in-process; this gate catches scorer / filter regressions.',
      source: 'http.server.duration{route="/api/v1/decision-engine"}',
      latencyBudgetMs: 250,
    },
    target: 0.95,
    window: '7d',
    errorBudgetMinutes: computeBudget(0.95, '7d'),
    runbookLink: 'docs/runbooks/observability.md',
  },

  // ── Webhook ingestion ──────────────────────────────────────────────
  {
    id: 'webhook-ingestion-availability',
    name: 'Webhook ingestion availability',
    service: 'webhook-ingestion',
    sli: {
      category: 'availability',
      // The closest thing to a "we never silently drop" SLO. The
      // measurement is "every webhook that reached us got inserted",
      // which is exactly what the inbox UNIQUE constraint enforces.
      description:
        'Fraction of inbound lender webhooks that result in either an inbox row insert OR an idempotent dedupe receipt (200), vs. total inbound webhooks.',
      source:
        '(webhook.queued + webhook.duplicate) / (webhook.queued + webhook.duplicate + webhook.rejected)',
    },
    target: 0.9999, // four nines — silent drops are a P0
    window: '30d',
    errorBudgetMinutes: computeBudget(0.9999, '30d'), // 4.3 min
    runbookLink: 'docs/runbooks/webhook-dlq.md',
  },

  // ── Lender API integration health ─────────────────────────────────
  {
    id: 'lender-api-integration-health',
    name: 'Lender API integration health',
    service: 'lender-api',
    sli: {
      category: 'correctness',
      description:
        'Aggregate first-attempt webhook delivery success rate to lender callback URLs, across all wired lenders, over a rolling 7-day window. Excludes endpoints in consecutive_failures auto-pause state.',
      source:
        'webhook_deliveries: COUNT(*) FILTER (WHERE attempt=1 AND status=delivered) / COUNT(*) FILTER (WHERE attempt=1)',
    },
    target: 0.995, // two-and-a-half nines
    window: '7d',
    errorBudgetMinutes: computeBudget(0.995, '7d'), // 50 min
    runbookLink: 'docs/runbooks/webhook-dlq.md',
  },
] as const;

/**
 * Lookup by id. Returns `undefined` when the id is not in the catalogue;
 * callers MUST handle that branch — a missing SLO is not a runtime
 * error, it's "this id was renamed". The page handles it as a
 * card-missing state.
 */
export function findSloById(id: string): SloDefinition | undefined {
  return SLO_DEFINITIONS.find((s) => s.id === id);
}
