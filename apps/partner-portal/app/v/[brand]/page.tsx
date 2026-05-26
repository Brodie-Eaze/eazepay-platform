'use client';
import { notFound, useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  StatusPill,
  type StatusTone,
  DocIcon,
  CheckIcon,
  XIcon,
  DollarIcon,
  ClockIcon,
  TrendUpIcon,
  TrendDownIcon,
  ArrowRightIcon,
  TimeRangeSelector,
  type TimeRange,
  TIME_RANGES,
  LiveIndicator,
  InteractiveBarChart,
  InteractiveDonut,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { applications, type ApplicationRow } from '../../../lib/master-data';
import { expandedApplications } from '../../../lib/seeded-applications';
import { currentPartnerForBrand, partnerShareOfBrand } from '../../../lib/partner-profile';
import {
  applicationsByMonth,
  applicationsByStatus,
  applicationsInRange,
  creditMix,
  fundedVolumeByMonth,
  monthKeyToWindow,
  priorWindow,
  timeRangeToWindow,
  totalFundedCents,
  trendDelta,
} from '../../../lib/dashboard-metrics';

/**
 * Brand portal — Dashboard.
 *
 * Rebuilt to match the partner-dashboard reference: a dense 6-KPI grid
 * sitting above a Monthly Submissions / Monthly Funded / Credit Insights
 * trio, followed by a clickable Recent Applications table that drills
 * straight into the deal detail page.
 *
 * Tenant scope — this page is the merchant's OWN portal. Every figure on
 * screen is scoped to the brand resolved from the URL slug. The master
 * command-centre is the only surface with cross-tenant view.
 */

const slugToBrand = (slug: string): BrandCode | null =>
  BRAND_ORDER.find((b) => BRANDS[b].slug === slug) ?? null;

const productLabelForBrand = (b: BrandCode): string => {
  if (b === 'medpay') return 'MedPay';
  if (b === 'tradepay') return 'TradePay';
  if (b === 'coachpay') return 'CoachPay';
  return 'EazePay';
};

// ────────────────────────────────────────────────────────────────────
//  Per-brand mock generators
//  ────────────────────────────────────────────────────────────────
//  The /api/v1/brand/:brand/dashboard route isn't wired yet, so we hand
//  the page a plausible, deterministic snapshot keyed by BrandCode. The
//  shape of each `BrandSnapshot` mirrors what the BFF will eventually
//  return, so once it lands we swap this for a useQuery + cast.
// ────────────────────────────────────────────────────────────────────

interface BrandSnapshot {
  totalSubmitted: number;
  totalSubmittedDeltaPct: number;
  approved: number;
  approvedDeltaPct: number;
  funded: number;
  fundedDeltaPct: number;
  declined: number;
  declinedDeltaPct: number;
  totalFundedCents: number;
  totalFundedDeltaPct: number;
  pendingPayoutCents: number;
  pendingPayoutDeltaPct: number;
  monthlySubmissions: Array<{ label: string; value: number }>;
  monthlyFunded: Array<{ label: string; value: number }>;
  creditMix: Array<{
    name: 'Prime' | 'NearPrime' | 'Subprime' | 'DeepSubprime';
    range: string;
    count: number;
  }>;
}

const MONTH_LABELS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'] as const;

const BRAND_SNAPSHOTS: Record<'medpay' | 'tradepay' | 'coachpay', BrandSnapshot> = {
  medpay: {
    totalSubmitted: 38,
    totalSubmittedDeltaPct: 14,
    approved: 22,
    approvedDeltaPct: 9,
    funded: 16,
    fundedDeltaPct: 22,
    declined: 7,
    declinedDeltaPct: -8,
    totalFundedCents: 312_400_00,
    totalFundedDeltaPct: 18,
    pendingPayoutCents: 24_800_00,
    pendingPayoutDeltaPct: 6,
    monthlySubmissions: MONTH_LABELS.map((label, i) => ({
      label,
      value: [22, 28, 31, 27, 33, 38][i] ?? 0,
    })),
    monthlyFunded: MONTH_LABELS.map((label, i) => ({
      label,
      value: [9, 11, 14, 12, 15, 16][i] ?? 0,
    })),
    creditMix: [
      { name: 'Prime', range: '700–850', count: 18 },
      { name: 'NearPrime', range: '640–699', count: 14 },
      { name: 'Subprime', range: '580–639', count: 6 },
      { name: 'DeepSubprime', range: '300–579', count: 0 },
    ],
  },
  tradepay: {
    totalSubmitted: 64,
    totalSubmittedDeltaPct: 11,
    approved: 41,
    approvedDeltaPct: 16,
    funded: 28,
    fundedDeltaPct: 19,
    declined: 12,
    declinedDeltaPct: -3,
    totalFundedCents: 1_142_500_00,
    totalFundedDeltaPct: 24,
    pendingPayoutCents: 86_200_00,
    pendingPayoutDeltaPct: 12,
    monthlySubmissions: MONTH_LABELS.map((label, i) => ({
      label,
      value: [42, 51, 58, 47, 60, 64][i] ?? 0,
    })),
    monthlyFunded: MONTH_LABELS.map((label, i) => ({
      label,
      value: [16, 21, 25, 22, 27, 28][i] ?? 0,
    })),
    creditMix: [
      { name: 'Prime', range: '700–850', count: 21 },
      { name: 'NearPrime', range: '640–699', count: 23 },
      { name: 'Subprime', range: '580–639', count: 14 },
      { name: 'DeepSubprime', range: '300–579', count: 6 },
    ],
  },
  coachpay: {
    totalSubmitted: 47,
    totalSubmittedDeltaPct: 8,
    approved: 29,
    approvedDeltaPct: 12,
    funded: 19,
    fundedDeltaPct: 14,
    declined: 11,
    declinedDeltaPct: 4,
    totalFundedCents: 184_900_00,
    totalFundedDeltaPct: 11,
    pendingPayoutCents: 12_600_00,
    pendingPayoutDeltaPct: 0,
    monthlySubmissions: MONTH_LABELS.map((label, i) => ({
      label,
      value: [28, 34, 39, 36, 44, 47][i] ?? 0,
    })),
    monthlyFunded: MONTH_LABELS.map((label, i) => ({
      label,
      value: [11, 14, 17, 15, 18, 19][i] ?? 0,
    })),
    creditMix: [
      { name: 'Prime', range: '700–850', count: 9 },
      { name: 'NearPrime', range: '640–699', count: 17 },
      { name: 'Subprime', range: '580–639', count: 13 },
      { name: 'DeepSubprime', range: '300–579', count: 8 },
    ],
  },
};

// ────────────────────────────────────────────────────────────────────
//  Formatters
// ────────────────────────────────────────────────────────────────────

const fmtCompactUsd = (cents: number): string => {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}K`;
  return `$${dollars.toFixed(0)}`;
};

const fmtUsd = (cents: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);

const fmtDateDDMMYYYY = (iso: string): string => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const fmtPctDelta = (n: number): string => {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}%`;
};

// ────────────────────────────────────────────────────────────────────
//  Inline status mapping for the Recent Applications table.
//  StatusPill tone palette: success / warning / danger / info / neutral.
// ────────────────────────────────────────────────────────────────────

const applicationStatusToPill = (
  s: ApplicationRow['status'],
): { tone: StatusTone; label: string } => {
  switch (s) {
    case 'funded':
      return { tone: 'success', label: 'Funded' };
    case 'approved':
      return { tone: 'success', label: 'Approved' };
    case 'in_review':
      return { tone: 'warning', label: 'Review' };
    case 'declined':
      return { tone: 'danger', label: 'Declined' };
    case 'submitted':
    default:
      return { tone: 'info', label: 'Submitted' };
  }
};

// ────────────────────────────────────────────────────────────────────
//  KPI card — inline. We don't reuse @eazepay/ui's KpiCard because its
//  delta + icon slots paint a different shape from the reference (mono
//  arrows, sparklines, etc.). The inline version matches the mockup
//  exactly: corner icon, big number, signed-and-coloured delta.
// ────────────────────────────────────────────────────────────────────

/**
 * KpiTile — clickable when `href` is provided. Wrapping the tile in a
 * <Link> turns every KPI into a drill-in to a pre-filtered list view. The
 * href pattern is `/v/[brand]/applications?status=...&range=...` so the
 * destination page reads the URL and applies the matching filter (Sprint H).
 */
const KpiTile = ({
  label,
  value,
  deltaPct,
  icon,
  goodWhenDown = false,
  href,
}: {
  label: string;
  value: string;
  deltaPct: number;
  icon: React.ReactNode;
  goodWhenDown?: boolean;
  href?: string;
}) => {
  const isUp = deltaPct > 0;
  const isDown = deltaPct < 0;
  const directionIsGood = goodWhenDown ? isDown : isUp;
  const directionIsBad = goodWhenDown ? isUp : isDown;
  const tone =
    deltaPct === 0
      ? 'text-fg-muted'
      : directionIsGood
        ? 'text-success'
        : directionIsBad
          ? 'text-danger'
          : 'text-fg-muted';
  const Arrow = isUp ? TrendUpIcon : isDown ? TrendDownIcon : TrendUpIcon;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-fg-muted font-semibold leading-tight">
          {label}
        </span>
        <span className="text-fg-muted shrink-0">{icon}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        <span className="text-[26px] font-semibold leading-none tabular-nums tracking-tight text-fg">
          {value}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${tone}`}
        >
          <Arrow size={11} />
          {fmtPctDelta(deltaPct)}
        </span>
      </div>
    </>
  );

  const base =
    'relative flex flex-col justify-between rounded-lg border border-border bg-bg-elevated px-4 py-3.5 shadow-sm min-h-[110px]';

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${label}: ${value}. Open filtered list.`}
        className={`${base} transition-colors hover:border-border-strong hover:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
};

// ────────────────────────────────────────────────────────────────────
//  Inline bar chart — vertical bars with horizontal grid + axis labels.
//  All SVG, no chart lib.
// ────────────────────────────────────────────────────────────────────

const BarChart = ({
  data,
  yMax,
  yStep,
}: {
  data: Array<{ label: string; value: number }>;
  yMax: number;
  yStep: number;
}) => {
  const width = 320;
  const height = 180;
  const padLeft = 28;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 22;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const gridLines: number[] = [];
  for (let v = 0; v <= yMax; v += yStep) gridLines.push(v);

  const barSlot = plotW / data.length;
  const barWidth = Math.min(28, barSlot * 0.55);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto"
      role="img"
      aria-label={`Monthly values: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}
    >
      {/* horizontal grid lines + y-axis labels */}
      {gridLines.map((g) => {
        const y = padTop + plotH - (g / yMax) * plotH;
        return (
          <g key={`grid-${g}`}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-border"
            />
            <text x={padLeft - 6} y={y + 3} textAnchor="end" className="fill-fg-muted" fontSize={9}>
              {g}
            </text>
          </g>
        );
      })}

      {/* bars */}
      {data.map((d, i) => {
        const cx = padLeft + barSlot * (i + 0.5);
        const h = (d.value / yMax) * plotH;
        const y = padTop + plotH - h;
        return (
          <g key={d.label}>
            <rect
              x={cx - barWidth / 2}
              y={y}
              width={barWidth}
              height={Math.max(0, h)}
              rx={2}
              className="fill-fg-secondary/70"
            />
            <text x={cx} y={height - 6} textAnchor="middle" className="fill-fg-muted" fontSize={10}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ────────────────────────────────────────────────────────────────────
//  Donut chart — SVG with stroke-dasharray wedges.
//  The primary wedge (Prime) is rendered in the brand accentHex; the
//  remaining wedges fall back to a navy → light-grey ramp.
// ────────────────────────────────────────────────────────────────────

const DonutChart = ({
  segments,
  total,
}: {
  segments: Array<{ name: string; count: number; color: string }>;
  total: number;
}) => {
  const size = 160;
  const stroke = 22;
  const r = size / 2 - stroke / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const safeTotal = total > 0 ? total : 1;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-[160px] h-[160px]"
      role="img"
      aria-label={`Credit mix donut, ${total} total applications across ${segments.length} tiers`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-bg-muted"
      />
      {segments.map((s) => {
        const fraction = s.count / safeTotal;
        const dash = fraction * c;
        const gap = c - dash;
        const el = (
          <circle
            key={s.name}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += dash;
        return el;
      })}
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        className="fill-fg"
        fontSize={26}
        fontWeight={600}
      >
        {total}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 14}
        textAnchor="middle"
        className="fill-fg-muted"
        fontSize={10}
      >
        total
      </text>
    </svg>
  );
};

// ────────────────────────────────────────────────────────────────────
//  Synthesise a brand-scoped Recent Applications list. The master fixture
//  only carries 10 cross-brand rows so for visual realism we extend it
//  with a small deterministic set keyed off the brand. IDs collide with
//  the detail-page lookup gracefully (unknown IDs hit notFound() there,
//  which is the right behaviour while the BFF is unwired).
// ────────────────────────────────────────────────────────────────────

const synthesisedFor = (brand: 'medpay' | 'tradepay' | 'coachpay'): ApplicationRow[] => {
  if (brand === 'medpay') {
    return [
      {
        id: 'a_m11',
        customer: 'Naomi Esposito',
        customerEmail: 'naomi.e@inbox.test',
        partner: 'Helio Dental Group',
        product: 'med-pay',
        amountCents: 4_800_00,
        fico: 731,
        lender: 'CrossRiver',
        status: 'approved',
        date: '2026-05-12',
      },
      {
        id: 'a_m12',
        customer: 'Rafael Maldonado',
        customerEmail: 'rafael.m@inbox.test',
        partner: 'Meridian Vision Care',
        product: 'med-pay',
        amountCents: 12_600_00,
        fico: 689,
        lender: 'WebBank',
        status: 'submitted',
        date: '2026-05-11',
      },
      {
        id: 'a_m13',
        customer: 'Hye-Jin Park',
        customerEmail: 'hye.p@inbox.test',
        partner: 'Brio Wellness Clinics',
        product: 'med-pay',
        amountCents: 28_400_00,
        fico: 752,
        lender: 'LeadBank',
        status: 'funded',
        date: '2026-05-09',
      },
      {
        id: 'a_m14',
        customer: 'Dimitri Volkov',
        customerEmail: 'dimitri.v@inbox.test',
        partner: 'Helio Dental Group',
        product: 'med-pay',
        amountCents: 2_150_00,
        fico: 604,
        lender: 'FinWise',
        status: 'declined',
        date: '2026-05-08',
      },
      {
        id: 'a_m15',
        customer: 'Eleanor Quinn',
        customerEmail: 'eleanor.q@inbox.test',
        partner: 'Brio Wellness Clinics',
        product: 'med-pay',
        amountCents: 8_900_00,
        fico: 712,
        lender: 'CapitalOne',
        status: 'in_review',
        date: '2026-05-06',
      },
    ];
  }
  if (brand === 'tradepay') {
    return [
      {
        id: 'a_t11',
        customer: 'Hannah O’Brien',
        customerEmail: 'hannah.o@inbox.test',
        partner: 'Orion Roof & Solar',
        product: 'trade-pay',
        amountCents: 86_500_00,
        fico: 724,
        lender: 'LeadBank',
        status: 'funded',
        date: '2026-05-13',
      },
      {
        id: 'a_t12',
        customer: 'Owen Castellanos',
        customerEmail: 'owen.c@inbox.test',
        partner: 'Riverside Renovation Co.',
        product: 'trade-pay',
        amountCents: 42_800_00,
        fico: 681,
        lender: 'CrossRiver',
        status: 'approved',
        date: '2026-05-12',
      },
      {
        id: 'a_t13',
        customer: 'Mei-Lin Zhao',
        customerEmail: 'mei.z@inbox.test',
        partner: 'Summit HVAC Pros',
        product: 'trade-pay',
        amountCents: 14_200_00,
        fico: 645,
        lender: 'BlueVine',
        status: 'in_review',
        date: '2026-05-11',
      },
      {
        id: 'a_t14',
        customer: 'Bradley Sutton',
        customerEmail: 'bradley.s@inbox.test',
        partner: 'Orion Roof & Solar',
        product: 'trade-pay',
        amountCents: 117_300_00,
        fico: 705,
        lender: 'WebBank',
        status: 'submitted',
        date: '2026-05-10',
      },
      {
        id: 'a_t15',
        customer: 'Solana Martinez',
        customerEmail: 'solana.m@inbox.test',
        partner: 'Summit HVAC Pros',
        product: 'trade-pay',
        amountCents: 5_400_00,
        fico: 588,
        lender: 'FinWise',
        status: 'declined',
        date: '2026-05-08',
      },
    ];
  }
  return [
    {
      id: 'a_c11',
      customer: 'Theo Bergeron',
      customerEmail: 'theo.b@inbox.test',
      partner: 'Atlas Executive Coaching',
      product: 'coach-pay',
      amountCents: 6_800_00,
      fico: 671,
      lender: 'Affirm',
      status: 'approved',
      date: '2026-05-13',
    },
    {
      id: 'a_c12',
      customer: 'Aaliyah Singh',
      customerEmail: 'aaliyah.s@inbox.test',
      partner: 'Kindred Career Lab',
      product: 'coach-pay',
      amountCents: 14_900_00,
      fico: 702,
      lender: 'CrossRiver',
      status: 'funded',
      date: '2026-05-11',
    },
    {
      id: 'a_c13',
      customer: 'Mateo Fernandez',
      customerEmail: 'mateo.f@inbox.test',
      partner: 'Atlas Executive Coaching',
      product: 'coach-pay',
      amountCents: 3_200_00,
      fico: 622,
      lender: 'CapitalOne',
      status: 'in_review',
      date: '2026-05-09',
    },
    {
      id: 'a_c14',
      customer: 'Yuki Tanaka',
      customerEmail: 'yuki.t@inbox.test',
      partner: 'Kindred Career Lab',
      product: 'coach-pay',
      amountCents: 9_400_00,
      fico: 648,
      lender: 'LendFi',
      status: 'submitted',
      date: '2026-05-08',
    },
    {
      id: 'a_c15',
      customer: 'Connor Reilly',
      customerEmail: 'connor.r@inbox.test',
      partner: 'Atlas Executive Coaching',
      product: 'coach-pay',
      amountCents: 1_950_00,
      fico: 596,
      lender: 'Affirm',
      status: 'declined',
      date: '2026-05-06',
    },
  ];
};

// ────────────────────────────────────────────────────────────────────
//  Page
// ────────────────────────────────────────────────────────────────────

export default function BrandHomePage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brand = slugToBrand(brandSlug);
  if (!brand) notFound();

  // The dashboard layout is only meaningful for the three product
  // brands. EazePay Direct flows through a different surface, so we
  // fall back to the default snapshot keyed off tradepay if anyone
  // navigates here. (Routing prevents this in practice.)
  const productBrand: 'medpay' | 'tradepay' | 'coachpay' =
    brand === 'medpay' || brand === 'tradepay' || brand === 'coachpay' ? brand : 'tradepay';

  const spec = BRANDS[brand];

  // SEC + tenant isolation: the dashboard renders the SIGNED-IN
  // partner's data ONLY. The previous build rendered brand-aggregate
  // snapshots (BRAND_SNAPSHOTS[productBrand]) which leaked cross-
  // tenant volume — every TradePay merchant saw every other TradePay
  // merchant's funded total. Now we resolve the partner from session
  // and scale the brand snapshot down to the partner's share.
  const partner = useMemo(() => currentPartnerForBrand(productBrand), [productBrand]);
  const partnerShare = useMemo(
    () => (partner ? partnerShareOfBrand(partner, productBrand) : 0),
    [partner, productBrand],
  );
  const brandSnapshot = BRAND_SNAPSHOTS[productBrand];

  /* ─── Sprint H: URL-driven time range ─────────────────────────────────
   * The dashboard reads `?range=` from the URL so deep-links carry the
   * window with them. We default to 30d, the same default applied across
   * /admin and /reports. Changing the range replaces the URL (no scroll,
   * no history push) so back-button still moves between pages. */
  const sp = useSearchParams();
  const router = useRouter();
  const rangeFromUrl = (sp?.get('range') as TimeRange | null) ?? null;
  const range: TimeRange =
    rangeFromUrl && (TIME_RANGES as readonly string[]).includes(rangeFromUrl)
      ? rangeFromUrl
      : '30d';

  const handleRangeChange = useCallback(
    (next: TimeRange) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      params.set('range', next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, sp],
  );

  /* The live indicator pulses every time we register an "update" — for
   * this fixture-only sprint, that's whenever the user changes range
   * (acts as a heartbeat). Real Pusher wiring lives in
   * lib/use-application-realtime.ts (per-application channel); brand-
   * channel subscriptions are scoped to a follow-on sprint. */
  const [pulseKey, setPulseKey] = useState(0);

  /* ─── Live snapshot derived from expandedApplications ──────────────── */
  const liveSnapshot = useMemo(() => {
    if (!partner) return null;
    const { fromIso, toIso } = timeRangeToWindow(range);
    const prior = priorWindow(range);

    const partnerRows = expandedApplications.filter((a) => a.partner === partner.legalName);
    if (partnerRows.length === 0) return null;

    const inWindow = applicationsInRange(partnerRows, fromIso, toIso);
    const inPrior = applicationsInRange(partnerRows, prior.fromIso, prior.toIso);
    const cur = applicationsByStatus(inWindow);
    const pre = applicationsByStatus(inPrior);

    const submittedDelta = trendDelta(cur.total, pre.total);
    const approvedDelta = trendDelta(cur.approved, pre.approved);
    const fundedDelta = trendDelta(cur.funded, pre.funded);
    const declinedDelta = trendDelta(cur.declined, pre.declined);

    const fundedCents = totalFundedCents(inWindow);
    const fundedCentsPrior = totalFundedCents(inPrior);
    const fundedCentsDelta = trendDelta(fundedCents, fundedCentsPrior);

    const monthlySubs = applicationsByMonth(partnerRows, fromIso, toIso);
    const monthlyFunded = fundedVolumeByMonth(partnerRows, fromIso, toIso);
    const mix = creditMix(inWindow);

    return {
      cur,
      submittedDelta,
      approvedDelta,
      fundedDelta,
      declinedDelta,
      fundedCents,
      fundedCentsDelta,
      inReview: cur.in_review,
      monthlySubs,
      monthlyFunded,
      mix,
    };
  }, [partner, range]);

  /**
   * The dashboard snapshot, scaled down from brand-aggregate to the
   * signed-in partner's slice. Used as the FALLBACK when the partner
   * has no rows in expandedApplications (typically because they were
   * added after the seeded fixture). The primary path is `liveSnapshot`,
   * which derives every KPI from the real (fixture) ApplicationRow set
   * and respects the time range.
   */
  const snapshot = useMemo(() => {
    if (!partner) return brandSnapshot;
    const scaleInt = (n: number): number => Math.round(n * partnerShare);
    const scaleBig = (cents: number): number => Math.round(cents * partnerShare);
    return {
      ...brandSnapshot,
      totalSubmitted: scaleInt(brandSnapshot.totalSubmitted),
      approved: scaleInt(brandSnapshot.approved),
      funded: scaleInt(brandSnapshot.funded),
      declined: scaleInt(brandSnapshot.declined),
      totalFundedCents: scaleBig(brandSnapshot.totalFundedCents),
      pendingPayoutCents: scaleBig(brandSnapshot.pendingPayoutCents),
      monthlySubmissions: brandSnapshot.monthlySubmissions.map((d) => ({
        ...d,
        value: scaleInt(d.value),
      })),
      monthlyFunded: brandSnapshot.monthlyFunded.map((d) => ({
        ...d,
        value: scaleInt(d.value),
      })),
      creditMix: brandSnapshot.creditMix.map((c) => ({ ...c, count: scaleInt(c.count) })),
    };
  }, [brandSnapshot, partner, partnerShare]);

  /* The values rendered on screen. When `liveSnapshot` resolves we use
   * that (real time-window math); otherwise we fall back to the scaled
   * BRAND_SNAPSHOTS so the page still renders for partners with no
   * fixture rows. Both shapes expose the same fields we read below. */
  const kpiSubmitted = liveSnapshot ? liveSnapshot.cur.total : snapshot.totalSubmitted;
  const kpiApproved = liveSnapshot ? liveSnapshot.cur.approved : snapshot.approved;
  const kpiFunded = liveSnapshot ? liveSnapshot.cur.funded : snapshot.funded;
  const kpiDeclined = liveSnapshot ? liveSnapshot.cur.declined : snapshot.declined;
  const kpiInReview = liveSnapshot ? liveSnapshot.cur.in_review : 0;
  const kpiTotalFundedCents = liveSnapshot ? liveSnapshot.fundedCents : snapshot.totalFundedCents;

  const signed = (
    d: { pct: number; direction: 'up' | 'down' | 'flat' } | undefined,
    fallback: number,
  ): number => {
    if (!d) return fallback;
    if (d.direction === 'flat') return 0;
    return d.direction === 'up' ? d.pct : -d.pct;
  };
  const dSubmitted = signed(liveSnapshot?.submittedDelta, snapshot.totalSubmittedDeltaPct);
  const dApproved = signed(liveSnapshot?.approvedDelta, snapshot.approvedDeltaPct);
  const dFunded = signed(liveSnapshot?.fundedDelta, snapshot.fundedDeltaPct);
  const dDeclined = signed(liveSnapshot?.declinedDelta, snapshot.declinedDeltaPct);
  const dTotalFunded = signed(liveSnapshot?.fundedCentsDelta, snapshot.totalFundedDeltaPct);

  /* Build drill-in URLs. Every KPI links to /applications with the matching
   * status + the current time range carried across so the destination shows
   * the SAME slice the user just clicked on. */
  const baseList = `/v/${brandSlug}/applications`;
  const rangeQs = `&range=${range}`;
  const urlSubmitted = `${baseList}?status=submitted${rangeQs}`;
  const urlApproved = `${baseList}?status=approved${rangeQs}`;
  const urlFunded = `${baseList}?status=funded${rangeQs}`;
  const urlDeclined = `${baseList}?status=declined${rangeQs}`;
  const urlInReview = `${baseList}?status=in_review${rangeQs}`;
  const urlTotalFunded = `${baseList}?status=funded${rangeQs}`;

  // Recent applications — scoped to the signed-in partner. Filter
  // master-data + synthesised rows by partner.legalName (the `partner`
  // string field on ApplicationRow). Both datasets are pre-tagged.
  const recent = useMemo(() => {
    if (!partner) return [];
    const synth = synthesisedFor(productBrand);
    const fromMaster = applications.filter((a) => a.partner === partner.legalName);
    const fromSynth = synth.filter((a) => a.partner === partner.legalName);
    const fromSeeded = expandedApplications.filter(
      (a) => a.partner === partner.legalName && !fromMaster.includes(a) && !fromSynth.includes(a),
    );
    return [...fromSynth, ...fromMaster, ...fromSeeded]
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6);
  }, [partner, productBrand]);

  // Donut palette. Prime gets the brand accent so each portal feels
  // tinted without recolouring the whole chart.
  const palette: Record<'Prime' | 'NearPrime' | 'Subprime' | 'DeepSubprime', string> = {
    Prime: spec.accentHex,
    NearPrime: '#94a3b8',
    Subprime: '#cbd5e1',
    DeepSubprime: '#e2e8f0',
  };

  const creditSource = liveSnapshot ? liveSnapshot.mix : snapshot.creditMix;
  const donutSegments = creditSource.map((c) => ({
    name: c.name,
    count: c.count,
    color: palette[c.name],
    description: c.range,
  }));
  const creditTotal = creditSource.reduce((s, c) => s + c.count, 0);

  /* Chart data: prefer live month-bucket from real applications, fall back
   * to the static snapshot series. */
  const submissionsSeries = liveSnapshot
    ? liveSnapshot.monthlySubs.map((m) => ({
        label: m.label,
        value: m.value,
        meta: { monthKey: m.monthKey } as const,
      }))
    : snapshot.monthlySubmissions.map((d) => ({ label: d.label, value: d.value, meta: {} }));

  const fundedSeries = liveSnapshot
    ? liveSnapshot.monthlyFunded.map((m) => ({
        label: m.label,
        value: m.value,
        meta: { monthKey: m.monthKey } as const,
      }))
    : snapshot.monthlyFunded.map((d) => ({ label: d.label, value: d.value, meta: {} }));

  /* Chart-click → drill-in. Monthly Submissions click → /applications
   * filtered to that month (any status); Monthly Funded click →
   * /applications?status=funded for that month. The destination reads
   * `?from=` / `?to=` (Sprint H wiring). */
  const onClickSubsBar = useCallback(
    (d: { meta?: Record<string, unknown> }) => {
      const monthKey = (d.meta?.monthKey as string | undefined) ?? null;
      if (!monthKey) return;
      const { fromIso, toIso } = monthKeyToWindow(monthKey);
      router.push(`${baseList}?from=${fromIso}&to=${toIso}`);
    },
    [router, baseList],
  );
  const onClickFundedBar = useCallback(
    (d: { meta?: Record<string, unknown> }) => {
      const monthKey = (d.meta?.monthKey as string | undefined) ?? null;
      if (!monthKey) return;
      const { fromIso, toIso } = monthKeyToWindow(monthKey);
      router.push(`${baseList}?status=funded&from=${fromIso}&to=${toIso}`);
    },
    [router, baseList],
  );
  /* Donut wedge click → /applications?tier=<name>&range=<r>. List page
   * reads `tier=` to apply a FICO-band filter (Sprint H). */
  const onClickDonut = useCallback(
    (s: { name: string }) => {
      router.push(`${baseList}?tier=${encodeURIComponent(s.name)}${rangeQs}`);
    },
    [router, baseList, rangeQs],
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Overview' }]}
        title={partner ? `${partner.legalName} · Dashboard` : 'Dashboard'}
        description={
          partner
            ? `Showing data for ${partner.legalName} only. Master operators see the full ${spec.name} network.`
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <LiveIndicator pulseKey={pulseKey} />
            <TimeRangeSelector
              value={range}
              onChange={(r) => {
                handleRangeChange(r);
                setPulseKey((p) => p + 1);
              }}
            />
          </div>
        }
      />
      <PageBody>
        {/* Tenant-isolation banner — makes it obvious the user is
            looking at THEIR business, not aggregated network data.
            See lib/partner-profile.ts for the scoping mechanics. */}
        {partner && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-bg-muted/40 px-4 py-3">
            <span
              className="size-8 rounded-full bg-fg text-bg-elevated flex items-center justify-center font-semibold text-[11px] tracking-wider shrink-0"
              aria-hidden
            >
              {partner.initials}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-fg-muted">
                Your business view
              </p>
              <p className="text-[13px] font-semibold text-fg truncate">
                {partner.legalName}
                <span className="ml-2 font-normal text-fg-muted">
                  · {spec.name} merchant · scoped to this account only
                </span>
              </p>
            </div>
          </div>
        )}
        {/* ─── 6-KPI grid ─── Every tile drills into the matching
            filtered list view, carrying the current time range. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          <KpiTile
            label="Total submitted"
            value={String(kpiSubmitted)}
            deltaPct={dSubmitted}
            icon={<DocIcon size={16} />}
            href={urlSubmitted}
          />
          <KpiTile
            label="Approved"
            value={String(kpiApproved)}
            deltaPct={dApproved}
            icon={<CheckIcon size={16} />}
            href={urlApproved}
          />
          <KpiTile
            label="Funded"
            value={String(kpiFunded)}
            deltaPct={dFunded}
            icon={<DollarIcon size={16} />}
            href={urlFunded}
          />
          <KpiTile
            label="Declined"
            value={String(kpiDeclined)}
            deltaPct={dDeclined}
            icon={<XIcon size={16} />}
            goodWhenDown
            href={urlDeclined}
          />
          <KpiTile
            label="In review"
            value={String(kpiInReview)}
            deltaPct={0}
            icon={<ClockIcon size={16} />}
            href={urlInReview}
          />
          <KpiTile
            label="Total funded"
            value={fmtCompactUsd(kpiTotalFundedCents)}
            deltaPct={dTotalFunded}
            icon={<DollarIcon size={16} />}
            href={urlTotalFunded}
          />
        </div>

        {/* ─── Chart row: Submissions · Funded · Credit Insights ───
            Hover any bar/wedge for an exact value tooltip; click to drill
            in to the matching month or FICO tier. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
          <Card>
            <CardHeader
              title={<span className="text-[14px]">Monthly Submissions</span>}
              description={<span className="text-[12px]">Click a month to filter the list</span>}
            />
            <CardBody className="pt-3">
              <InteractiveBarChart
                data={submissionsSeries}
                onSelect={onClickSubsBar}
                formatValue={(d) => `${d.value} applications`}
                ariaLabel="Monthly submissions bar chart"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={<span className="text-[14px]">Monthly Funded</span>}
              description={
                <span className="text-[12px]">Click a month to filter funded deals</span>
              }
            />
            <CardBody className="pt-3">
              <InteractiveBarChart
                data={fundedSeries}
                onSelect={onClickFundedBar}
                formatValue={(d) => fmtUsd(d.value * 100)}
                ariaLabel="Monthly funded volume bar chart"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={<span className="text-[14px]">Credit Insights</span>}
              description={<span className="text-[12px]">Click a tier to filter</span>}
            />
            <CardBody className="pt-3">
              <div className="flex flex-col items-center">
                <InteractiveDonut
                  segments={donutSegments}
                  total={creditTotal}
                  onSelect={onClickDonut}
                  ariaLabel="Credit tier distribution donut chart"
                />
                <ul className="mt-4 w-full space-y-1.5">
                  {donutSegments.map((s, i) => (
                    <li key={s.name} className="flex items-center justify-between text-[12px]">
                      <Link
                        href={`${baseList}?tier=${encodeURIComponent(s.name)}${rangeQs}`}
                        className="flex items-center justify-between w-full gap-2 rounded px-1 py-0.5 hover:bg-bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        aria-label={`Filter applications to ${s.name} tier (${s.count})`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: s.color }}
                            aria-hidden
                          />
                          <span className="text-fg font-medium truncate">{s.name}</span>
                          <span className="text-fg-muted shrink-0">
                            · {creditSource[i]?.range ?? ''}
                          </span>
                        </span>
                        <span className="text-fg font-semibold tabular-nums shrink-0">
                          {s.count}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ─── Recent applications table ─── */}
        <Card>
          <CardHeader
            title={<span className="text-[14px]">Recent Applications</span>}
            action={
              <Link
                href={`/v/${brandSlug}/applications`}
                aria-label={`View all ${productLabelForBrand(brand)} applications`}
                className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
                style={{ color: spec.accentHex }}
              >
                View all <ArrowRightIcon size={12} aria-hidden />
              </Link>
            }
          />
          <CardBody padded={false}>
            {recent.length === 0 ? (
              <p className="px-5 py-10 text-center text-fg-muted text-[13px]" role="status">
                No activity yet for {productLabelForBrand(brand)}.
              </p>
            ) : (
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Recent applications"
                tabIndex={0}
              >
                <table className="w-full min-w-[640px] text-[12px]">
                  <caption className="sr-only">
                    {recent.length} most recent {productLabelForBrand(brand)} applications
                  </caption>
                  <thead className="bg-bg-muted/40 text-fg-muted">
                    <tr className="text-left">
                      <th
                        scope="col"
                        className="px-5 py-2.5 font-semibold tracking-[0.06em] text-[10px] uppercase"
                      >
                        Client
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2.5 font-semibold tracking-[0.06em] text-[10px] uppercase"
                      >
                        Amount
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2.5 font-semibold tracking-[0.06em] text-[10px] uppercase"
                      >
                        Product
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2.5 font-semibold tracking-[0.06em] text-[10px] uppercase"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-2.5 font-semibold tracking-[0.06em] text-[10px] uppercase"
                      >
                        Submitted
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recent.map((a) => {
                      const pill = applicationStatusToPill(a.status);
                      return (
                        <tr key={a.id} className="hover:bg-bg-muted/40 transition-colors group">
                          <td className="p-0">
                            <Link
                              href={`/v/${brandSlug}/applications/${a.id}`}
                              className="block px-5 py-3"
                              aria-label={`Open application ${a.customer}`}
                            >
                              <span className="font-medium text-fg">{a.customer}</span>
                              <span className="block text-[11px] text-fg-muted">{a.partner}</span>
                            </Link>
                          </td>
                          <td className="p-0">
                            <Link
                              href={`/v/${brandSlug}/applications/${a.id}`}
                              className="block px-3 py-3 tabular-nums text-fg font-medium"
                              tabIndex={-1}
                            >
                              {fmtUsd(a.amountCents)}
                            </Link>
                          </td>
                          <td className="p-0">
                            <Link
                              href={`/v/${brandSlug}/applications/${a.id}`}
                              className="block px-3 py-3 text-fg-secondary"
                              tabIndex={-1}
                            >
                              {productLabelForBrand(brand)}
                            </Link>
                          </td>
                          <td className="p-0">
                            <Link
                              href={`/v/${brandSlug}/applications/${a.id}`}
                              className="block px-3 py-3"
                              tabIndex={-1}
                            >
                              <StatusPill tone={pill.tone} dot>
                                {pill.label}
                              </StatusPill>
                            </Link>
                          </td>
                          <td className="p-0">
                            <Link
                              href={`/v/${brandSlug}/applications/${a.id}`}
                              className="block px-5 py-3 tabular-nums text-fg-muted"
                              tabIndex={-1}
                            >
                              {fmtDateDDMMYYYY(a.date)}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
