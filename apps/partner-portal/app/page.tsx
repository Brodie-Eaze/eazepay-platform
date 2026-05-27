'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  ArrowRightIcon,
  DollarIcon,
  XIcon,
  ClockIcon,
  TrendUpIcon,
  TrendDownIcon,
  TrophyIcon,
} from '@eazepay/ui/web';
import { formatCurrencyCents } from '@eazepay/shared-utils/format-currency';
import { partners, applications, masterKpis } from '../lib/master-data';
import { expandedApplications } from '../lib/seeded-applications';
import {
  applicationsByMonth,
  applicationsByStatus,
  applicationsInRange,
  CREDIT_TIER_RANGES,
  creditMix,
  fundedVolumeByMonth,
  priorWindow,
  timeRangeToWindow,
  totalFundedCents,
  trendDelta,
  type CreditTier,
} from '../lib/dashboard-metrics';

/**
 * Master Command Centre — direct port of the Lovable reference.
 *
 * Layout:
 *   ┌──── Eyebrow + page title (Command Center) ────┐
 *   │ ┌────┬────┬────┐  ← row 1: SUBMITTED / APPROVED / FUNDED
 *   │ └────┴────┴────┘
 *   │ ┌────┬────┬────┐  ← row 2: TOTAL FUNDED / DECLINED / IN REVIEW
 *   │ └────┴────┴────┘
 *   │ ┌────┬────┬────┐
 *   │ │ MS │ FV │ CI │  ← Monthly Submissions / Funded Volume / Credit Insights
 *   │ └────┴────┴────┘
 *   │ ┌──── Partner Leaderboard ────┐
 *   │ │ (5 rows w/ trophy on #1)    │
 *   │ └─────────────────────────────┘
 *
 * Every value comes from `lib/master-data` for now; once the BFF's
 * `/admin/dashboard` endpoint is wired, swap `masterKpis` for a
 * TanStack query against `useApi`.
 */

// Donut palette — navy → light grey ramp. Matches the rest of the
// platform's navy + grey + light grey colour discipline; no accent
// indigo / violet / green outside of explicit semantic signals
// (green = up delta, red = down delta).
const CREDIT_TIER_COLOURS: Record<CreditTier, string> = {
  Prime: '#0d1530',
  NearPrime: '#1e3a8a',
  Subprime: '#94a3b8',
  DeepSubprime: '#cbd5e1',
};
const CREDIT_TIER_RANGE_LABEL: Record<CreditTier, string> = {
  Prime: `${CREDIT_TIER_RANGES.Prime[0]}–${CREDIT_TIER_RANGES.Prime[1]}`,
  NearPrime: `${CREDIT_TIER_RANGES.NearPrime[0]}–${CREDIT_TIER_RANGES.NearPrime[1]}`,
  Subprime: `${CREDIT_TIER_RANGES.Subprime[0]}–${CREDIT_TIER_RANGES.Subprime[1]}`,
  DeepSubprime: `${CREDIT_TIER_RANGES.DeepSubprime[0]}–${CREDIT_TIER_RANGES.DeepSubprime[1]}`,
};

const leaderboard = partners
  .slice(0, 5)
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
const maxFunded = leaderboard[0]?.funded ?? 1;

// ── Component ────────────────────────────────────────────────────────

export default function CommandCenter() {
  // ── Live snapshot ── derive every KPI + chart from expandedApplications.
  // Range: rolling 6 months for charts, last 90 days vs prior 90 days
  // for KPI deltas. Was hardcoded — user explicitly asked for live data.
  const live = useMemo(() => {
    const { fromIso, toIso } = timeRangeToWindow('90d');
    const prior = priorWindow('90d');
    const inWindow = applicationsInRange(expandedApplications, fromIso, toIso);
    const inPrior = applicationsInRange(expandedApplications, prior.fromIso, prior.toIso);
    const cur = applicationsByStatus(inWindow);
    const pre = applicationsByStatus(inPrior);

    const fundedCents = totalFundedCents(inWindow);
    const fundedCentsPrior = totalFundedCents(inPrior);

    // Charts read a wider window (6 months) so trend bars actually
    // show a trend instead of mostly-zero columns.
    const chartWindow = timeRangeToWindow('12m');
    const monthlySubs = applicationsByMonth(
      expandedApplications,
      chartWindow.fromIso,
      chartWindow.toIso,
    );
    const monthlyFunded = fundedVolumeByMonth(
      expandedApplications,
      chartWindow.fromIso,
      chartWindow.toIso,
    );
    const mix = creditMix(inWindow);
    const mixTotal = mix.reduce((s, m) => s + m.count, 0);
    const mixWithPct = mix.map((m) => ({
      ...m,
      pct: mixTotal === 0 ? 0 : Math.round((m.count / mixTotal) * 100),
    }));

    // trendDelta returns { pct, direction }; KPI only needs pct.
    const dp = (a: number, b: number) => trendDelta(a, b).pct;
    return {
      submitted: cur.total,
      submittedDelta: dp(cur.total, pre.total),
      approved: cur.approved,
      approvedDelta: dp(cur.approved, pre.approved),
      funded: cur.funded,
      fundedDelta: dp(cur.funded, pre.funded),
      declined: cur.declined,
      declinedDelta: dp(cur.declined, pre.declined),
      inReview: cur.in_review,
      inReviewDelta: dp(cur.in_review, pre.in_review),
      fundedCents,
      fundedCentsDelta: dp(fundedCents, fundedCentsPrior),
      monthlySubs,
      monthlyFunded,
      mix: mixWithPct,
    };
  }, []);

  // Y-axis tick ceiling so bars don't blow past the gridline. Rounded
  // up to a nice number above the actual max so the chart breathes.
  const subsMax = Math.max(...live.monthlySubs.map((d) => d.value), 4);
  const subsCeil = niceCeil(subsMax);
  const subsTicks = [
    subsCeil,
    Math.round(subsCeil * 0.75),
    Math.round(subsCeil * 0.5),
    Math.round(subsCeil * 0.25),
    0,
  ];
  const fundedCeil = niceCeil(Math.max(...live.monthlyFunded.map((d) => d.value), 100));
  const fundedTicks = [
    fundedCeil,
    Math.round(fundedCeil * 0.75),
    Math.round(fundedCeil * 0.5),
    Math.round(fundedCeil * 0.25),
    0,
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }, { label: 'Command Center' }]}
        title="Command Center"
        description="Real-time picture of merchants, applications, funding, and credit distribution."
      />
      <PageBody>
        {/* ── KPI grid (6 cards) ──
            Each card drills into /applications pre-filtered by the
            matching status, so an operator clicking 'Funded' lands
            on the funded apps list. /reports for $ totals where the
            apps list isn't the most useful pivot. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Kpi
            label="Submitted"
            value={live.submitted.toLocaleString()}
            delta={live.submittedDelta}
            href="/applications?status=submitted"
          />
          <Kpi
            label="Approved"
            value={live.approved.toLocaleString()}
            delta={live.approvedDelta}
            href="/applications?status=approved"
          />
          <Kpi
            label="Funded"
            value={live.funded.toLocaleString()}
            delta={live.fundedDelta}
            href="/applications?status=funded"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Kpi
            label="Total Funded"
            value={compactDollars(live.fundedCents)}
            delta={live.fundedCentsDelta}
            icon={<DollarIcon size={14} />}
            href="/reports"
          />
          <Kpi
            label="Declined"
            value={live.declined.toLocaleString()}
            delta={live.declinedDelta}
            icon={<XIcon size={14} />}
            href="/applications?status=declined"
          />
          <Kpi
            label="In Review"
            value={live.inReview.toLocaleString()}
            delta={live.inReviewDelta}
            icon={<ClockIcon size={14} />}
            href="/applications?status=in_review"
          />
        </div>

        {/* ── 3-up chart row ──
            Each chart has a "View →" link in the top-right to the
            relevant deep-view. Charts themselves keep their internal
            interactivity (tooltips, etc.) from Sprint H. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <ChartCard
            title="Monthly Submissions"
            subtitle="Application volume — last 12 months"
            href="/applications"
          >
            <BarChartGrey
              data={live.monthlySubs.map((d) => ({ label: d.label, value: d.value }))}
              yTicks={subsTicks}
              yFormat={(v) => v.toString()}
            />
          </ChartCard>
          <ChartCard
            title="Funded Volume"
            subtitle="Monthly funded amount — last 12 months"
            href="/reports"
          >
            <BarChartGrey
              data={live.monthlyFunded.map((d) => ({ label: d.label, value: d.value / 100 }))}
              yTicks={fundedTicks.map((v) => Math.round(v / 100))}
              yFormat={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
          </ChartCard>
          <ChartCard title="Credit Insights" href="/insights">
            <CreditDonut mix={live.mix} />
          </ChartCard>
        </div>

        {/* ── Partner Leaderboard ── */}
        <Card>
          <CardBody className="p-0">
            <div className="flex items-end justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-[15px] font-semibold text-fg">Partner Leaderboard</h2>
                <p className="text-[12px] text-fg-muted mt-0.5">Ranked by total funded volume</p>
              </div>
              <Link
                href="/partners"
                className="text-[12px] text-fg-secondary hover:text-fg flex items-center gap-1"
              >
                View all <ArrowRightIcon size={12} />
              </Link>
            </div>

            <ul className="divide-y divide-border">
              {leaderboard.map((row) => {
                const pct = (row.funded / maxFunded) * 100;
                return (
                  <li key={row.rank}>
                    <Link
                      href={`/control-panel/${row.partnerId}`}
                      className="grid grid-cols-12 items-center gap-4 px-5 py-4 hover:bg-bg-muted/30"
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex items-center gap-2 text-[13px]">
                        {row.rank === 1 ? (
                          <span className="text-fg">
                            <TrophyIcon size={16} />
                          </span>
                        ) : (
                          <span className="text-fg-muted font-medium w-4 text-center">
                            {row.rank}
                          </span>
                        )}
                      </div>
                      {/* Name + progress bar */}
                      <div className="col-span-7 min-w-0">
                        <div className="flex items-baseline justify-between gap-3 mb-1.5">
                          <p className="text-[14px] font-semibold text-fg truncate">{row.name}</p>
                          <p className="text-[14px] font-bold tabular-nums text-fg shrink-0">
                            {formatFunded(row.funded)}
                          </p>
                        </div>
                        <div className="h-1.5 rounded-full bg-bg-muted overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-[#0d1530]"
                            style={{ width: `${Math.max(8, pct)}%` }}
                          />
                        </div>
                      </div>
                      {/* 3 stat columns */}
                      <Stat n={row.apps} label="Apps" className="col-span-1" />
                      <Stat n={row.fundedCount} label="Funded" className="col-span-1" />
                      <Stat n={`${row.approval}%`} label="Approval" className="col-span-2" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}

// ── Small components ─────────────────────────────────────────────────

function Kpi({
  label,
  value,
  delta,
  icon,
  href,
}: {
  label: string;
  value: string;
  delta: number;
  icon?: React.ReactNode;
  /** Optional drill-in target. When set, the whole card becomes a
   *  link to the filtered view (e.g. /applications?status=funded). */
  href?: string;
}) {
  const positive = delta >= 0;
  const body = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">
          {label}
        </p>
        {icon && <span className="text-fg-muted">{icon}</span>}
      </div>
      <p className="mt-1 text-[20px] font-semibold tracking-tight text-fg leading-none">{value}</p>
      <p
        className={
          'mt-2 flex items-center gap-1 text-[12px] font-semibold ' +
          (positive ? 'text-fg' : 'text-fg-muted')
        }
      >
        {positive ? <TrendUpIcon size={12} /> : <TrendDownIcon size={12} />}
        {positive ? '+' : ''}
        {delta}%
      </p>
    </>
  );
  const base = 'rounded-xl border border-border bg-bg-elevated px-5 py-4 block transition-colors';
  if (href) {
    return (
      <Link
        href={href}
        className={
          base +
          ' hover:border-border-strong hover:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
        }
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}

function ChartCard({
  title,
  subtitle,
  children,
  href,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Optional drill-in target — wraps the title row in a "View →"
   *  link without making the whole chart area clickable (charts have
   *  their own interactivity from Sprint H tooltips). */
  href?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated">
      <div className="px-5 pt-5 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
          {subtitle && <p className="text-[12px] text-fg-muted mt-0.5">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="text-[12px] text-fg-secondary hover:text-fg flex items-center gap-1 shrink-0"
          >
            View <ArrowRightIcon size={12} />
          </Link>
        )}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

function BarChartGrey({
  data,
  yTicks,
  yFormat,
}: {
  data: Array<{ label: string; value: number }>;
  yTicks: number[];
  yFormat: (v: number) => string;
}) {
  const max = Math.max(...yTicks, ...data.map((d) => d.value));
  const chartH = 220;
  return (
    <div className="relative">
      <div className="flex">
        {/* Y-axis labels */}
        <div
          className="w-12 flex flex-col justify-between text-[10px] text-fg-muted py-1"
          style={{ height: chartH }}
        >
          {yTicks.map((y) => (
            <div key={y}>{yFormat(y)}</div>
          ))}
        </div>

        {/* Bars + grid */}
        <div className="flex-1 relative" style={{ height: chartH }}>
          {/* Horizontal grid */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {yTicks.map((y) => (
              <div key={y} className="border-t border-dashed border-border" />
            ))}
          </div>
          {/* Bars */}
          <div className="absolute inset-0 flex items-end justify-around gap-2 px-2">
            {data.map((d) => {
              const h = max === 0 ? 0 : (d.value / max) * (chartH - 8);
              return (
                <div key={d.label} className="flex-1 max-w-[28px] flex flex-col items-center">
                  <div className="w-full rounded-t-sm bg-slate-300/80" style={{ height: h }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex pl-12 pt-2">
        <div className="flex-1 flex justify-around gap-2 px-2 text-[11px] text-fg-muted">
          {data.map((d) => (
            <div key={d.label} className="flex-1 max-w-[28px] text-center">
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreditDonut({
  mix,
}: {
  mix: Array<{ name: CreditTier; range: string; count: number; pct: number }>;
}) {
  const rows = mix.map((m) => ({
    name: m.name,
    range: CREDIT_TIER_RANGE_LABEL[m.name],
    pct: m.pct,
    count: m.count,
    color: CREDIT_TIER_COLOURS[m.name],
  }));
  const total = rows.reduce((s, c) => s + c.pct, 0) || 1;
  const totalCount = rows.reduce((s, c) => s + c.count, 0);
  const center = 75;
  let cum = 0;
  const segments = rows.map((c) => {
    const start = (cum / total) * Math.PI * 2 - Math.PI / 2;
    cum += c.pct;
    const end = (cum / total) * Math.PI * 2 - Math.PI / 2;
    return { ...c, start, end };
  });
  const arc = (cx: number, cy: number, r: number, a1: number, a2: number, w: number) => {
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const ri = r - w;
    const xi1 = cx + ri * Math.cos(a2);
    const yi1 = cy + ri * Math.sin(a2);
    const xi2 = cx + ri * Math.cos(a1);
    const yi2 = cy + ri * Math.sin(a1);
    const large = a2 - a1 > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${ri} ${ri} 0 ${large} 0 ${xi2} ${yi2} Z`;
  };

  return (
    <div>
      <div className="flex justify-center py-3">
        <svg width="160" height="160" viewBox="0 0 150 150">
          <circle cx={center} cy={center} r="58" fill="none" stroke="#f1f5f9" strokeWidth="22" />
          {segments.map((s, i) => (
            <path key={i} d={arc(center, center, 58, s.start, s.end, 22)} fill={s.color} />
          ))}
          <text
            x={center}
            y={center + 7}
            textAnchor="middle"
            className="fill-fg"
            style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            {totalCount}
          </text>
        </svg>
      </div>

      {/* Table */}
      <div className="grid grid-cols-12 px-1 pb-2 text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
        <span className="col-span-6">Category</span>
        <span className="col-span-4 text-right">FICO Range</span>
        <span className="col-span-2 text-right">%</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((c) => (
          <li key={c.name} className="grid grid-cols-12 items-center text-[13px]">
            <span className="col-span-6 flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="text-fg truncate">{c.name}</span>
            </span>
            <span className="col-span-4 text-right text-fg-secondary tabular-nums">{c.range}</span>
            <span className="col-span-2 text-right text-fg font-semibold tabular-nums">
              {c.pct}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ n, label, className }: { n: number | string; label: string; className?: string }) {
  return (
    <div className={'text-right ' + (className ?? '')}>
      <div className="text-[15px] font-bold text-fg tabular-nums leading-none">{n}</div>
      <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold mt-1">
        {label}
      </div>
    </div>
  );
}

/** Compact dollar formatter for the leaderboard ($4.2M / $890K). */
function formatFunded(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}K`;
  return `$${dollars}`;
}

/** Compact KPI dollar formatter — $1.2M / $340K / $87 — for the
 *  Total Funded card. Same shape as formatFunded but rounds harder
 *  so the KPI doesn't trail decimals. */
function compactDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}K`;
  return `$${Math.round(dollars).toLocaleString()}`;
}

/** Round a number up to a "nice" axis ceiling (1, 2, 5 × 10^n). */
function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const base = Math.pow(10, exp);
  const frac = n / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * base;
}
