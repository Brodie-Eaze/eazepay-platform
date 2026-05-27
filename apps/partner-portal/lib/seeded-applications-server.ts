/**
 * Server-only selectors over the 420-row seeded application fixture.
 *
 * WHY THIS FILE EXISTS
 *   `seeded-applications.ts` exports a ~420-row deterministic array
 *   (~1MB stringified). Until this commit, four CLIENT components
 *   imported it directly, which meant Next.js shipped the entire
 *   fixture in the client JS bundle on every dashboard / list view.
 *
 *   We have now marked `seeded-applications.ts` with `'server-only'`
 *   so any future client import is a build-time error. All derived
 *   KPIs and row queries live here on the server, behind
 *   `/api/admin/dashboard/*` JSON endpoints. The client pages fetch
 *   pre-aggregated payloads (~5KB) instead of importing the raw rows.
 *
 *   Cost before: ~1MB JS over the wire + parse cost on every nav
 *   Cost after:  ~5KB JSON, cached by TanStack Query
 *
 * Anything in this file MUST stay server-side. Do not move logic that
 * lives here into a shared/client-safe module without verifying the
 * fixture import boundary is preserved.
 */
import 'server-only';

import type { ApplicationRow } from './master-data';
import { expandedApplications } from './seeded-applications';
import { applications, partners } from './master-data';
import {
  applicationsByMonth,
  applicationsByStatus,
  applicationsInRange,
  creditMix,
  fundedVolumeByMonth,
  priorWindow,
  timeRangeToWindow,
  totalFundedCents,
  trendDelta,
  type CreditTier,
} from './dashboard-metrics';
import type { TimeRange } from '@eazepay/ui/web';

/* ─── Snapshot shape — kept stable; this is the wire contract ────────── */

export interface DashboardKpiSnapshot {
  /** Echo of the range the server resolved (`90d` for master, caller-chosen for brand). */
  range: TimeRange;
  /** Status counters in the resolved window. */
  cur: {
    total: number;
    approved: number;
    funded: number;
    declined: number;
    in_review: number;
  };
  /** Signed-percent deltas vs the prior equal-length window. */
  deltas: {
    submitted: number;
    approved: number;
    funded: number;
    declined: number;
    inReview: number;
    fundedCents: number;
  };
  fundedCents: number;
  /** Trend-bar series (last N months). Length depends on range. */
  monthlySubs: Array<{ label: string; value: number; iso?: string }>;
  monthlyFunded: Array<{ label: string; value: number; iso?: string }>;
  /** Credit-tier mix with percentages already computed. */
  mix: Array<{ name: CreditTier; range: string; count: number; pct: number }>;
  /** Whether the partner had ANY seeded rows. Per-brand pages fall back
   *  to a scaled snapshot when this is false. */
  partnerHasRows?: boolean;
}

/* ─── Selectors (all server-side) ────────────────────────────────────── */

/** Master Command Center snapshot — global aggregate over the 90d window. */
export function masterSnapshot(): DashboardKpiSnapshot {
  return buildSnapshot(expandedApplications, '90d', { wideChartRange: '12m' });
}

/** Per-brand snapshot — filtered to one partner by legalName. */
export function partnerSnapshot(partnerLegalName: string, range: TimeRange): DashboardKpiSnapshot {
  const partnerRows = expandedApplications.filter((a) => a.partner === partnerLegalName);
  if (partnerRows.length === 0) {
    return {
      ...buildSnapshot([], range),
      partnerHasRows: false,
    };
  }
  return {
    ...buildSnapshot(partnerRows, range),
    partnerHasRows: true,
  };
}

/** Raw seeded rows for a partner+product — used by the apps list page. */
export function applicationsForPartnerProduct(
  partnerLegalName: string,
  product: string,
  excludeIds: ReadonlySet<string>,
): ApplicationRow[] {
  return expandedApplications.filter(
    (a) => a.partner === partnerLegalName && a.product === product && !excludeIds.has(a.id),
  );
}

/** Single-row lookup for the detail page. */
export function findSeededApplication(id: string): ApplicationRow | null {
  return expandedApplications.find((a) => a.id === id) ?? null;
}

/** Recent rows for a partner — used by per-brand dashboard's "Recent
 *  Applications" table. Returns at most `limit` rows (newest first)
 *  drawn from the seeded fixture, excluding any ids the caller has
 *  already merged in (hand-curated or live submitted rows). */
export function recentSeededApplicationsForPartner(
  partnerLegalName: string,
  limit: number,
  excludeIds: ReadonlySet<string>,
): ApplicationRow[] {
  return expandedApplications
    .filter((a) => a.partner === partnerLegalName && !excludeIds.has(a.id))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, Math.max(0, Math.min(limit, 50)));
}

/** Partner leaderboard for the master Command Center. */
export function partnerLeaderboard(limit = 5) {
  return partners
    .slice(0, limit)
    .sort((a, b) => b.netCents - a.netCents)
    .map((p, i) => ({
      rank: i + 1,
      partnerId: p.id,
      name: p.legalName,
      funded: p.netCents,
      apps: 47 - i * 8,
      fundedCount: 38 - i * 7,
      approval: 87 - i * 6,
    }));
}

/* ─── Internal ───────────────────────────────────────────────────────── */

function buildSnapshot(
  rows: readonly ApplicationRow[],
  range: TimeRange,
  opts: { wideChartRange?: TimeRange } = {},
): DashboardKpiSnapshot {
  const { fromIso, toIso } = timeRangeToWindow(range);
  const prior = priorWindow(range);

  const inWindow = applicationsInRange(rows, fromIso, toIso);
  const inPrior = applicationsInRange(rows, prior.fromIso, prior.toIso);
  const cur = applicationsByStatus(inWindow);
  const pre = applicationsByStatus(inPrior);

  const fundedCents = totalFundedCents(inWindow);
  const fundedCentsPrior = totalFundedCents(inPrior);

  // Master uses a wider 12m window for trend bars; per-brand uses the
  // active range so the bars match the KPI window.
  const chartWindow = opts.wideChartRange
    ? timeRangeToWindow(opts.wideChartRange)
    : { fromIso, toIso };
  const monthlySubs = applicationsByMonth(rows, chartWindow.fromIso, chartWindow.toIso);
  const monthlyFunded = fundedVolumeByMonth(rows, chartWindow.fromIso, chartWindow.toIso);

  const mix = creditMix(inWindow);
  const mixTotal = mix.reduce((s, m) => s + m.count, 0);
  const mixWithPct = mix.map((m) => ({
    ...m,
    pct: mixTotal === 0 ? 0 : Math.round((m.count / mixTotal) * 100),
  }));

  const signed = (d: { pct: number; direction: 'up' | 'down' | 'flat' }) =>
    d.direction === 'flat' ? 0 : d.direction === 'up' ? d.pct : -d.pct;

  return {
    range,
    cur,
    deltas: {
      submitted: signed(trendDelta(cur.total, pre.total)),
      approved: signed(trendDelta(cur.approved, pre.approved)),
      funded: signed(trendDelta(cur.funded, pre.funded)),
      declined: signed(trendDelta(cur.declined, pre.declined)),
      inReview: signed(trendDelta(cur.in_review, pre.in_review)),
      fundedCents: signed(trendDelta(fundedCents, fundedCentsPrior)),
    },
    fundedCents,
    monthlySubs,
    monthlyFunded,
    mix: mixWithPct,
  };
}

/** Re-exports we don't want client pages to need a direct master-data
 *  import for (keeps the dependency graph honest). */
export { applications as handCuratedApplications };
