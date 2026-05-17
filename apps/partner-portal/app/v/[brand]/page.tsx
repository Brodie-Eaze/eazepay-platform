'use client';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { useMemo } from 'react';
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
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { applications, type ApplicationRow } from '../../../lib/master-data';
import { currentPartnerForBrand, partnerShareOfBrand } from '../../../lib/partner-profile';

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

const KpiTile = ({
  label,
  value,
  deltaPct,
  icon,
  goodWhenDown = false,
}: {
  label: string;
  value: string;
  deltaPct: number;
  icon: React.ReactNode;
  goodWhenDown?: boolean;
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

  return (
    <div className="relative flex flex-col justify-between rounded-lg border border-border bg-bg-elevated px-4 py-3.5 shadow-sm min-h-[110px]">
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
    </div>
  );
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

  /**
   * The dashboard snapshot, scaled down from brand-aggregate to the
   * signed-in partner's slice. Volumes (submitted / approved / funded
   * / declined / dollars / monthly bars) are scaled by partnerShare;
   * rates and credit-mix percentages stay unchanged because they're
   * already partner-invariant.
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
      // Credit mix is partner-invariant (the rate distribution doesn't
      // change just because we're looking at one partner), but the
      // COUNTS should be scaled down so the donut total feels right
      // for the partner's volume.
      creditMix: brandSnapshot.creditMix.map((c) => ({ ...c, count: scaleInt(c.count) })),
    };
  }, [brandSnapshot, partner, partnerShare]);

  // Recent applications — scoped to the signed-in partner. Filter
  // master-data + synthesised rows by partner.legalName (the `partner`
  // string field on ApplicationRow). Both datasets are pre-tagged.
  const recent = useMemo(() => {
    if (!partner) return [];
    const synth = synthesisedFor(productBrand);
    const fromMaster = applications.filter((a) => a.partner === partner.legalName);
    const fromSynth = synth.filter((a) => a.partner === partner.legalName);
    return [...fromSynth, ...fromMaster]
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6);
  }, [partner, productBrand]);

  // Donut palette. Prime gets the brand accent so each portal feels
  // tinted without recolouring the whole chart.
  const donutSegments = useMemo(() => {
    const palette: Record<'Prime' | 'NearPrime' | 'Subprime' | 'DeepSubprime', string> = {
      Prime: spec.accentHex,
      NearPrime: '#94a3b8',
      Subprime: '#cbd5e1',
      DeepSubprime: '#e2e8f0',
    };
    return snapshot.creditMix.map((c) => ({
      name: c.name,
      count: c.count,
      color: palette[c.name],
    }));
  }, [snapshot.creditMix, spec.accentHex]);

  const creditTotal = snapshot.creditMix.reduce((s, c) => s + c.count, 0);

  // Y-axis caps for the bar charts — round up to the nearest 25 above
  // the series max, with a fallback so empty series still render.
  const subsMax = Math.max(...snapshot.monthlySubmissions.map((d) => d.value), 1);
  const subsYMax = Math.max(100, Math.ceil(subsMax / 25) * 25);
  const fundedMax = Math.max(...snapshot.monthlyFunded.map((d) => d.value), 1);
  const fundedYMax = Math.max(50, Math.ceil(fundedMax / 25) * 25);

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
        {/* ─── 6-KPI grid ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          <KpiTile
            label="Total submitted"
            value={String(snapshot.totalSubmitted)}
            deltaPct={snapshot.totalSubmittedDeltaPct}
            icon={<DocIcon size={16} />}
          />
          <KpiTile
            label="Approved"
            value={String(snapshot.approved)}
            deltaPct={snapshot.approvedDeltaPct}
            icon={<CheckIcon size={16} />}
          />
          <KpiTile
            label="Funded"
            value={String(snapshot.funded)}
            deltaPct={snapshot.fundedDeltaPct}
            icon={<DollarIcon size={16} />}
          />
          <KpiTile
            label="Declined"
            value={String(snapshot.declined)}
            deltaPct={snapshot.declinedDeltaPct}
            icon={<XIcon size={16} />}
            goodWhenDown
          />
          <KpiTile
            label="Total funded"
            value={fmtCompactUsd(snapshot.totalFundedCents)}
            deltaPct={snapshot.totalFundedDeltaPct}
            icon={<DollarIcon size={16} />}
          />
          <KpiTile
            label="Pending payout"
            value={fmtCompactUsd(snapshot.pendingPayoutCents)}
            deltaPct={snapshot.pendingPayoutDeltaPct}
            icon={<ClockIcon size={16} />}
          />
        </div>

        {/* ─── Chart row: Submissions · Funded · Credit Insights ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
          <Card>
            <CardHeader
              title={<span className="text-[14px]">Monthly Submissions</span>}
              description={<span className="text-[12px]">Application volume over time</span>}
            />
            <CardBody className="pt-3">
              <BarChart data={snapshot.monthlySubmissions} yMax={subsYMax} yStep={subsYMax / 2} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={<span className="text-[14px]">Monthly Funded</span>}
              description={<span className="text-[12px]">Funded deals over time</span>}
            />
            <CardBody className="pt-3">
              <BarChart data={snapshot.monthlyFunded} yMax={fundedYMax} yStep={fundedYMax / 2} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={<span className="text-[14px]">Credit Insights</span>}
              description={<span className="text-[12px]">FICO mix of this period</span>}
            />
            <CardBody className="pt-3">
              <div className="flex flex-col items-center">
                <DonutChart segments={donutSegments} total={creditTotal} />
                <ul className="mt-4 w-full space-y-1.5">
                  {donutSegments.map((s, i) => (
                    <li key={s.name} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                          aria-hidden
                        />
                        <span className="text-fg font-medium truncate">{s.name}</span>
                        <span className="text-fg-muted shrink-0">
                          · {snapshot.creditMix[i]?.range ?? ''}
                        </span>
                      </span>
                      <span className="text-fg font-semibold tabular-nums shrink-0">{s.count}</span>
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
