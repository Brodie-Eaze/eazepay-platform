'use client';
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  Button as _Button,
  StatusPill,
  Money,
  DocIcon,
  ClockIcon,
  ExternalIcon,
  ArrowRightIcon,
  CheckIcon,
  XIcon,
  AlertIcon,
  TrendUpIcon,
  TrendDownIcon,
  EmptyState,
  Filter,
  LiveIndicator,
  TimeRangeSelector,
  TIME_RANGES,
  type ButtonVariant,
  type ButtonSize,
  type StatusTone,
  type FilterOption,
  type TimeRange,
} from '@eazepay/ui/web';
import { BRAND_CODES, BRAND_LABEL, type Brand } from '@eazepay/shared-types';
import { formatBps } from '@eazepay/shared-utils/format-bps';
import { formatCurrencyCents } from '@eazepay/shared-utils/format-currency';
import { pluralize } from '@eazepay/shared-utils/pluralize';

/* Locally-typed Button — see control-panel/page.tsx for rationale. */
type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;
import { partners as MASTER_PARTNERS } from '../../lib/master-data';

/**
 * Reports — operational analytics console. Left rail of saved reports,
 * main canvas with KPIs + chart + sortable/paginated table + export + a
 * partner-portal cross-link, bottom rail of saved views, settings tab for
 * scheduled reports.
 *
 * All numbers synthesise from the master data + a deterministic hash so
 * brand filters meaningfully change the figures (MedPay smaller, TradePay
 * larger, CoachPay mid).
 */

type ReportId =
  | 'finperf'
  | 'lender'
  | 'funnel'
  | 'payouts'
  | 'audit'
  | 'compliance'
  | 'leaderboard'
  | 'cohort'
  | 'echo'
  | 'risk';

type BrandFilter = 'All' | 'MedPay' | 'TradePay' | 'CoachPay';
type DateRange = '7d' | '30d' | '90d' | 'qtd' | 'ytd';

/* Bridge maps between the legacy PascalCase BrandFilter (consumed by
 * every Report* sub-component on this page) and the canonical
 * lowercase Brand from @eazepay/shared-types that the new Filter
 * primitive emits. Builder R owns the report-internals refactor —
 * conversion happens only at the filter boundary so we don't bleed
 * scope. */
const LEGACY_BRAND_TO_CANONICAL: Record<Exclude<BrandFilter, 'All'>, Brand> = {
  MedPay: 'medpay',
  TradePay: 'tradepay',
  CoachPay: 'coachpay',
};
const CANONICAL_BRAND_TO_LEGACY: Record<Brand, Exclude<BrandFilter, 'All'>> = {
  medpay: 'MedPay',
  tradepay: 'TradePay',
  coachpay: 'CoachPay',
};

interface ReportDef {
  id: ReportId;
  title: string;
  desc: string;
  category: 'Financial' | 'Lender' | 'Operations' | 'Compliance' | 'Risk';
}

const REPORTS: ReportDef[] = [
  {
    id: 'finperf',
    title: 'Financing Performance',
    desc: 'Funded volume by month × brand',
    category: 'Financial',
  },
  {
    id: 'lender',
    title: 'Lender Win/Loss',
    desc: 'Approval rate per lender + top decline reasons',
    category: 'Lender',
  },
  {
    id: 'funnel',
    title: 'Application Funnel',
    desc: 'Lead → pre-qual → KYC → decision → funded',
    category: 'Operations',
  },
  {
    id: 'payouts',
    title: 'Payout Schedule',
    desc: 'Upcoming, settled, and pending payouts',
    category: 'Financial',
  },
  {
    id: 'audit',
    title: 'Audit Trail',
    desc: 'Override events, manual unmasks, dual-control approvals',
    category: 'Compliance',
  },
  {
    id: 'compliance',
    title: 'Compliance Posture',
    desc: 'FCRA/ECOA reason mix, AAN latency, override sample',
    category: 'Compliance',
  },
  {
    id: 'leaderboard',
    title: 'Partner Leaderboard',
    desc: 'Top funded volume, approval, retention',
    category: 'Operations',
  },
  {
    id: 'cohort',
    title: 'Cohort Performance',
    desc: 'Vintage cohorts × delinquency triangle',
    category: 'Risk',
  },
  {
    id: 'echo',
    title: 'ECHO Attribution',
    desc: 'Pixel events fired vs. lead quality',
    category: 'Operations',
  },
  {
    id: 'risk',
    title: 'Risk Snapshot',
    desc: 'SENTRY composite scores + velocity flags',
    category: 'Risk',
  },
];

interface SavedView {
  id: string;
  name: string;
  reportId: ReportId;
  desc: string;
  partner?: string;
}
const PRESET_VIEWS: SavedView[] = [
  { id: 'v_1', name: 'Q2 funded — TradePay only', reportId: 'finperf', desc: 'TradePay · QTD' },
  {
    id: 'v_2',
    name: 'Helio Dental Group · funnel',
    reportId: 'funnel',
    desc: 'partner deep-dive',
    partner: 'p_helio',
  },
  { id: 'v_3', name: 'Lender win rate · last 90d', reportId: 'lender', desc: 'cross-brand · 90d' },
  { id: 'v_4', name: 'AAN delivery SLA monitor', reportId: 'compliance', desc: 'compliance · 30d' },
];

type Frequency = 'daily' | 'weekly' | 'monthly';
interface ScheduledReport {
  id: string;
  reportId: ReportId;
  frequency: Frequency;
  recipients: string;
  nextRun: string;
}
const INITIAL_SCHEDULES: ScheduledReport[] = [
  {
    id: 's_1',
    reportId: 'finperf',
    frequency: 'weekly',
    recipients: 'brodie@amalafinance.com.au, finance@eaze.test',
    nextRun: '2026-05-19',
  },
  {
    id: 's_2',
    reportId: 'compliance',
    frequency: 'monthly',
    recipients: 'compliance@eaze.internal',
    nextRun: '2026-06-01',
  },
];

/* ----------------------------------------------------------------------- */
/*  Synthesis — produces deterministic figures per (report, brand, partner) */
/* ----------------------------------------------------------------------- */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function rand(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
function brandMultiplier(brand: BrandFilter): number {
  switch (brand) {
    case 'MedPay':
      return 0.62;
    case 'TradePay':
      return 1.4;
    case 'CoachPay':
      return 0.95;
    default:
      return 1;
  }
}
function rangeMultiplier(r: DateRange): number {
  return r === '7d' ? 0.18 : r === '30d' ? 0.6 : r === '90d' ? 1.45 : r === 'qtd' ? 1.05 : 4.2;
}

/* ----------------------------------------------------------------------- */
/*  Page                                                                    */
/* ----------------------------------------------------------------------- */

export default function ReportsPage() {
  const [reportId, setReportId] = useState<ReportId>('finperf');
  const [brand, setBrand] = useState<BrandFilter>('All');
  const [range, setRange] = useState<DateRange>('30d');
  const [partner, setPartner] = useState<string>('all');
  const [showSchedules, setShowSchedules] = useState(false);
  const [schedules, setSchedules] = useState<ScheduledReport[]>(INITIAL_SCHEDULES);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const current = REPORTS.find((r) => r.id === reportId)!;
  const filteredReports = REPORTS.filter(
    (r) => !query || r.title.toLowerCase().includes(query.toLowerCase()),
  );

  /* Sprint H: canonical TimeRange surfaced in the header. The legacy
   * in-report `range` selector (qtd / ytd) lives in each report card; the
   * canonical bar drives URL `?range=` so reports.page URLs survive
   * sharing. We map (7d/30d/90d) directly to DateRange and fall back to
   * 30d for 12m / all (the in-report selector still owns the longer
   * windows). */
  const sp = useSearchParams();
  const router = useRouter();
  const tRangeFromUrl = (sp?.get('range') as TimeRange | null) ?? null;
  const tRange: TimeRange =
    tRangeFromUrl && (TIME_RANGES as readonly string[]).includes(tRangeFromUrl)
      ? tRangeFromUrl
      : '30d';
  const handleTRangeChange = useCallback(
    (next: TimeRange) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      params.set('range', next);
      router.replace(`?${params.toString()}`, { scroll: false });
      /* Mirror into the in-report selector for windows it supports. */
      if (next === '7d' || next === '30d' || next === '90d') setRange(next);
    },
    [router, sp],
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Analytics' }, { label: 'Reports' }]}
        title="Reports"
        description="Operational reporting across the partner network — financials, lender performance, compliance posture."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <LiveIndicator pulseKey={`${tRange}-${reportId}`} />
            <TimeRangeSelector value={tRange} onChange={handleTRangeChange} />
            <Button size="sm" variant="secondary" onClick={() => setShowSchedules((v) => !v)}>
              <ClockIcon size={12} aria-hidden />
              {showSchedules ? 'Hide schedules' : 'Scheduled reports'}
            </Button>
            <Button size="sm" variant="primary" onClick={() => flash('New report wizard opened')}>
              + New Report
            </Button>
          </div>
        }
      />

      <PageBody>
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT RAIL — Report Library */}
          <aside className="col-span-12 lg:col-span-3" aria-label="Report library">
            <Card>
              <div className="px-4 pt-3 pb-2 border-b border-border">
                <h2 className="text-[12px] font-semibold text-fg" id="report-library-heading">
                  Report Library
                </h2>
                <label className="block mt-2">
                  <span className="sr-only">Search reports</span>
                  <input
                    placeholder="Search reports…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search reports"
                    className="w-full h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong"
                  />
                </label>
              </div>
              <CardBody className="p-0">
                <ul className="py-1" role="listbox" aria-labelledby="report-library-heading">
                  {filteredReports.map((r) => (
                    <li key={r.id} role="option" aria-selected={reportId === r.id}>
                      <button
                        type="button"
                        onClick={() => setReportId(r.id)}
                        aria-pressed={reportId === r.id}
                        className={`w-full text-left px-4 py-2 border-l-2 transition-colors focus-visible:outline-none focus-visible:bg-bg-muted/50 focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-inset ${reportId === r.id ? 'border-accent bg-bg-muted/50' : 'border-transparent hover:bg-bg-muted/30'}`}
                      >
                        <p
                          className={`text-[12px] font-semibold ${reportId === r.id ? 'text-fg' : 'text-fg-secondary'}`}
                        >
                          {r.title}
                        </p>
                        <p className="text-[10px] text-fg-muted mt-0.5">{r.desc}</p>
                      </button>
                    </li>
                  ))}
                  {filteredReports.length === 0 && (
                    <li className="px-4 py-6 text-center text-[11px] text-fg-muted" role="status">
                      No reports match
                      {query && (
                        <>
                          {' '}
                          <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="text-accent font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
                          >
                            Clear search
                          </button>
                        </>
                      )}
                    </li>
                  )}
                </ul>
              </CardBody>
            </Card>

            {/* Bottom rail — Saved Views */}
            <div className="mt-3">
              <p
                className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted mb-2 px-1"
                id="saved-views-heading"
              >
                Saved views
              </p>
              <div
                className="grid grid-cols-1 gap-1.5"
                role="group"
                aria-labelledby="saved-views-heading"
              >
                {PRESET_VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setReportId(v.reportId);
                      if (v.partner) setPartner(v.partner);
                      flash(`Loaded view: ${v.name}`);
                    }}
                    aria-label={`Load view: ${v.name} (${v.desc})`}
                    className="text-left rounded-lg border border-border bg-bg-elevated px-3 py-2 hover:bg-bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    <p className="text-[12px] font-semibold text-fg truncate">{v.name}</p>
                    <p className="text-[10px] text-fg-muted">{v.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* MAIN CANVAS */}
          <main className="col-span-12 lg:col-span-9">
            {showSchedules ? (
              <ScheduledPanel
                schedules={schedules}
                onAdd={(s) => {
                  setSchedules((prev) => [...prev, s]);
                  flash('Schedule saved');
                }}
                onRemove={(id) => {
                  setSchedules((prev) => prev.filter((s) => s.id !== id));
                  flash('Schedule removed');
                }}
              />
            ) : (
              <ReportCanvas
                report={current}
                brand={brand}
                setBrand={setBrand}
                range={range}
                setRange={setRange}
                partner={partner}
                setPartner={setPartner}
                onExport={(fmt) => flash(`Export queued (${fmt})`)}
              />
            )}
          </main>
        </div>
      </PageBody>

      {toast && <Toast message={toast} />}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/*  Main canvas                                                             */
/* ----------------------------------------------------------------------- */

function ReportCanvas({
  report,
  brand,
  setBrand,
  range,
  setRange,
  partner,
  setPartner,
  onExport,
}: {
  report: ReportDef;
  brand: BrandFilter;
  setBrand: (b: BrandFilter) => void;
  range: DateRange;
  setRange: (r: DateRange) => void;
  partner: string;
  setPartner: (p: string) => void;
  onExport: (fmt: 'CSV' | 'PDF' | 'Email') => void;
}) {
  const selectedPartner = partner !== 'all' ? MASTER_PARTNERS.find((p) => p.id === partner) : null;
  const brandSlug =
    brand === 'MedPay'
      ? 'medpay'
      : brand === 'TradePay'
        ? 'tradepay'
        : brand === 'CoachPay'
          ? 'coachpay'
          : null;

  return (
    <div className="space-y-4">
      {/* Title + Filters */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              {report.title}
              <StatusPill tone="neutral">{report.category}</StatusPill>
            </span>
          }
          description={report.desc}
          action={
            <div
              className="flex items-center gap-1.5 flex-wrap"
              role="group"
              aria-label="Export options"
            >
              <button
                type="button"
                onClick={() => onExport('CSV')}
                aria-label="Export as CSV"
                className="min-h-[36px] px-2.5 inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated text-[11px] text-fg-secondary hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <DocIcon size={11} aria-hidden /> CSV
              </button>
              <button
                type="button"
                onClick={() => onExport('PDF')}
                aria-label="Export as PDF"
                className="min-h-[36px] px-2.5 inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated text-[11px] text-fg-secondary hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <DocIcon size={11} aria-hidden /> PDF
              </button>
              <button
                type="button"
                onClick={() => onExport('Email')}
                aria-label="Email this report"
                className="min-h-[36px] px-2.5 inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated text-[11px] text-fg-secondary hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <ClockIcon size={11} aria-hidden /> Email
              </button>
            </div>
          }
        />
        <CardBody>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              label="Range"
              value={range}
              onChange={(v) => setRange(v as DateRange)}
              options={[
                ['7d', 'Last 7 days'],
                ['30d', 'Last 30 days'],
                ['90d', 'Last 90 days'],
                ['qtd', 'QTD'],
                ['ytd', 'YTD'],
              ]}
            />
            <Filter<Brand>
              label="Brand"
              allLabel="All brands"
              value={brand === 'All' ? null : (LEGACY_BRAND_TO_CANONICAL[brand] ?? null)}
              onChange={(v) =>
                setBrand(v === null ? 'All' : (CANONICAL_BRAND_TO_LEGACY[v] as BrandFilter))
              }
              options={
                BRAND_CODES.map((b) => ({
                  value: b,
                  label: BRAND_LABEL[b],
                })) as FilterOption<Brand>[]
              }
            />
            <FilterChip
              label="Partner"
              value={partner}
              onChange={setPartner}
              options={[
                ['all', 'All partners'],
                ...MASTER_PARTNERS.map((p) => [p.id, p.legalName] as [string, string]),
              ]}
            />
            {selectedPartner && brandSlug && (
              <Link
                href={`/v/${brandSlug}/insights?partnerId=${selectedPartner.id}`}
                className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-accent hover:underline"
              >
                View on {selectedPartner.legalName}&apos;s portal <ExternalIcon size={11} />
              </Link>
            )}
            {selectedPartner && !brandSlug && (
              <Link
                href={`/control-panel/${selectedPartner.id}`}
                className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-accent hover:underline"
              >
                Open partner control page <ArrowRightIcon size={11} />
              </Link>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Body — each report renders its own KPI strip + chart + table. */}
      {report.id === 'finperf' && (
        <FinancingPerformanceReport brand={brand} range={range} partner={partner} />
      )}
      {report.id === 'lender' && <LenderWinLossReport brand={brand} range={range} />}
      {report.id === 'funnel' && <FunnelReport brand={brand} range={range} partner={partner} />}
      {report.id === 'payouts' && <PayoutScheduleReport brand={brand} range={range} />}
      {report.id === 'audit' && <AuditTrailReport range={range} />}
      {report.id === 'compliance' && <ComplianceReport brand={brand} range={range} />}
      {report.id === 'leaderboard' && <LeaderboardReport brand={brand} />}
      {report.id === 'cohort' && <CohortReport brand={brand} />}
      {report.id === 'echo' && <EchoReport brand={brand} range={range} />}
      {report.id === 'risk' && <RiskReport brand={brand} />}
    </div>
  );
}

function FilterChip({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 h-10 rounded-lg border border-border bg-bg-elevated px-2.5 text-[12px] focus-within:border-border-strong focus-within:ring-2 focus-within:ring-border-focus/30">
      <span className="text-fg-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="bg-transparent outline-none text-fg font-medium pr-1 h-full"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ----------------------------------------------------------------------- */
/*  Report bodies                                                           */
/* ----------------------------------------------------------------------- */

function FinancingPerformanceReport({
  brand,
  range,
  partner,
}: {
  brand: BrandFilter;
  range: DateRange;
  partner: string;
}) {
  const mult = brandMultiplier(brand) * rangeMultiplier(range);
  const partnerMult = partner === 'all' ? 1 : 0.18;
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const r = rand(hashStr(`finperf-${brand}-${range}-${partner}`));
  const data = months.map((m, i) => ({
    label: m,
    value: Math.floor((400 + r() * 700) * mult * partnerMult),
    medpay: Math.floor((150 + r() * 200) * mult * partnerMult),
    tradepay: Math.floor((200 + r() * 300) * mult * partnerMult),
    coachpay: Math.floor((80 + r() * 150) * mult * partnerMult),
  }));
  const totalFunded = data.reduce((s, d) => s + d.value, 0);
  const avgTicket = Math.floor((totalFunded * 100) / Math.max(1, data.length * 14));
  const yoy = Math.floor((r() - 0.4) * 60);

  // Table — top partners by funded volume in window.
  const tableRows = MASTER_PARTNERS.filter((p) => partner === 'all' || p.id === partner)
    .map((p) => {
      const r2 = rand(hashStr(p.id + brand + range));
      const fundedK = Math.floor(p.netCents / 100_000) * mult;
      return {
        partner: p.legalName,
        partnerId: p.id,
        apps: Math.max(1, Math.floor(p.fundedCount * mult * 2.4 * (0.5 + r2()))),
        funded: Math.max(1, Math.floor(p.fundedCount * mult * (0.5 + r2()))),
        volumeCents: Math.floor(fundedK * 100),
        avgTicketCents: Math.floor((fundedK * 100) / Math.max(1, p.fundedCount)),
        approvalRate: 38 + Math.floor(r2() * 42),
      };
    })
    .sort((a, b) => b.volumeCents - a.volumeCents);

  return (
    <>
      {/* Sprint H: top KPI strip — each tile drills into the underlying
          /applications view filtered to the report's brand + range. */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Kpi
          label="Funded volume"
          value={`$${(totalFunded / 1000).toFixed(1)}M`}
          delta={yoy}
          href={`/applications?status=funded&range=${range}`}
        />
        <Kpi
          label="Avg ticket"
          value={formatCurrencyCents(avgTicket)}
          href={`/applications?status=funded&range=${range}`}
        />
        <Kpi
          label="Funded apps"
          value={String(tableRows.reduce((s, r) => s + r.funded, 0))}
          href={`/applications?status=funded&range=${range}`}
        />
        <Kpi
          label="Approval rate"
          value={`${Math.floor(50 + r() * 22)}%`}
          delta={Math.floor(r() * 8) - 3}
          href={`/applications?status=approved&range=${range}`}
        />
        <Kpi
          label="Top partner"
          value={(tableRows[0]?.partner ?? '—').split(' ')[0] ?? '—'}
          hint="by volume"
          href={
            tableRows[0]?.partnerId
              ? `/control-panel/${encodeURIComponent(tableRows[0].partnerId)}`
              : '/control-panel'
          }
        />
      </div>

      <Card>
        <CardHeader title="Funded volume by month — stacked by brand" />
        <CardBody>
          <StackedBars
            data={data.map((d) => ({
              label: d.label,
              segments: [
                // Navy → light-grey ramp so the three brands read as
                // tonal layers, not three competing accent colours.
                { value: d.medpay, color: '#0d1530', label: 'MedPay' },
                { value: d.tradepay, color: '#475569', label: 'TradePay' },
                { value: d.coachpay, color: '#94a3b8', label: 'CoachPay' },
              ],
            }))}
          />
          <div className="flex gap-4 text-[11px] mt-3 px-2">
            <LegendSwatch color="#0d1530" label="MedPay" />
            <LegendSwatch color="#475569" label="TradePay" />
            <LegendSwatch color="#94a3b8" label="CoachPay" />
          </div>
        </CardBody>
      </Card>

      <ReportTable
        title={`Partner performance — ${pluralize(tableRows.length, 'partner')}`}
        columns={[
          {
            key: 'partner',
            label: 'Partner',
            render: (r: (typeof tableRows)[number]) => (
              <Link
                href={`/control-panel/${r.partnerId}`}
                className="font-medium text-fg hover:underline"
              >
                {r.partner}
              </Link>
            ),
          },
          {
            key: 'apps',
            label: 'Apps',
            align: 'right',
            render: (r: (typeof tableRows)[number]) => r.apps,
          },
          {
            key: 'funded',
            label: 'Funded',
            align: 'right',
            render: (r: (typeof tableRows)[number]) => r.funded,
          },
          {
            key: 'volumeCents',
            label: 'Volume',
            align: 'right',
            render: (r: (typeof tableRows)[number]) => <Money cents={r.volumeCents} noFractions />,
          },
          {
            key: 'avgTicketCents',
            label: 'Avg ticket',
            align: 'right',
            render: (r: (typeof tableRows)[number]) => (
              <Money cents={r.avgTicketCents} noFractions />
            ),
          },
          {
            key: 'approvalRate',
            label: 'Approval',
            align: 'right',
            render: (r: (typeof tableRows)[number]) => `${r.approvalRate}%`,
          },
        ]}
        rows={tableRows}
      />
    </>
  );
}

function LenderWinLossReport({ brand, range }: { brand: BrandFilter; range: DateRange }) {
  const mult = brandMultiplier(brand) * rangeMultiplier(range);
  const r = rand(hashStr(`lender-${brand}-${range}`));
  const lenders = [
    'CapitalOne',
    'CrossRiver',
    'WebBank',
    'LeadBank',
    'FinWise',
    'LendFi',
    'BlueVine',
    'Affirm',
    'Helia Medical',
    'SageHeal',
    'Orion Capital',
    'Kestrel',
    'Atlas Career Cap',
    'ClearPath',
    'Summit Premier',
  ];
  const rows = lenders
    .map((name) => {
      const apps = Math.max(8, Math.floor((50 + r() * 380) * mult));
      const approvals = Math.floor(apps * (0.3 + r() * 0.55));
      return {
        lender: name,
        apps,
        approvals,
        declines: apps - approvals,
        approvalRate: Math.round((approvals / Math.max(1, apps)) * 100),
        avgAprBps: 700 + Math.floor(r() * 1800),
        volumeCents: approvals * (8_000_00 + Math.floor(r() * 30_000_00)),
      };
    })
    .sort((a, b) => b.volumeCents - a.volumeCents);

  const declineReasons = [
    { label: 'DTI > 50%', pct: 28 },
    { label: 'Insufficient income', pct: 22 },
    { label: 'Recent delinquency', pct: 18 },
    { label: 'Thin file', pct: 11 },
    { label: 'KYC mismatch', pct: 9 },
    { label: 'High utilization', pct: 7 },
    { label: 'Other', pct: 5 },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Lenders in window" value={String(rows.length)} />
        <Kpi
          label="Weighted approval"
          value={`${Math.round(rows.reduce((s, r) => s + r.approvalRate, 0) / rows.length)}%`}
        />
        <Kpi label="Top lender" value={rows[0]?.lender ?? '—'} hint="by funded volume" />
        <Kpi
          label="Total funded vol."
          value={<Money cents={rows.reduce((s, r) => s + r.volumeCents, 0)} compact />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Approval rate by lender" />
          <CardBody>
            <HorizontalBars
              data={rows.slice(0, 10).map((r) => ({
                label: r.lender,
                value: r.approvalRate,
                sub: `${r.approvals}/${r.apps}`,
              }))}
              maxLabel="100%"
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top decline reasons" />
          <CardBody>
            <ul className="space-y-2">
              {declineReasons.map((d) => (
                <li key={d.label}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-fg-secondary">{d.label}</span>
                    <span className="text-fg-muted tabular-nums">{d.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-muted overflow-hidden">
                    <div className="h-full bg-danger/70" style={{ width: `${d.pct * 3}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <ReportTable
        title={`Lender performance — ${pluralize(rows.length, 'lender')}`}
        columns={[
          {
            key: 'lender',
            label: 'Lender',
            render: (r: (typeof rows)[number]) => (
              <span className="font-medium text-fg">{r.lender}</span>
            ),
          },
          {
            key: 'apps',
            label: 'Apps',
            align: 'right',
            render: (r: (typeof rows)[number]) => r.apps,
          },
          {
            key: 'approvals',
            label: 'Approved',
            align: 'right',
            render: (r: (typeof rows)[number]) => r.approvals,
          },
          {
            key: 'declines',
            label: 'Declined',
            align: 'right',
            render: (r: (typeof rows)[number]) => (
              <span className="text-fg-muted">{r.declines}</span>
            ),
          },
          {
            key: 'approvalRate',
            label: 'Approval %',
            align: 'right',
            render: (r: (typeof rows)[number]) => (
              <span
                className={
                  r.approvalRate >= 60
                    ? 'text-success'
                    : r.approvalRate < 40
                      ? 'text-danger'
                      : 'text-fg'
                }
              >
                {r.approvalRate}%
              </span>
            ),
          },
          {
            key: 'avgAprBps',
            label: 'Avg APR',
            align: 'right',
            render: (r: (typeof rows)[number]) => formatBps(r.avgAprBps),
          },
          {
            key: 'volumeCents',
            label: 'Volume',
            align: 'right',
            render: (r: (typeof rows)[number]) => <Money cents={r.volumeCents} compact />,
          },
        ]}
        rows={rows}
      />
    </>
  );
}

function FunnelReport({
  brand,
  range,
  partner,
}: {
  brand: BrandFilter;
  range: DateRange;
  partner: string;
}) {
  const mult = brandMultiplier(brand) * rangeMultiplier(range);
  const partnerMult = partner === 'all' ? 1 : 0.18;
  const top = Math.floor(4200 * mult * partnerMult);
  const steps = [
    { label: 'Leads', value: top },
    { label: 'Pre-qual passed', value: Math.floor(top * 0.86) },
    { label: 'KYC verified', value: Math.floor(top * 0.81) },
    { label: 'Decisioned', value: Math.floor(top * 0.78) },
    { label: 'Approved', value: Math.floor(top * 0.48) },
    { label: 'Funded', value: Math.floor(top * 0.44) },
  ];
  const stages = steps.map((s, i) => ({
    ...s,
    convPct: i === 0 ? 100 : Math.round((s.value / steps[i - 1]!.value) * 100),
    dropPct:
      i === 0 ? 0 : Math.round(((steps[i - 1]!.value - s.value) / steps[i - 1]!.value) * 100),
  }));

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Top of funnel" value={top.toLocaleString()} />
        <Kpi
          label="End-to-end conv."
          value={`${Math.round((stages[stages.length - 1]!.value / top) * 100)}%`}
        />
        <Kpi label="Biggest drop" value={largestDropLabel(stages)} hint="largest stage loss" />
        <Kpi label="Median time-to-fund" value="2h 14m" hint="approval → funded" />
      </div>

      <Card>
        <CardHeader title="Funnel — leads through funded" />
        <CardBody>
          <FunnelSVG stages={stages} />
        </CardBody>
      </Card>

      <ReportTable
        title="Stage performance"
        columns={[
          {
            key: 'label',
            label: 'Stage',
            render: (r: (typeof stages)[number]) => (
              <span className="font-medium text-fg">{r.label}</span>
            ),
          },
          {
            key: 'value',
            label: 'Volume',
            align: 'right',
            render: (r: (typeof stages)[number]) => r.value.toLocaleString(),
          },
          {
            key: 'convPct',
            label: 'Stage conv.',
            align: 'right',
            render: (r: (typeof stages)[number]) => `${r.convPct}%`,
          },
          {
            key: 'dropPct',
            label: 'Drop',
            align: 'right',
            render: (r: (typeof stages)[number]) => (
              <span className={r.dropPct > 30 ? 'text-danger' : 'text-fg-muted'}>{r.dropPct}%</span>
            ),
          },
        ]}
        rows={stages}
      />
    </>
  );
}

function PayoutScheduleReport({ brand, range }: { brand: BrandFilter; range: DateRange }) {
  const mult = brandMultiplier(brand) * rangeMultiplier(range);
  const r = rand(hashStr(`payouts-${brand}-${range}`));
  const rows = MASTER_PARTNERS.flatMap((p, idx) => {
    return Array.from({ length: 3 }, (_, j) => {
      const gross = Math.floor((p.netCents / 6) * mult * (0.5 + r()));
      const fee = Math.floor(gross * 0.022);
      const d = new Date();
      d.setDate(d.getDate() + (j - 1) * 7);
      return {
        id: `po_${p.id}_${j}`,
        partner: p.legalName,
        partnerId: p.id,
        date: d.toISOString().slice(0, 10),
        grossCents: gross,
        feeCents: fee,
        netCents: gross - fee,
        status: (j === 0 ? 'pending' : j === 1 ? 'settled' : 'paid') as
          | 'pending'
          | 'settled'
          | 'paid',
      };
    });
  });
  const totalPending = rows
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + r.netCents, 0);
  const totalSettled = rows
    .filter((r) => r.status === 'settled')
    .reduce((s, r) => s + r.netCents, 0);
  const totalPaid = rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.netCents, 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Upcoming (next 7d)" value={<Money cents={totalPending} compact />} />
        <Kpi label="Settled this period" value={<Money cents={totalSettled} compact />} />
        <Kpi label="Paid out" value={<Money cents={totalPaid} compact />} />
        <Kpi label="Cycles" value={String(rows.length)} />
      </div>
      <ReportTable
        title={`Payout schedule — ${rows.length} cycles`}
        columns={[
          {
            key: 'partner',
            label: 'Partner',
            render: (r: (typeof rows)[number]) => (
              <Link
                href={`/payouts/${r.partnerId}`}
                className="font-medium text-fg hover:underline"
              >
                {r.partner}
              </Link>
            ),
          },
          { key: 'date', label: 'Date', render: (r: (typeof rows)[number]) => r.date },
          {
            key: 'grossCents',
            label: 'Gross',
            align: 'right',
            render: (r: (typeof rows)[number]) => <Money cents={r.grossCents} />,
          },
          {
            key: 'feeCents',
            label: 'Fee',
            align: 'right',
            render: (r: (typeof rows)[number]) => (
              <span className="text-fg-muted">
                <Money cents={r.feeCents} />
              </span>
            ),
          },
          {
            key: 'netCents',
            label: 'Net',
            align: 'right',
            render: (r: (typeof rows)[number]) => (
              <span className="font-semibold">
                <Money cents={r.netCents} />
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r: (typeof rows)[number]) => (
              <StatusPill
                tone={r.status === 'paid' ? 'success' : r.status === 'settled' ? 'info' : 'warning'}
              >
                {r.status}
              </StatusPill>
            ),
          },
        ]}
        rows={rows}
      />
    </>
  );
}

function AuditTrailReport({ range }: { range: DateRange }) {
  const mult = rangeMultiplier(range);
  const r = rand(hashStr(`audit-${range}`));
  const events = [
    'Override added to PartnerLenderAccess',
    'Manual PII unmask (SSN last4)',
    'Dual-control approval for refund',
    'Master operator impersonated partner',
    'API key rotated',
    'Webhook secret revealed',
    'Bulk export — applications CSV',
    'Lender globally toggled off',
    'Marketplace re-sync forced',
    'Compliance hold lifted',
    'AAN re-sent to customer',
    'Settings change: payout schedule',
  ];
  const rows = Array.from({ length: Math.max(20, Math.floor(20 * mult)) }, (_, i) => {
    const evt = events[Math.floor(r() * events.length)] ?? events[0]!;
    return {
      id: `aud_${i}`,
      ts: new Date(Date.now() - i * 1000 * 60 * 60 * Math.ceil(r() * 6)).toISOString(),
      event: evt,
      actor:
        ['brodie@amalafinance.com.au', 'compliance@eaze.internal', 'risk@eaze.internal'][
          Math.floor(r() * 3)
        ] ?? 'system',
      target: MASTER_PARTNERS[Math.floor(r() * MASTER_PARTNERS.length)]!.legalName,
      severity: (['info', 'warning', 'critical'] as const)[Math.floor(r() * 3)] ?? 'info',
    };
  });

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Audited events" value={String(rows.length)} />
        <Kpi
          label="Critical"
          value={String(rows.filter((r) => r.severity === 'critical').length)}
          hint="last window"
        />
        <Kpi
          label="Manual unmasks"
          value={String(rows.filter((r) => r.event.includes('unmask')).length)}
        />
        <Kpi label="Distinct actors" value={String(new Set(rows.map((r) => r.actor)).size)} />
      </div>
      <ReportTable
        title="Audit log"
        columns={[
          {
            key: 'ts',
            label: 'Timestamp',
            render: (r: (typeof rows)[number]) => (
              <span className="font-mono text-[11px] text-fg-muted">
                {new Date(r.ts).toISOString().replace('T', ' ').slice(0, 19)}
              </span>
            ),
          },
          {
            key: 'event',
            label: 'Event',
            render: (r: (typeof rows)[number]) => (
              <span className="font-medium text-fg">{r.event}</span>
            ),
          },
          {
            key: 'actor',
            label: 'Actor',
            render: (r: (typeof rows)[number]) => (
              <span className="text-fg-secondary">{r.actor}</span>
            ),
          },
          {
            key: 'target',
            label: 'Target',
            render: (r: (typeof rows)[number]) => <span className="text-fg-muted">{r.target}</span>,
          },
          {
            key: 'severity',
            label: 'Severity',
            render: (r: (typeof rows)[number]) => (
              <StatusPill
                tone={
                  r.severity === 'critical'
                    ? 'danger'
                    : r.severity === 'warning'
                      ? 'warning'
                      : 'info'
                }
              >
                {r.severity}
              </StatusPill>
            ),
          },
        ]}
        rows={rows}
      />
    </>
  );
}

function ComplianceReport({ brand, range }: { brand: BrandFilter; range: DateRange }) {
  const mult = brandMultiplier(brand) * rangeMultiplier(range);
  const r = rand(hashStr(`compliance-${brand}-${range}`));
  const reasons = [
    { code: 'DTI', label: 'Debt-to-income ratio', count: Math.floor(180 * mult) },
    { code: 'INC', label: 'Insufficient income', count: Math.floor(142 * mult) },
    { code: 'DEL', label: 'Recent delinquency', count: Math.floor(98 * mult) },
    { code: 'THIN', label: 'Thin / no file', count: Math.floor(68 * mult) },
    { code: 'KYC', label: 'KYC mismatch', count: Math.floor(54 * mult) },
    { code: 'PUB', label: 'Public record', count: Math.floor(36 * mult) },
    { code: 'UTIL', label: 'High utilization', count: Math.floor(42 * mult) },
  ];
  const total = reasons.reduce((s, x) => s + x.count, 0);
  const aanLatency = [
    { p: 'p50', mins: 4 + Math.floor(r() * 4) },
    { p: 'p90', mins: 14 + Math.floor(r() * 8) },
    { p: 'p99', mins: 38 + Math.floor(r() * 22) },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Declined apps" value={total.toLocaleString()} />
        <Kpi
          label="AAN p99 latency"
          value={`${aanLatency[2]?.mins ?? 0}m`}
          hint="SLA: 30 days"
          tone="success"
        />
        <Kpi label="Override sample" value="100% audited" tone="success" />
        <Kpi label="Compliance flags" value={String(Math.floor(r() * 6))} hint="open this period" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader title="FCRA/ECOA decline reason mix" />
          <CardBody>
            <HorizontalBars
              data={reasons.map((r) => ({
                label: `${r.code} — ${r.label}`,
                value: Math.round((r.count / total) * 100),
                sub: String(r.count),
              }))}
              maxLabel="100%"
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Adverse-action notice latency" />
          <CardBody>
            <ul className="space-y-3">
              {aanLatency.map((p) => (
                <li key={p.p}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="font-mono text-fg-secondary">{p.p}</span>
                    <span className="font-bold tabular-nums">{p.mins}m</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-muted overflow-hidden">
                    <div
                      className={`h-full ${p.mins < 30 ? 'bg-success' : 'bg-warning'}`}
                      style={{ width: `${Math.min(100, p.mins * 1.5)}%` }}
                    />
                  </div>
                </li>
              ))}
              <li className="text-[10px] text-fg-muted pt-2 border-t border-border">
                Regulation B: AAN must be delivered within 30 days. Internal SLA: under 1 hour.
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>

      <ReportTable
        title="Decline reasons — full breakdown"
        columns={[
          {
            key: 'code',
            label: 'Code',
            render: (r: (typeof reasons)[number]) => (
              <span className="font-mono text-[11px]">{r.code}</span>
            ),
          },
          {
            key: 'label',
            label: 'Reason',
            render: (r: (typeof reasons)[number]) => <span className="text-fg">{r.label}</span>,
          },
          {
            key: 'count',
            label: 'Count',
            align: 'right',
            render: (r: (typeof reasons)[number]) => r.count.toLocaleString(),
          },
          {
            key: 'pct',
            label: 'Share',
            align: 'right',
            render: (r: (typeof reasons)[number]) => `${Math.round((r.count / total) * 100)}%`,
          },
        ]}
        rows={reasons}
      />
    </>
  );
}

function LeaderboardReport({ brand }: { brand: BrandFilter }) {
  const mult = brandMultiplier(brand);
  const r = rand(hashStr(`lb-${brand}`));
  const rows = MASTER_PARTNERS.map((p) => {
    return {
      partnerId: p.id,
      partner: p.legalName,
      volumeCents: Math.floor(p.netCents * mult * (0.7 + r() * 0.6)),
      apps: Math.floor(p.fundedCount * 2.4 * mult),
      funded: Math.floor(p.fundedCount * mult),
      approvalRate: 40 + Math.floor(r() * 40),
      retention: 70 + Math.floor(r() * 28),
    };
  }).sort((a, b) => b.volumeCents - a.volumeCents);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Top partner" value={(rows[0]?.partner ?? '—').split(' ')[0] ?? '—'} />
        <Kpi label="Top funded vol." value={<Money cents={rows[0]?.volumeCents ?? 0} compact />} />
        <Kpi label="Best approval" value={`${Math.max(...rows.map((r) => r.approvalRate))}%`} />
        <Kpi label="Best retention" value={`${Math.max(...rows.map((r) => r.retention))}%`} />
      </div>
      <ReportTable
        title={`Partner leaderboard — ${rows.length}`}
        columns={[
          {
            key: 'rank',
            label: '#',
            render: (_r: (typeof rows)[number], i: number) => (
              <span className="font-bold tabular-nums">{i + 1}</span>
            ),
            align: 'right',
          },
          {
            key: 'partner',
            label: 'Partner',
            render: (r: (typeof rows)[number]) => (
              <Link
                href={`/control-panel/${r.partnerId}`}
                className="font-medium text-fg hover:underline"
              >
                {r.partner}
              </Link>
            ),
          },
          {
            key: 'apps',
            label: 'Apps',
            align: 'right',
            render: (r: (typeof rows)[number]) => r.apps,
          },
          {
            key: 'funded',
            label: 'Funded',
            align: 'right',
            render: (r: (typeof rows)[number]) => r.funded,
          },
          {
            key: 'volumeCents',
            label: 'Volume',
            align: 'right',
            render: (r: (typeof rows)[number]) => <Money cents={r.volumeCents} compact />,
          },
          {
            key: 'approvalRate',
            label: 'Approval %',
            align: 'right',
            render: (r: (typeof rows)[number]) => `${r.approvalRate}%`,
          },
          {
            key: 'retention',
            label: 'Retention %',
            align: 'right',
            render: (r: (typeof rows)[number]) => `${r.retention}%`,
          },
        ]}
        rows={rows}
      />
    </>
  );
}

function CohortReport({ brand }: { brand: BrandFilter }) {
  const r = rand(hashStr(`cohort-${brand}`));
  const cohorts = ['2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2'];
  const matrix = cohorts.map((c, i) => {
    const cells = Array.from({ length: 5 }, (_, j) => {
      if (j > i + 1) return null;
      const base = 0.4 + j * 0.6 + r() * 0.4;
      return Math.min(8, Number(base.toFixed(2)));
    });
    return { cohort: c, cells };
  });
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Vintage 2025-Q3 30+ dpd" value="2.3%" hint="at month 12" tone="success" />
        <Kpi label="Vintage 2026-Q1 30+ dpd" value="1.8%" hint="at month 3" tone="success" />
        <Kpi label="Net charge-off (ytd)" value="0.4%" />
        <Kpi label="Reserves" value="2.1%" hint="of book" />
      </div>
      <Card>
        <CardHeader title="Delinquency triangle — % 30+dpd by months on book" />
        <CardBody>
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Delinquency triangle"
            tabIndex={0}
          >
            <table className="text-[11px] w-full min-w-[480px] border-collapse">
              <caption className="sr-only">
                Delinquency triangle — 30+ days past due percentages by cohort vintage across months
                on book.
              </caption>
              <thead className="bg-bg-muted/40">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-1.5 text-left font-semibold text-fg-muted uppercase text-[10px] tracking-wider"
                  >
                    Cohort
                  </th>
                  {[0, 3, 6, 9, 12].map((m) => (
                    <th
                      key={m}
                      scope="col"
                      className="px-3 py-1.5 text-right font-semibold text-fg-muted uppercase text-[10px] tracking-wider"
                    >
                      M+{m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.cohort} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 font-mono font-medium text-fg text-left">
                      {row.cohort}
                    </th>
                    {row.cells.map((c, i) => (
                      <td
                        key={i}
                        className={`px-3 py-2 text-right tabular-nums ${c === null ? 'text-fg-muted/40' : c > 3 ? 'text-danger font-semibold' : c > 1.5 ? 'text-warning' : 'text-fg-secondary'}`}
                      >
                        {c === null ? '—' : `${c}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function EchoReport({ brand, range }: { brand: BrandFilter; range: DateRange }) {
  const mult = brandMultiplier(brand) * rangeMultiplier(range);
  const r = rand(hashStr(`echo-${brand}-${range}`));
  const events = [
    { name: 'page_view', fired: Math.floor(48_200 * mult), qualified: Math.floor(8_600 * mult) },
    {
      name: 'lead_form_start',
      fired: Math.floor(12_400 * mult),
      qualified: Math.floor(7_400 * mult),
    },
    {
      name: 'lead_form_submit',
      fired: Math.floor(6_200 * mult),
      qualified: Math.floor(5_100 * mult),
    },
    {
      name: 'pixel_kyc_started',
      fired: Math.floor(4_800 * mult),
      qualified: Math.floor(4_100 * mult),
    },
    {
      name: 'pixel_kyc_passed',
      fired: Math.floor(3_900 * mult),
      qualified: Math.floor(3_900 * mult),
    },
    {
      name: 'application_funded',
      fired: Math.floor(1_840 * mult),
      qualified: Math.floor(1_840 * mult),
    },
  ];
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Total pixel events"
          value={events.reduce((s, e) => s + e.fired, 0).toLocaleString()}
        />
        <Kpi label="Qualified leads" value={events[2]!.qualified.toLocaleString()} />
        <Kpi
          label="Funded / qualified"
          value={`${Math.round((events[5]!.qualified / events[2]!.qualified) * 100)}%`}
        />
        <Kpi
          label="Pixel coverage"
          value={`${75 + Math.floor(r() * 22)}%`}
          hint="of partner pages"
        />
      </div>
      <Card>
        <CardHeader title="Pixel events → qualified pipeline" />
        <CardBody>
          <ul className="space-y-2.5">
            {events.map((e) => (
              <li key={e.name}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="font-mono text-fg-secondary">{e.name}</span>
                  <span className="text-fg-muted tabular-nums">
                    {e.fired.toLocaleString()} fired · {e.qualified.toLocaleString()} qualified
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-bg-muted overflow-hidden flex">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${Math.max(2, (e.qualified / e.fired) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}

function RiskReport({ brand }: { brand: BrandFilter }) {
  const r = rand(hashStr(`risk-${brand}`));
  const partners = MASTER_PARTNERS.map((p) => ({
    partner: p.legalName,
    partnerId: p.id,
    composite: 45 + Math.floor(r() * 55),
    velocityFlag: r() > 0.7,
    nsfRate: Number((r() * 4).toFixed(2)),
    chargeoff: Number((r() * 1.8).toFixed(2)),
    fraud: Math.floor(r() * 6),
  }));
  partners.sort((a, b) => b.composite - a.composite);
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="SENTRY median"
          value={String(
            Math.round(partners.reduce((s, p) => s + p.composite, 0) / partners.length),
          )}
          hint="composite risk score"
        />
        <Kpi
          label="Velocity flags"
          value={String(partners.filter((p) => p.velocityFlag).length)}
          tone={partners.filter((p) => p.velocityFlag).length > 2 ? 'warning' : 'neutral'}
        />
        <Kpi
          label="High-risk partners"
          value={String(partners.filter((p) => p.composite > 75).length)}
          hint="composite > 75"
        />
        <Kpi
          label="Fraud signals"
          value={String(partners.reduce((s, p) => s + p.fraud, 0))}
          hint="last 30d"
        />
      </div>
      <ReportTable
        title="SENTRY composite scores"
        columns={[
          {
            key: 'partner',
            label: 'Partner',
            render: (r: (typeof partners)[number]) => (
              <Link
                href={`/control-panel/${r.partnerId}`}
                className="font-medium text-fg hover:underline"
              >
                {r.partner}
              </Link>
            ),
          },
          {
            key: 'composite',
            label: 'Composite',
            align: 'right',
            render: (r: (typeof partners)[number]) => (
              <span
                className={`font-bold tabular-nums ${r.composite > 75 ? 'text-danger' : r.composite > 60 ? 'text-warning' : 'text-success'}`}
              >
                {r.composite}
              </span>
            ),
          },
          {
            key: 'velocityFlag',
            label: 'Velocity',
            render: (r: (typeof partners)[number]) =>
              r.velocityFlag ? (
                <StatusPill tone="warning" icon={<AlertIcon size={10} />}>
                  Flagged
                </StatusPill>
              ) : (
                <StatusPill tone="success">OK</StatusPill>
              ),
          },
          {
            key: 'nsfRate',
            label: 'NSF %',
            align: 'right',
            render: (r: (typeof partners)[number]) => `${r.nsfRate}%`,
          },
          {
            key: 'chargeoff',
            label: 'Charge-off %',
            align: 'right',
            render: (r: (typeof partners)[number]) => `${r.chargeoff}%`,
          },
          {
            key: 'fraud',
            label: 'Fraud signals',
            align: 'right',
            render: (r: (typeof partners)[number]) => r.fraud,
          },
        ]}
        rows={partners}
      />
    </>
  );
}

/* ----------------------------------------------------------------------- */
/*  Scheduled reports panel                                                 */
/* ----------------------------------------------------------------------- */

function ScheduledPanel({
  schedules,
  onAdd,
  onRemove,
}: {
  schedules: ScheduledReport[];
  onAdd: (s: ScheduledReport) => void;
  onRemove: (id: string) => void;
}) {
  const [reportId, setReportId] = useState<ReportId>('finperf');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [recipients, setRecipients] = useState('');
  const [saving, setSaving] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const today = new Date();
    today.setDate(today.getDate() + (frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30));
    // Simulate the async save the BFF would do — keeps the button in
    // loading state long enough for it to be perceivable.
    setTimeout(() => {
      onAdd({
        id: 's_' + Date.now().toString(36),
        reportId,
        frequency,
        recipients,
        nextRun: today.toISOString().slice(0, 10),
      });
      setRecipients('');
      setSaving(false);
    }, 400);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Schedule a report"
          description="Delivered to recipients on a recurring cadence. Backend wiring lands when /v1/admin/scheduled-reports goes live."
        />
        <CardBody>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="block text-[12px] font-medium text-fg-secondary">
              Report
              <select
                value={reportId}
                onChange={(e) => setReportId(e.target.value as ReportId)}
                className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
              >
                {REPORTS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-medium text-fg-secondary">
              Frequency
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="block text-[12px] font-medium text-fg-secondary md:col-span-2">
              Recipients (comma separated)
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                required
                placeholder="brodie@amalafinance.com.au, finance@…"
                className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
              />
            </label>
            <div className="md:col-span-4 flex justify-end">
              <Button
                size="sm"
                variant="primary"
                type="submit"
                disabled={!recipients || saving}
                aria-busy={saving}
              >
                {saving ? (
                  <>
                    <span
                      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                      aria-hidden
                    />
                    Saving…
                  </>
                ) : (
                  'Create schedule'
                )}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`Active schedules (${schedules.length})`}
          description="Click a row to inspect or remove."
        />
        <CardBody className="p-0">
          <div className="hidden md:grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
            <span className="col-span-4">Report</span>
            <span className="col-span-2">Frequency</span>
            <span className="col-span-3">Recipients</span>
            <span className="col-span-2">Next run</span>
            <span className="col-span-1 text-right">Action</span>
          </div>
          {schedules.length === 0 ? (
            <EmptyState
              title="No schedules yet"
              description="Use the form above to schedule a report. Recipients will receive a CSV + summary on the cadence you pick."
              className="m-4"
            />
          ) : (
            <ul
              className="divide-y divide-border"
              aria-label={`${schedules.length} scheduled reports`}
            >
              {schedules.map((s) => {
                const r = REPORTS.find((x) => x.id === s.reportId);
                return (
                  <li
                    key={s.id}
                    className="grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-0 px-4 sm:px-5 py-3 text-[12px]"
                  >
                    <div className="md:col-span-4">
                      <p className="font-semibold text-fg">{r?.title ?? s.reportId}</p>
                      <p className="text-[10px] text-fg-muted">{r?.desc}</p>
                    </div>
                    <div className="md:col-span-2 capitalize text-fg-secondary">
                      <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted mr-1">
                        Cadence:
                      </span>
                      {s.frequency}
                    </div>
                    <div className="md:col-span-3 text-fg-muted truncate">
                      <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold mr-1">
                        To:
                      </span>
                      {s.recipients}
                    </div>
                    <div className="md:col-span-2 font-mono text-[11px] text-fg-secondary">
                      <span className="md:hidden font-sans text-[10px] uppercase tracking-wider font-semibold text-fg-muted mr-1">
                        Next:
                      </span>
                      {s.nextRun}
                    </div>
                    <div className="md:col-span-1 md:text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(s.id)}
                        aria-label={`Remove schedule for ${r?.title ?? s.reportId}`}
                        className="text-[11px] text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 rounded min-h-[36px] inline-flex items-center px-1"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Generic widgets                                                         */
/* ----------------------------------------------------------------------- */

function Kpi({
  label,
  value,
  hint,
  delta,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: number;
  tone?: StatusTone;
  /** Optional drill-in URL — when provided the tile becomes a Link. */
  href?: string;
}) {
  const valColor =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-fg';
  const body = (
    <>
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className={`mt-1.5 text-[20px] font-bold tracking-tight leading-none ${valColor}`}>
        {value}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {typeof delta === 'number' && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${delta >= 0 ? 'text-success' : 'text-danger'}`}
          >
            {delta >= 0 ? <TrendUpIcon size={10} /> : <TrendDownIcon size={10} />}
            {delta >= 0 ? '+' : ''}
            {delta}%
          </span>
        )}
        {hint && <span className="text-[10px] text-fg-muted">{hint}</span>}
      </div>
    </>
  );
  const base = 'block rounded-xl border border-border bg-bg-elevated px-4 py-3';
  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${label}. Open underlying list.`}
        className={`${base} transition-colors hover:border-border-strong hover:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-muted">
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

/**
 * Stacked bar chart. Each column carries 3 segments stacked vertically
 * (MedPay/TradePay/CoachPay). Bar width is fixed and proportional so
 * the columns never look like mismatched rectangles. Values rail sits
 * above the bars on a fixed y; month label sits below on a fixed y.
 * `seg.color` is now a literal CSS colour string (not a Tailwind class)
 * so we can speak navy → grey → light-grey directly without dragging
 * the platform's semantic accent tokens into a chart that's not about
 * accents.
 */
function StackedBars({
  data,
  height = 240,
}: {
  data: Array<{ label: string; segments: Array<{ value: number; color: string; label: string }> }>;
  height?: number;
}) {
  const width = 720;
  const padTop = 24;
  const padBottom = 28;
  const padLeft = 16;
  const padRight = 16;
  const chartH = height - padTop - padBottom;
  const totals = data.map((d) => d.segments.reduce((s, x) => s + x.value, 0));
  const max = Math.max(...totals, 1);
  const colW = (width - padLeft - padRight) / data.length;
  const barW = Math.min(48, colW * 0.62);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Funded volume by month, stacked by brand"
      style={{ display: 'block' }}
    >
      {/* Y grid */}
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={padLeft}
          x2={width - padRight}
          y1={padTop + chartH * (1 - t)}
          y2={padTop + chartH * (1 - t)}
          stroke="#e2e8f0"
          strokeDasharray="2 4"
        />
      ))}
      {/* Baseline */}
      <line
        x1={padLeft}
        x2={width - padRight}
        y1={padTop + chartH + 0.5}
        y2={padTop + chartH + 0.5}
        stroke="#cbd5e1"
      />

      {data.map((d, i) => {
        const cx = padLeft + i * colW + colW / 2;
        const x = cx - barW / 2;
        let yCursor = padTop + chartH;
        const totalForLabel = totals[i]!;
        return (
          <g key={d.label}>
            {/* Stacked segments, drawn bottom-up */}
            {d.segments.map((seg, si) => {
              const h = (seg.value / max) * chartH;
              yCursor -= h;
              // Only round the top of the topmost segment so the stack
              // reads as a single bar.
              const isTop = si === d.segments.length - 1;
              return (
                <rect
                  key={seg.label}
                  x={x}
                  y={yCursor}
                  width={barW}
                  height={Math.max(0, h)}
                  rx={isTop ? 4 : 0}
                  fill={seg.color}
                >
                  <title>{`${d.label} · ${seg.label}: $${seg.value}K`}</title>
                </rect>
              );
            })}
            {/* Total value above the bar */}
            <text
              x={cx}
              y={padTop - 8}
              textAnchor="middle"
              fontSize={11}
              fill="#475569"
              fontWeight={600}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              ${totalForLabel}K
            </text>
            {/* Month label below the baseline */}
            <text
              x={cx}
              y={height - 8}
              textAnchor="middle"
              fontSize={11}
              fill="#0f172a"
              fontWeight={600}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Solid-square legend swatch keyed by literal CSS colour. */
function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-secondary">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-[11px] font-medium">{label}</span>
    </span>
  );
}

function HorizontalBars({
  data,
  maxLabel,
}: {
  data: Array<{ label: string; value: number; sub?: string }>;
  maxLabel?: string;
}) {
  const max = Math.max(...data.map((d) => d.value)) || 100;
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-fg-secondary truncate pr-2">{d.label}</span>
            <span className="text-fg-muted tabular-nums whitespace-nowrap">
              {d.value}
              {maxLabel?.includes('%') ? '%' : ''}
              {d.sub && ` · ${d.sub}`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-bg-muted overflow-hidden">
            <div className="h-full bg-accent/80" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Funnel chart — vertical bars, all anchored to the same baseline, each
 * narrower than the last (proportional to value). Navy → light grey
 * shading so the eye reads the drop-off without colour noise. Values
 * top-aligned, stage labels + cumulative conversion % below the bar
 * along a fixed y rail so labels never drift with bar height.
 */
function FunnelSVG({
  stages,
}: {
  stages: Array<{ label: string; value: number; convPct: number }>;
}) {
  const width = 720;
  const height = 280;
  const top = stages[0]!.value || 1;

  // Top + bottom rails for the chart area.
  const valueRailY = 26; // y for the "453" value above each bar
  const baseY = 200; // bar baseline
  const labelRailY = baseY + 22; // stage name
  const pctRailY = baseY + 38; // cumulative conv %

  const colW = width / stages.length;
  const barW = colW * 0.7;

  // Navy → light grey shading. 6 fixed stops so the ramp reads
  // immediately and matches the rest of the platform's discipline.
  const palette = ['#0d1530', '#1e3a8a', '#3b4f7a', '#64748b', '#94a3b8', '#cbd5e1'];

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Funnel chart — leads through funded"
      style={{ display: 'block' }}
    >
      {/* Baseline rail */}
      <line x1={0} x2={width} y1={baseY + 0.5} y2={baseY + 0.5} stroke="#e2e8f0" strokeWidth={1} />
      {stages.map((s, i) => {
        const ratio = s.value / top;
        const barH = Math.max(8, ratio * (baseY - valueRailY - 14));
        const cx = i * colW + colW / 2;
        const x = cx - barW / 2;
        const y = baseY - barH;
        const fill = palette[Math.min(i, palette.length - 1)]!;
        return (
          <g key={s.label}>
            {/* Value above the bar */}
            <text
              x={cx}
              y={valueRailY - 2}
              fontSize={11}
              textAnchor="middle"
              fill="#475569"
              fontWeight={600}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {s.value.toLocaleString()}
            </text>
            {/* Bar */}
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={fill} />
            {/* Stage label rail */}
            <text
              x={cx}
              y={labelRailY}
              fontSize={11}
              textAnchor="middle"
              fill="#0f172a"
              fontWeight={600}
            >
              {s.label}
            </text>
            {/* Conversion vs. top of funnel — cumulative */}
            <text
              x={cx}
              y={pctRailY}
              fontSize={10}
              textAnchor="middle"
              fill="#94a3b8"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {Math.round((s.value / top) * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface ColDef<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render: (row: T, idx: number) => React.ReactNode;
}

function ReportTable<T>({
  title,
  columns,
  rows,
  pageSize = 10,
  emptyLabel = 'No rows match the current filters.',
}: {
  title: string;
  columns: ColDef<T>[];
  rows: T[];
  pageSize?: number;
  emptyLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a: any, b: any) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number')
        return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [rows, sortKey, sortDir]);

  const start = page * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));

  function clickHeader(k: string) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  }

  return (
    <Card>
      <CardHeader title={title} description={`Page ${page + 1} of ${pages}`} />
      <CardBody className="p-0">
        <div className="overflow-x-auto" role="region" aria-label={title} tabIndex={0}>
          <table className="w-full min-w-[640px] text-[12px]">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-bg-muted/40 border-b border-border">
              <tr>
                {columns.map((c) => {
                  const sortState =
                    sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={sortState}
                      className={`px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-fg-muted ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      <button
                        type="button"
                        onClick={() => clickHeader(c.key)}
                        aria-label={`Sort by ${c.label}${sortState !== 'none' ? `, currently ${sortState}` : ''}`}
                        className={`inline-flex items-center gap-1 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded ${c.align === 'right' ? 'flex-row-reverse' : ''}`}
                      >
                        {c.label}
                        {sortKey === c.key && (
                          <span className="opacity-60" aria-hidden>
                            {sortDir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr
                  key={start + i}
                  className="border-b border-border last:border-b-0 hover:bg-bg-muted/30"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-2.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {c.render(row, start + i)}
                    </td>
                  ))}
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center text-fg-muted text-[12px]"
                    role="status"
                  >
                    {emptyLabel}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between px-4 py-2 border-t border-border text-[11px] text-fg-muted"
          >
            <span role="status" aria-live="polite">
              Showing {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
                className="min-h-[36px] px-2.5 rounded-md border border-border bg-bg-elevated disabled:opacity-40 hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                aria-label="Next page"
                className="min-h-[36px] px-2.5 rounded-md border border-border bg-bg-elevated disabled:opacity-40 hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                Next
              </button>
            </div>
          </nav>
        )}
      </CardBody>
    </Card>
  );
}

function largestDropLabel(stages: Array<{ label: string; dropPct: number }>): string {
  const top = [...stages].sort((a, b) => b.dropPct - a.dropPct)[0];
  return top ? top.label : '—';
}

function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg flex items-center gap-2"
    >
      <CheckIcon size={14} aria-hidden />
      {message}
    </div>
  );
}
