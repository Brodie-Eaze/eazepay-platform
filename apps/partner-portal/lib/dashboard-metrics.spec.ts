/**
 * Hermetic unit tests for dashboard-metrics helpers.
 *
 * WHY:
 *   Every KPI tile + chart in the partner-portal goes through these
 *   reducers (Sprint H). If `trendDelta` or `applicationsInRange` drift
 *   silently, every dashboard number becomes wrong simultaneously. Pinning
 *   these in tests is cheap insurance.
 */
import { describe, it, expect } from 'vitest';
import {
  applicationsByMonth,
  applicationsByStatus,
  applicationsInRange,
  creditMix,
  creditTierFor,
  fundedVolumeByMonth,
  monthKeyToWindow,
  priorWindow,
  timeRangeToWindow,
  totalFundedCents,
  trendDelta,
} from './dashboard-metrics';
import type { ApplicationRow } from './master-data';

const NOW = new Date('2026-05-27T00:00:00Z');

const rows: ApplicationRow[] = [
  {
    id: 'r1',
    customer: 'A',
    customerEmail: 'a@x.test',
    partner: 'P1',
    product: 'med-pay',
    amountCents: 100_00,
    fico: 720,
    lender: 'L',
    status: 'funded',
    date: '2026-05-20',
  },
  {
    id: 'r2',
    customer: 'B',
    customerEmail: 'b@x.test',
    partner: 'P1',
    product: 'med-pay',
    amountCents: 200_00,
    fico: 650,
    lender: 'L',
    status: 'approved',
    date: '2026-05-10',
  },
  {
    id: 'r3',
    customer: 'C',
    customerEmail: 'c@x.test',
    partner: 'P1',
    product: 'med-pay',
    amountCents: 50_00,
    fico: 590,
    lender: 'L',
    status: 'declined',
    date: '2026-04-15',
  },
  {
    id: 'r4',
    customer: 'D',
    customerEmail: 'd@x.test',
    partner: 'P1',
    product: 'med-pay',
    amountCents: 300_00,
    fico: 550,
    lender: 'L',
    status: 'submitted',
    date: '2026-03-01',
  },
];

describe('timeRangeToWindow', () => {
  it('30d window ends today and starts 29 days back', () => {
    const { fromIso, toIso, days } = timeRangeToWindow('30d', NOW);
    expect(toIso).toBe('2026-05-27');
    expect(fromIso).toBe('2026-04-28');
    expect(days).toBe(30);
  });
  it('all returns an unbounded from', () => {
    const { fromIso, toIso } = timeRangeToWindow('all', NOW);
    expect(fromIso).toBe('1970-01-01');
    expect(toIso).toBe('2026-05-27');
  });
});

describe('priorWindow', () => {
  it('30d prior window is the 30 days BEFORE the current 30d window', () => {
    const { fromIso, toIso } = priorWindow('30d', NOW);
    expect(toIso).toBe('2026-04-27');
    expect(fromIso).toBe('2026-03-29');
  });
});

describe('applicationsInRange', () => {
  it('keeps rows on the from/to boundary', () => {
    const out = applicationsInRange(rows, '2026-04-15', '2026-05-20');
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
  });
});

describe('applicationsByStatus', () => {
  it('counts every bucket', () => {
    expect(applicationsByStatus(rows)).toEqual({
      submitted: 1,
      in_review: 0,
      approved: 1,
      funded: 1,
      declined: 1,
      total: 4,
    });
  });
});

describe('trendDelta', () => {
  it('flat when both zero', () => {
    expect(trendDelta(0, 0)).toEqual({ pct: 0, direction: 'flat' });
  });
  it('+100 when prior is zero and current is positive', () => {
    expect(trendDelta(5, 0)).toEqual({ pct: 100, direction: 'up' });
  });
  it('rounds to nearest integer', () => {
    expect(trendDelta(11, 10)).toEqual({ pct: 10, direction: 'up' });
  });
  it('reports direction as down for negative movement', () => {
    expect(trendDelta(8, 10)).toEqual({ pct: 20, direction: 'down' });
  });
});

describe('totalFundedCents', () => {
  it('sums only funded rows', () => {
    expect(totalFundedCents(rows)).toBe(100_00);
  });
});

describe('applicationsByMonth', () => {
  it('seeds zero buckets for empty months', () => {
    const out = applicationsByMonth(rows, '2026-02-01', '2026-05-31');
    expect(out.map((b) => b.monthKey)).toEqual(['2026-02', '2026-03', '2026-04', '2026-05']);
    const counts = Object.fromEntries(out.map((b) => [b.monthKey, b.value]));
    expect(counts['2026-02']).toBe(0);
    expect(counts['2026-03']).toBe(1);
    expect(counts['2026-04']).toBe(1);
    expect(counts['2026-05']).toBe(2);
  });
});

describe('fundedVolumeByMonth', () => {
  it('only counts funded rows and reports dollars', () => {
    const out = fundedVolumeByMonth(rows, '2026-05-01', '2026-05-31');
    expect(out).toEqual([{ label: 'May', value: 100, monthKey: '2026-05' }]);
  });
});

describe('creditTierFor', () => {
  it('buckets known boundaries', () => {
    expect(creditTierFor(820)).toBe('Prime');
    expect(creditTierFor(700)).toBe('Prime');
    expect(creditTierFor(699)).toBe('NearPrime');
    expect(creditTierFor(640)).toBe('NearPrime');
    expect(creditTierFor(580)).toBe('Subprime');
    expect(creditTierFor(579)).toBe('DeepSubprime');
  });
});

describe('creditMix', () => {
  it('returns all four tiers in stable order', () => {
    const out = creditMix(rows);
    expect(out.map((c) => c.name)).toEqual(['Prime', 'NearPrime', 'Subprime', 'DeepSubprime']);
    const counts = Object.fromEntries(out.map((c) => [c.name, c.count]));
    expect(counts).toEqual({ Prime: 1, NearPrime: 1, Subprime: 1, DeepSubprime: 1 });
  });
});

describe('monthKeyToWindow', () => {
  it('returns the full month boundary including 31-day months', () => {
    expect(monthKeyToWindow('2026-05')).toEqual({ fromIso: '2026-05-01', toIso: '2026-05-31' });
  });
  it('handles February correctly in a non-leap year', () => {
    expect(monthKeyToWindow('2026-02')).toEqual({ fromIso: '2026-02-01', toIso: '2026-02-28' });
  });
});
