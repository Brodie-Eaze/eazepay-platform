'use client';
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

// ── Local mock helpers ──────────────────────────────────────────────
const monthlySubmissions: Array<{ label: string; value: number }> = [
  { label: 'Dec', value: 250 },
  { label: 'Jan', value: 810 },
  { label: 'Feb', value: 1000 },
  { label: 'Mar', value: 630 },
  { label: 'Apr', value: 0 },
  { label: 'May', value: 0 },
];

const fundedVolume: Array<{ label: string; value: number }> = [
  { label: 'Dec', value: 7500 },
  { label: 'Jan', value: 17000 },
  { label: 'Feb', value: 22000 },
  { label: 'Mar', value: 4000 },
  { label: 'Apr', value: 0 },
  { label: 'May', value: 0 },
];

// Donut palette — navy → light grey ramp. Matches the rest of the
// platform's navy + grey + light grey colour discipline; no accent
// indigo / violet / green outside of explicit semantic signals
// (green = up delta, red = down delta).
const creditInsights = [
  { name: 'Prime', range: '700–850', pct: 18, color: '#0d1530' }, // navy
  { name: 'NearPrime', range: '640–699', pct: 14, color: '#1e3a8a' }, // deep navy-blue
  { name: 'Subprime', range: '580–639', pct: 6, color: '#94a3b8' }, // slate-400
  { name: 'DeepSubprime', range: '300–579', pct: 6, color: '#cbd5e1' }, // slate-300
];

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
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }, { label: 'Command Center' }]}
        title="Command Center"
        description="Real-time picture of merchants, applications, funding, and credit distribution."
      />
      <PageBody>
        {/* ── KPI grid (6 cards) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Kpi label="Submitted" value="478" delta={12} />
          <Kpi label="Approved" value="70" delta={5} />
          <Kpi label="Funded" value="68" delta={8} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Kpi
            label="Total Funded"
            value={formatCurrencyCents(masterKpis.totalFundedCents).replace(',000,000', 'M')}
            delta={22}
            icon={<DollarIcon size={14} />}
          />
          <Kpi label="Declined" value="12" delta={-15} icon={<XIcon size={14} />} />
          <Kpi label="In Review" value="8" delta={10} icon={<ClockIcon size={14} />} />
        </div>

        {/* ── 3-up chart row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <ChartCard title="Monthly Submissions" subtitle="Application volume over time">
            <BarChartGrey
              data={monthlySubmissions}
              yTicks={[1000, 750, 500, 250, 0]}
              yFormat={(v) => v.toString()}
            />
          </ChartCard>
          <ChartCard title="Funded Volume" subtitle="Monthly funded amount">
            <BarChartGrey
              data={fundedVolume}
              yTicks={[22000, 16500, 11000, 5500, 0]}
              yFormat={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
          </ChartCard>
          <ChartCard title="Credit Insights">
            <CreditDonut />
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
}: {
  label: string;
  value: string;
  delta: number;
  icon?: React.ReactNode;
}) {
  const positive = delta >= 0;
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-5 py-4">
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
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated">
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {subtitle && <p className="text-[12px] text-fg-muted mt-0.5">{subtitle}</p>}
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

function CreditDonut() {
  const total = creditInsights.reduce((s, c) => s + c.pct, 0);
  const center = 75;
  let cum = 0;
  const segments = creditInsights.map((c) => {
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
            35
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
        {creditInsights.map((c) => (
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
