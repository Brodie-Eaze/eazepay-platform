/**
 * Dashboard metrics helpers.
 *
 * WHY:
 *   Every dashboard tile in the portal needs to compute the same shape of
 *   stat — "applications in window", "funded volume by month", "trend
 *   delta vs prior window". When each page inlines its own reducer the
 *   numbers diverge under any data shape change. These helpers centralise
 *   the math so /v/[brand], /admin, /reports etc. all stay aligned.
 *
 *   The window math is fixture-only for now (we look at `row.date`, an ISO
 *   string), but the call sites mirror what the future BFF will accept:
 *   `(rows, from, to)` →  metrics. Swapping to a real API is a one-line
 *   change at the boundary.
 */
import type { ApplicationRow } from './master-data';
import type { TimeRange } from '@eazepay/ui/web';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Convert a TimeRange + a clock to a concrete [from, to] ISO date window.
 * `to` is the end-of-day for "today"; `from` is range-days back from `to`.
 * `all` returns a from of epoch-zero so callers don't have to special-case
 * the unbounded path.
 */
export function timeRangeToWindow(
  range: TimeRange,
  now: Date = new Date(),
): { fromIso: string; toIso: string; days: number } {
  const toIso = now.toISOString().slice(0, 10);
  if (range === 'all') {
    return { fromIso: '1970-01-01', toIso, days: 365 * 100 };
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const from = new Date(now.getTime() - (days - 1) * DAY_MS);
  return { fromIso: from.toISOString().slice(0, 10), toIso, days };
}

/** Same window length, shifted back by its own width — for trend delta. */
export function priorWindow(
  range: TimeRange,
  now: Date = new Date(),
): { fromIso: string; toIso: string } {
  if (range === 'all') return { fromIso: '1970-01-01', toIso: '1970-01-01' };
  const { days } = timeRangeToWindow(range, now);
  const priorTo = new Date(now.getTime() - days * DAY_MS);
  const priorFrom = new Date(priorTo.getTime() - (days - 1) * DAY_MS);
  return {
    fromIso: priorFrom.toISOString().slice(0, 10),
    toIso: priorTo.toISOString().slice(0, 10),
  };
}

export function applicationsInRange(
  rows: readonly ApplicationRow[],
  fromIso: string,
  toIso: string,
): ApplicationRow[] {
  return rows.filter((r) => r.date >= fromIso && r.date <= toIso);
}

/**
 * Direction-aware percent delta. Returns a positive number for "current >
 * prior" with `direction: 'up'`, etc. Caller decides what's "good" given
 * the metric (declined trending up is bad; funded trending up is good).
 */
export function trendDelta(
  current: number,
  prior: number,
): { pct: number; direction: 'up' | 'down' | 'flat' } {
  if (prior === 0 && current === 0) return { pct: 0, direction: 'flat' };
  if (prior === 0) return { pct: 100, direction: 'up' };
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return { pct: 0, direction: 'flat' };
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : 'down' };
}

/** Status-bucketed counts for a given row set. Used by every KPI grid. */
export function applicationsByStatus(rows: readonly ApplicationRow[]): {
  submitted: number;
  in_review: number;
  approved: number;
  funded: number;
  declined: number;
  total: number;
} {
  let submitted = 0;
  let in_review = 0;
  let approved = 0;
  let funded = 0;
  let declined = 0;
  for (const r of rows) {
    if (r.status === 'submitted') submitted++;
    else if (r.status === 'in_review') in_review++;
    else if (r.status === 'approved') approved++;
    else if (r.status === 'funded') funded++;
    else if (r.status === 'declined') declined++;
  }
  return {
    submitted,
    in_review,
    approved,
    funded,
    declined,
    total: rows.length,
  };
}

/** Sum of funded amountCents in a row set. */
export function totalFundedCents(rows: readonly ApplicationRow[]): number {
  let acc = 0;
  for (const r of rows) if (r.status === 'funded') acc += r.amountCents;
  return acc;
}

/**
 * Bucket the rows into monthly bins between `fromIso` and `toIso`,
 * counting matches per bin. Returns one entry per month in the window,
 * even months with zero matches, so the chart axis stays continuous.
 *
 * `filterFn` lets the caller scope to e.g. funded-only rows for the
 * Funded Volume chart.
 */
export function applicationsByMonth(
  rows: readonly ApplicationRow[],
  fromIso: string,
  toIso: string,
  filterFn: (r: ApplicationRow) => boolean = () => true,
): Array<{ label: string; value: number; monthKey: string }> {
  const buckets = new Map<string, number>();
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);

  /* Seed every month in the window so empty months still render. */
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor <= to) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, 0);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  for (const r of rows) {
    if (!filterFn(r)) continue;
    if (r.date < fromIso || r.date > toIso) continue;
    const key = r.date.slice(0, 7);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return Array.from(buckets.entries()).map(([monthKey, value]) => {
    const [, mm] = monthKey.split('-');
    const monthIdx = Number(mm) - 1;
    return { label: monthNames[monthIdx] ?? mm ?? '', value, monthKey };
  });
}

/** Sum of funded amount in dollars (not cents) per month — for the
 *  Funded Volume chart. */
export function fundedVolumeByMonth(
  rows: readonly ApplicationRow[],
  fromIso: string,
  toIso: string,
): Array<{ label: string; value: number; monthKey: string }> {
  const buckets = new Map<string, number>();
  const from = new Date(`${fromIso}T00:00:00Z`);
  const to = new Date(`${toIso}T00:00:00Z`);
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor <= to) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, 0);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  for (const r of rows) {
    if (r.status !== 'funded') continue;
    if (r.date < fromIso || r.date > toIso) continue;
    const key = r.date.slice(0, 7);
    buckets.set(key, (buckets.get(key) ?? 0) + r.amountCents / 100);
  }

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return Array.from(buckets.entries()).map(([monthKey, value]) => {
    const [, mm] = monthKey.split('-');
    const monthIdx = Number(mm) - 1;
    return { label: monthNames[monthIdx] ?? mm ?? '', value: Math.round(value), monthKey };
  });
}

/** Bucket applications into FICO tiers — used by the Credit Insights donut. */
export type CreditTier = 'Prime' | 'NearPrime' | 'Subprime' | 'DeepSubprime';
export const CREDIT_TIER_RANGES: Record<CreditTier, [number, number]> = {
  Prime: [700, 850],
  NearPrime: [640, 699],
  Subprime: [580, 639],
  DeepSubprime: [300, 579],
};

export function creditTierFor(fico: number): CreditTier {
  if (fico >= 700) return 'Prime';
  if (fico >= 640) return 'NearPrime';
  if (fico >= 580) return 'Subprime';
  return 'DeepSubprime';
}

export function creditMix(
  rows: readonly ApplicationRow[],
): Array<{ name: CreditTier; range: string; count: number }> {
  const order: CreditTier[] = ['Prime', 'NearPrime', 'Subprime', 'DeepSubprime'];
  const counts: Record<CreditTier, number> = {
    Prime: 0,
    NearPrime: 0,
    Subprime: 0,
    DeepSubprime: 0,
  };
  for (const r of rows) counts[creditTierFor(r.fico)]++;
  return order.map((name) => {
    const [lo, hi] = CREDIT_TIER_RANGES[name];
    return { name, range: `${lo}–${hi}`, count: counts[name] };
  });
}

/**
 * Given a month bucket (label + monthKey from applicationsByMonth/
 * fundedVolumeByMonth), produce the [from, to] ISO pair that scopes a
 * filtered list view to that month. Used by the chart-click → /applications
 * routing.
 */
export function monthKeyToWindow(monthKey: string): { fromIso: string; toIso: string } {
  const [yyyy, mm] = monthKey.split('-');
  const y = Number(yyyy);
  const m = Number(mm);
  const fromIso = `${yyyy}-${mm}-01`;
  /* Last day of the month: day 0 of next month. */
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const toIso = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
  return { fromIso, toIso };
}
