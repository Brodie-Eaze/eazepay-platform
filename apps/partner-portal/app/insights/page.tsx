import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  KpiCard,
  StatusPill,
  Banner,
  Button,
  DataRow,
  ChartIcon,
  Sparkline,
  type StatusTone,
} from '@eazepay/ui/web';
import {
  approval30d,
  latency30d,
  declineReasonDistribution,
  ficoBandApproval,
} from '../../lib/mock-data';
import { marketplaceLenders, marketplaces, tierLabel } from '../../lib/marketplace-data';

/* ----------------------------------------------------------------------- */
/*  Inline data — institutional-grade dummy figures                         */
/* ----------------------------------------------------------------------- */

interface FunnelStep {
  label: string;
  volume: number;
  dwellMedianMs: number;
}

const funnelSteps: FunnelStep[] = [
  { label: 'Applications submitted', volume: 4_184, dwellMedianMs: 0 },
  { label: 'Pre-qual passed', volume: 3_612, dwellMedianMs: 1_120 },
  { label: 'KYC verified', volume: 3_409, dwellMedianMs: 8_400 },
  { label: 'Decisioned', volume: 3_287, dwellMedianMs: 528 },
  { label: 'Approved', volume: 2_011, dwellMedianMs: 712 },
  { label: 'Funded', volume: 1_842, dwellMedianMs: 8_040_000 }, // ~2h14m
];

interface LenderWinRow {
  id: string;
  lender: string;
  marketplace: string;
  routed: number;
  approvalRate: number; // 0..1
  avgAprBps: number;
  stipRate: number; // 0..1
  slaP95Ms: number;
  status: 'active' | 'paused' | 'degraded';
}

const lenderWinRows: LenderWinRow[] = [
  {
    id: 'ml_eng_helia_med',
    lender: 'Helia Medical',
    marketplace: 'engine.tech',
    routed: 624,
    approvalRate: 0.718,
    avgAprBps: 1199,
    stipRate: 0.082,
    slaP95Ms: 642,
    status: 'active',
  },
  {
    id: 'ml_eng_sageheal',
    lender: 'SageHeal',
    marketplace: 'engine.tech',
    routed: 412,
    approvalRate: 0.581,
    avgAprBps: 1849,
    stipRate: 0.141,
    slaP95Ms: 781,
    status: 'active',
  },
  {
    id: 'ml_eng_orion_trade',
    lender: 'Orion Capital',
    marketplace: 'engine.tech',
    routed: 318,
    approvalRate: 0.762,
    avgAprBps: 1049,
    stipRate: 0.061,
    slaP95Ms: 511,
    status: 'active',
  },
  {
    id: 'ml_eng_kestrel_trade',
    lender: 'Kestrel',
    marketplace: 'engine.tech',
    routed: 244,
    approvalRate: 0.593,
    avgAprBps: 1599,
    stipRate: 0.118,
    slaP95Ms: 698,
    status: 'active',
  },
  {
    id: 'ml_eng_atlas_coach',
    lender: 'Atlas Career Cap',
    marketplace: 'engine.tech',
    routed: 188,
    approvalRate: 0.804,
    avgAprBps: 999,
    stipRate: 0.052,
    slaP95Ms: 478,
    status: 'active',
  },
  {
    id: 'ml_eng_clearpath_coach',
    lender: 'ClearPath',
    marketplace: 'engine.tech',
    routed: 142,
    approvalRate: 0.512,
    avgAprBps: 1999,
    stipRate: 0.162,
    slaP95Ms: 904,
    status: 'degraded',
  },
  {
    id: 'ml_eng_summit_premier',
    lender: 'Summit Premier',
    marketplace: 'engine.tech',
    routed: 96,
    approvalRate: 0.881,
    avgAprBps: 849,
    stipRate: 0.031,
    slaP95Ms: 412,
    status: 'active',
  },
  {
    id: 'ml_in_buzzpay',
    lender: 'BuzzPay',
    marketplace: 'EazePay direct',
    routed: 712,
    approvalRate: 0.684,
    avgAprBps: 1349,
    stipRate: 0.072,
    slaP95Ms: 218,
    status: 'active',
  },
  {
    id: 'ml_partner_evergreen',
    lender: 'Evergreen Prime',
    marketplace: 'EazePay direct',
    routed: 487,
    approvalRate: 0.741,
    avgAprBps: 1099,
    stipRate: 0.058,
    slaP95Ms: 612,
    status: 'active',
  },
  {
    id: 'ml_partner_sterling',
    lender: 'Sterling Direct',
    marketplace: 'EazePay direct',
    routed: 354,
    approvalRate: 0.612,
    avgAprBps: 1499,
    stipRate: 0.094,
    slaP95Ms: 821,
    status: 'active',
  },
  {
    id: 'ml_partner_pinegrove',
    lender: 'Pinegrove Capital',
    marketplace: 'Partner Network',
    routed: 211,
    approvalRate: 0.498,
    avgAprBps: 2199,
    stipRate: 0.184,
    slaP95Ms: 1102,
    status: 'paused',
  },
];

/* Brand × FICO small-multiples */
const brandFicoApproval: Record<string, { label: string; value: number }[]> = {
  MedPay: [
    { label: '<620', value: 0.06 },
    { label: '620-659', value: 0.26 },
    { label: '660-699', value: 0.63 },
    { label: '700-739', value: 0.82 },
    { label: '740-779', value: 0.9 },
    { label: '780+', value: 0.95 },
  ],
  TradePay: [
    { label: '<620', value: 0.02 },
    { label: '620-659', value: 0.18 },
    { label: '660-699', value: 0.52 },
    { label: '700-739', value: 0.74 },
    { label: '740-779', value: 0.86 },
    { label: '780+', value: 0.93 },
  ],
  CoachPay: [
    { label: '<620', value: 0.04 },
    { label: '620-659', value: 0.22 },
    { label: '660-699', value: 0.6 },
    { label: '700-739', value: 0.79 },
    { label: '740-779', value: 0.89 },
    { label: '780+', value: 0.94 },
  ],
};

/* Conversion-by-vertical heatmap — 6 rows × 3 cols */
const conversionRows: { label: string; medpay: number; tradepay: number; coachpay: number }[] = [
  { label: 'Pre-qual', medpay: 0.92, tradepay: 0.88, coachpay: 0.9 },
  { label: 'KYC', medpay: 0.97, tradepay: 0.94, coachpay: 0.96 },
  { label: 'Decisioned', medpay: 0.89, tradepay: 0.82, coachpay: 0.87 },
  { label: 'Approved', medpay: 0.74, tradepay: 0.61, coachpay: 0.68 },
  { label: 'Accepted', medpay: 0.68, tradepay: 0.56, coachpay: 0.6 },
  { label: 'Funded', medpay: 0.63, tradepay: 0.51, coachpay: 0.55 },
];

/* Vintage performance triangle — 12 months × 6 windows (0/30/60/90/120/180+) */
const vintageMonths = [
  '2025-06',
  '2025-07',
  '2025-08',
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
];
const vintageWindowLabels = ['0d', '30d', '60d', '90d', '120d', '180d+'];
// % delinquent (0-1). Triangular — most recent months only have early windows reported.
const vintageMatrix: (number | null)[][] = [
  [0.001, 0.011, 0.018, 0.022, 0.026, 0.031],
  [0.001, 0.01, 0.017, 0.021, 0.025, 0.029],
  [0.001, 0.012, 0.019, 0.023, 0.027, 0.03],
  [0.001, 0.013, 0.02, 0.024, 0.028, null],
  [0.001, 0.012, 0.018, 0.022, null, null],
  [0.001, 0.011, 0.017, 0.021, null, null],
  [0.001, 0.011, 0.018, null, null, null],
  [0.002, 0.014, 0.021, null, null, null],
  [0.002, 0.015, 0.022, null, null, null],
  [0.002, 0.016, null, null, null, null], // Q1 2026 trending high
  [0.001, 0.014, null, null, null, null],
  [0.001, null, null, null, null, null],
];

/* APR distribution — 25 buckets from 4.99% to 29.99% */
const aprBuckets = (() => {
  // approximate log-normal-ish around ~13%
  const peaks = [
    3, 9, 18, 34, 62, 95, 128, 154, 168, 162, 144, 121, 104, 88, 72, 58, 46, 35, 27, 21, 16, 12, 9,
    6, 4,
  ];
  const start = 4.99;
  const step = (29.99 - 4.99) / (peaks.length - 1);
  return peaks.map((count, i) => ({
    apr: start + i * step,
    count,
  }));
})();

/* APR by lender × tier */
const lenderTierApr: {
  lender: string;
  primeBps: number | null;
  nearPrimeBps: number | null;
  subPrimeBps: number | null;
  deepSubBps: number | null;
}[] = [
  {
    lender: 'Helia Medical',
    primeBps: 999,
    nearPrimeBps: 1399,
    subPrimeBps: null,
    deepSubBps: null,
  },
  { lender: 'SageHeal', primeBps: 1199, nearPrimeBps: 1599, subPrimeBps: 2099, deepSubBps: null },
  {
    lender: 'Orion Capital',
    primeBps: 849,
    nearPrimeBps: 1199,
    subPrimeBps: null,
    deepSubBps: null,
  },
  { lender: 'Kestrel', primeBps: 1099, nearPrimeBps: 1499, subPrimeBps: 1899, deepSubBps: null },
  {
    lender: 'Atlas Career Cap',
    primeBps: 799,
    nearPrimeBps: null,
    subPrimeBps: null,
    deepSubBps: null,
  },
  { lender: 'ClearPath', primeBps: 1299, nearPrimeBps: 1799, subPrimeBps: 2299, deepSubBps: 2799 },
  {
    lender: 'Summit Premier',
    primeBps: 749,
    nearPrimeBps: null,
    subPrimeBps: null,
    deepSubBps: null,
  },
  { lender: 'BuzzPay', primeBps: 1099, nearPrimeBps: 1399, subPrimeBps: 1899, deepSubBps: null },
  {
    lender: 'Evergreen Prime',
    primeBps: 899,
    nearPrimeBps: 1299,
    subPrimeBps: null,
    deepSubBps: null,
  },
  {
    lender: 'Sterling Direct',
    primeBps: 1199,
    nearPrimeBps: 1599,
    subPrimeBps: 1999,
    deepSubBps: 2499,
  },
];

/* State coverage — top 10 funded volume */
interface StateRow {
  code: string;
  name: string;
  fundedCents: number;
  fundedCount: number;
  status: 'live' | 'restricted';
  note?: string;
}
const stateCoverage: StateRow[] = [
  { code: 'CA', name: 'California', fundedCents: 1_204_180_00, fundedCount: 318, status: 'live' },
  { code: 'TX', name: 'Texas', fundedCents: 982_410_00, fundedCount: 287, status: 'live' },
  { code: 'FL', name: 'Florida', fundedCents: 891_220_00, fundedCount: 261, status: 'live' },
  {
    code: 'NY',
    name: 'New York',
    fundedCents: 612_840_00,
    fundedCount: 168,
    status: 'restricted',
    note: 'Rate cap 16% APR — sub-set of lenders',
  },
  { code: 'IL', name: 'Illinois', fundedCents: 401_120_00, fundedCount: 121, status: 'live' },
  { code: 'GA', name: 'Georgia', fundedCents: 388_640_00, fundedCount: 119, status: 'live' },
  { code: 'NC', name: 'N. Carolina', fundedCents: 321_840_00, fundedCount: 104, status: 'live' },
  { code: 'AZ', name: 'Arizona', fundedCents: 298_120_00, fundedCount: 91, status: 'live' },
  { code: 'WA', name: 'Washington', fundedCents: 281_440_00, fundedCount: 86, status: 'live' },
  { code: 'CO', name: 'Colorado', fundedCents: 218_960_00, fundedCount: 74, status: 'live' },
];

/* Fair-lending — 4×3 disparate impact grid */
const disparateImpact: {
  dim: string;
  ageGroup: boolean;
  sex: boolean;
  raceProxy: boolean;
  geography: boolean;
}[] = [
  { dim: '4/5 rule (selection)', ageGroup: true, sex: true, raceProxy: true, geography: true },
  { dim: 'Approval-rate parity', ageGroup: true, sex: true, raceProxy: true, geography: false },
  { dim: 'APR-distribution parity', ageGroup: true, sex: true, raceProxy: true, geography: true },
  {
    dim: 'Adverse-action consistency',
    ageGroup: true,
    sex: true,
    raceProxy: true,
    geography: true,
  },
];

/* Equalized odds delta */
const equalizedOdds: { className: string; dTpr: number; dFpr: number; dFnr: number }[] = [
  { className: 'Age 62+', dTpr: 0.018, dFpr: 0.012, dFnr: -0.018 },
  { className: 'Sex (female)', dTpr: -0.011, dFpr: 0.008, dFnr: 0.011 },
  { className: 'Race proxy (BISG)', dTpr: 0.022, dFpr: 0.014, dFnr: -0.022 },
  { className: 'Geography (HMDA tract)', dTpr: 0.014, dFpr: 0.009, dFnr: -0.014 },
];

/* Sample overrides */
const overrideSamples: {
  id: string;
  brand: string;
  ficoBand: string;
  direction: 'up' | 'down';
  rationale: string;
  reviewedAt: string;
}[] = [
  {
    id: 'ovr_2026_05_04_A8K',
    brand: 'MedPay',
    ficoBand: '640-659',
    direction: 'up',
    rationale: 'Cashflow stability 88; income verified 2yr; manual approval inside policy.',
    reviewedAt: '2026-05-07',
  },
  {
    id: 'ovr_2026_05_02_R2N',
    brand: 'TradePay',
    ficoBand: '700-739',
    direction: 'down',
    rationale: 'Recent BK chapter 13 not surfaced by bureau pull — manual decline.',
    reviewedAt: '2026-05-05',
  },
  {
    id: 'ovr_2026_05_01_KvL',
    brand: 'CoachPay',
    ficoBand: '660-699',
    direction: 'up',
    rationale: 'Co-borrower added post-decision; combined DTI 31%.',
    reviewedAt: '2026-05-04',
  },
];

/* Recent decision sample */
interface DecisionRow {
  appId: string;
  initials: string;
  brand: 'MedPay' | 'TradePay' | 'CoachPay';
  fico: number;
  requestedCents: number;
  decision: 'approved' | 'declined' | 'manual_review';
  reason: string;
  lender: string;
  ttdMs: number;
}
const recentDecisions: DecisionRow[] = [
  {
    appId: '4nqLkR2vTjW',
    initials: 'J.M.',
    brand: 'TradePay',
    fico: 762,
    requestedCents: 1_850_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'Evergreen Prime',
    ttdMs: 612,
  },
  {
    appId: '8mRT2WQpKvN',
    initials: 'D.K.',
    brand: 'MedPay',
    fico: 718,
    requestedCents: 720_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'Helia Medical',
    ttdMs: 488,
  },
  {
    appId: '9xQpL4mNkjT',
    initials: 'A.R.',
    brand: 'CoachPay',
    fico: 642,
    requestedCents: 1_200_000,
    decision: 'declined',
    reason: 'debt_to_income_high',
    lender: '—',
    ttdMs: 734,
  },
  {
    appId: '2KvNRpL8mqT',
    initials: 'S.P.',
    brand: 'TradePay',
    fico: 798,
    requestedCents: 2_500_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'Summit Premier',
    ttdMs: 421,
  },
  {
    appId: '5NQpRT8mvK2',
    initials: 'L.W.',
    brand: 'TradePay',
    fico: 681,
    requestedCents: 980_000,
    decision: 'manual_review',
    reason: 'income_verification',
    lender: 'queued',
    ttdMs: 0,
  },
  {
    appId: '7tpQR2NvKmL',
    initials: 'R.B.',
    brand: 'MedPay',
    fico: 731,
    requestedCents: 450_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'BuzzPay',
    ttdMs: 552,
  },
  {
    appId: 'KvNRT8mQp2L',
    initials: 'M.T.',
    brand: 'MedPay',
    fico: 598,
    requestedCents: 1_500_000,
    decision: 'declined',
    reason: 'min_fico_floor',
    lender: '—',
    ttdMs: 87,
  },
  {
    appId: 'RT8mQp2KvNL',
    initials: 'E.H.',
    brand: 'TradePay',
    fico: 802,
    requestedCents: 3_200_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'Summit Premier',
    ttdMs: 503,
  },
  {
    appId: 'p2KvNRT8mQL',
    initials: 'T.C.',
    brand: 'CoachPay',
    fico: 704,
    requestedCents: 320_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'Atlas Career Cap',
    ttdMs: 461,
  },
  {
    appId: 'pLKvNRT8mQT',
    initials: 'B.D.',
    brand: 'CoachPay',
    fico: 656,
    requestedCents: 580_000,
    decision: 'declined',
    reason: 'insufficient_stability',
    lender: '—',
    ttdMs: 612,
  },
  {
    appId: 'mQp2KvNRT8L',
    initials: 'I.O.',
    brand: 'MedPay',
    fico: 689,
    requestedCents: 920_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'Helia Medical',
    ttdMs: 541,
  },
  {
    appId: 'NRT8mQp2KvL',
    initials: 'N.F.',
    brand: 'TradePay',
    fico: 633,
    requestedCents: 1_100_000,
    decision: 'declined',
    reason: 'recent_delinquency_60d',
    lender: '—',
    ttdMs: 588,
  },
  {
    appId: 'T8mQp2KvNRL',
    initials: 'C.M.',
    brand: 'TradePay',
    fico: 742,
    requestedCents: 1_980_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'Orion Capital',
    ttdMs: 491,
  },
  {
    appId: 'QpL8mRT2NvK',
    initials: 'G.A.',
    brand: 'CoachPay',
    fico: 712,
    requestedCents: 480_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'Atlas Career Cap',
    ttdMs: 522,
  },
  {
    appId: 'L8mRT2NvKqp',
    initials: 'K.S.',
    brand: 'MedPay',
    fico: 671,
    requestedCents: 640_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'SageHeal',
    ttdMs: 681,
  },
  {
    appId: '2NvKqpL8mRT',
    initials: 'P.R.',
    brand: 'TradePay',
    fico: 588,
    requestedCents: 720_000,
    decision: 'declined',
    reason: 'min_fico_floor',
    lender: '—',
    ttdMs: 92,
  },
  {
    appId: 'vKqpL8mRT2N',
    initials: 'O.G.',
    brand: 'MedPay',
    fico: 754,
    requestedCents: 1_150_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'Helia Medical',
    ttdMs: 478,
  },
  {
    appId: 'pL8mRT2NvKq',
    initials: 'F.E.',
    brand: 'TradePay',
    fico: 695,
    requestedCents: 1_350_000,
    decision: 'manual_review',
    reason: 'collateral_review',
    lender: 'queued',
    ttdMs: 0,
  },
  {
    appId: 'mRT2NvKqpL8',
    initials: 'H.W.',
    brand: 'CoachPay',
    fico: 681,
    requestedCents: 280_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'ClearPath',
    ttdMs: 612,
  },
  {
    appId: 'RT2NvKqpL8m',
    initials: 'V.N.',
    brand: 'MedPay',
    fico: 728,
    requestedCents: 880_000,
    decision: 'approved',
    reason: 'within_policy',
    lender: 'BuzzPay',
    ttdMs: 412,
  },
];

/* ----------------------------------------------------------------------- */
/*  Helpers                                                                 */
/* ----------------------------------------------------------------------- */

const fmtPct = (n: number, decimals = 1) => `${(n * 100).toFixed(decimals)}%`;
const fmtBps = (bps: number | null) => (bps == null ? '—' : `${(bps / 100).toFixed(2)}%`);
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);
const fmtDwell = (ms: number) => {
  if (ms === 0) return '—';
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
};
const fmtCompactUsd = (cents: number) => {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars / 1_000)}K`;
  return `$${dollars.toFixed(0)}`;
};

const seriesA = approval30d.map((v) => v * 100);
const seriesL = latency30d;
const seriesFunded = [
  38, 41, 39, 42, 38, 36, 41, 44, 47, 49, 51, 47, 49, 52, 48, 51, 54, 56, 54, 57, 59, 61, 58, 60,
  62, 64, 63, 65, 66, 67,
];
const seriesDollars = [
  310, 332, 308, 351, 322, 298, 341, 367, 388, 412, 421, 388, 401, 432, 408, 429, 451, 472, 461,
  488, 502, 521, 498, 514, 528, 542, 537, 552, 561, 572,
];
const seriesPullthrough = [
  40, 41, 39, 42, 41, 42, 43, 42, 44, 45, 44, 43, 45, 46, 44, 45, 46, 47, 46, 46, 47, 48, 47, 47,
  48, 48, 48, 47, 48, 47.8,
];
const seriesAvgSize = [
  11.8, 12.1, 11.9, 12.4, 12.0, 12.3, 12.5, 12.7, 12.6, 12.8, 13.0, 12.9, 13.1, 13.2, 13.0, 13.1,
  13.3, 13.4, 13.3, 13.5, 13.6, 13.7, 13.5, 13.6, 13.7, 13.8, 13.7, 13.8, 13.9, 13.86,
];
const seriesLift = [
  4.1, 4.2, 4.0, 4.3, 4.2, 4.1, 4.4, 4.5, 4.6, 4.7, 4.8, 4.6, 4.7, 4.9, 4.8, 4.8, 5.0, 5.1, 5.0,
  5.1, 5.2, 5.3, 5.2, 5.2, 5.3, 5.4, 5.3, 5.4, 5.5, 5.42,
];
const seriesManualReview = [
  9.8, 9.6, 9.5, 9.4, 9.2, 9.0, 8.9, 8.8, 8.7, 8.6, 8.5, 8.5, 8.4, 8.4, 8.3, 8.3, 8.2, 8.2, 8.1,
  8.1, 8.0, 8.0, 7.9, 7.9, 7.8, 7.8, 7.8, 7.7, 7.7, 7.6,
];

/* ----------------------------------------------------------------------- */
/*  Inline SVG visual primitives                                            */
/* ----------------------------------------------------------------------- */

/* Bar chart with optional value labels and grid */
function LabeledBarChart({
  data,
  height = 160,
  width = 480,
  formatValue,
  highlightIndex,
}: {
  data: { label: string; value: number }[];
  height?: number;
  width?: number;
  formatValue?: (v: number) => string;
  highlightIndex?: number;
}) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const padTop = 18;
  const padBottom = 20;
  const chartH = height - padTop - padBottom;
  const barWidth = width / data.length - 8;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="text-accent"
    >
      {/* grid lines */}
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={0}
          x2={width}
          y1={padTop + chartH * (1 - t)}
          y2={padTop + chartH * (1 - t)}
          stroke="currentColor"
          opacity={0.08}
          strokeDasharray="2 4"
        />
      ))}
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * chartH);
        const x = i * (barWidth + 8) + 4;
        const y = padTop + chartH - h;
        const isHighlight = i === highlightIndex;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={2}
              fill="currentColor"
              opacity={isHighlight ? 1 : 0.78}
            />
            <text
              x={x + barWidth / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize="9.5"
              fill="currentColor"
              opacity={0.78}
              className="font-medium"
            >
              {formatValue ? formatValue(d.value) : d.value}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              opacity={0.55}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* Histogram for APR distribution */
function HistogramChart({
  buckets,
  height = 180,
  width = 720,
  medianApr,
  p75Apr,
}: {
  buckets: { apr: number; count: number }[];
  height?: number;
  width?: number;
  medianApr: number;
  p75Apr: number;
}) {
  const max = Math.max(...buckets.map((b) => b.count));
  const padTop = 24;
  const padBottom = 24;
  const padX = 18;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;
  const barW = chartW / buckets.length - 1.5;
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const aprMin = first ? first.apr : 0;
  const aprMax = last ? last.apr : 1;
  const aprToX = (apr: number) => padX + ((apr - aprMin) / (aprMax - aprMin)) * chartW;
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="text-chart-2"
    >
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={padX}
          x2={width - padX}
          y1={padTop + chartH * (1 - t)}
          y2={padTop + chartH * (1 - t)}
          stroke="currentColor"
          opacity={0.08}
          strokeDasharray="2 4"
        />
      ))}
      {buckets.map((b, i) => {
        const h = Math.max(1.5, (b.count / max) * chartH);
        const x = padX + i * (barW + 1.5);
        const y = padTop + chartH - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={1.5}
            fill="currentColor"
            opacity={0.78}
          />
        );
      })}
      {/* Median + p75 annotations */}
      {[
        { v: medianApr, label: `Median ${medianApr.toFixed(2)}%`, dash: '0' },
        { v: p75Apr, label: `p75 ${p75Apr.toFixed(2)}%`, dash: '4 3' },
      ].map((m) => (
        <g key={m.label}>
          <line
            x1={aprToX(m.v)}
            x2={aprToX(m.v)}
            y1={padTop - 4}
            y2={padTop + chartH}
            stroke="currentColor"
            strokeWidth={1.25}
            strokeDasharray={m.dash}
            opacity={0.9}
          />
          <text
            x={aprToX(m.v) + 4}
            y={padTop + 8}
            fontSize="9.5"
            fill="currentColor"
            opacity={0.95}
            className="font-medium"
          >
            {m.label}
          </text>
        </g>
      ))}
      {/* x-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const apr = aprMin + t * (aprMax - aprMin);
        return (
          <text
            key={t}
            x={padX + chartW * t}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill="currentColor"
            opacity={0.6}
          >
            {apr.toFixed(2)}%
          </text>
        );
      })}
    </svg>
  );
}

/* Funnel — horizontal stepped bars with drop-off */
function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = steps[0]?.volume ?? 1;
  return (
    <div className="grid gap-1.5">
      {steps.map((s, i) => {
        const widthPct = (s.volume / max) * 100;
        const prevStep = i > 0 ? steps[i - 1] : undefined;
        const prev = prevStep?.volume ?? null;
        const dropPct = prev != null ? 1 - s.volume / prev : null;
        const conversionFromTop = s.volume / max;
        return (
          <div
            key={s.label}
            className="grid grid-cols-[180px_1fr_64px_64px_72px] gap-3 items-center text-[12px]"
          >
            <div className="text-fg-secondary font-medium truncate">{s.label}</div>
            <div className="relative h-6 rounded bg-bg-muted/40 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-chart-2/80 flex items-center pl-2 text-fg-on-accent text-[11px] font-semibold tabular-nums"
                style={{ width: `${widthPct}%` }}
              >
                {s.volume.toLocaleString()}
              </div>
            </div>
            <div className="text-right tabular-nums text-fg-secondary font-medium">
              {fmtPct(conversionFromTop, 1)}
            </div>
            <div
              className={`text-right tabular-nums ${dropPct != null && dropPct > 0.15 ? 'text-warning' : 'text-fg-muted'}`}
            >
              {dropPct == null ? '—' : `-${(dropPct * 100).toFixed(1)}%`}
            </div>
            <div className="text-right tabular-nums text-fg-muted">{fmtDwell(s.dwellMedianMs)}</div>
          </div>
        );
      })}
      <div className="grid grid-cols-[180px_1fr_64px_64px_72px] gap-3 items-center text-[10px] uppercase tracking-wider text-fg-muted font-semibold mt-1 pt-2 border-t border-border">
        <div>Step</div>
        <div>Volume</div>
        <div className="text-right">% of top</div>
        <div className="text-right">Drop-off</div>
        <div className="text-right">Median dwell</div>
      </div>
    </div>
  );
}

/* Heatmap cell — opacity scales with value (0-1) */
function HeatCell({
  value,
  label,
  intensity = 'accent',
}: {
  value: number | null;
  label?: string;
  intensity?: 'accent' | 'danger' | 'warning';
}) {
  if (value == null) {
    return (
      <div className="h-9 rounded-sm bg-bg-muted/30 border border-border/40 flex items-center justify-center text-[10px] text-fg-muted/60">
        —
      </div>
    );
  }
  const opacity = Math.max(0.12, Math.min(1, value * 1.05));
  const color =
    intensity === 'danger'
      ? 'rgb(var(--danger))'
      : intensity === 'warning'
        ? 'rgb(var(--warning))'
        : 'rgb(var(--chart-2))';
  const textWhite = opacity > 0.55;
  return (
    <div
      className={`h-9 rounded-sm border border-border/40 flex items-center justify-center text-[11px] font-semibold tabular-nums ${textWhite ? 'text-fg-on-accent' : 'text-fg'}`}
      style={{ backgroundColor: color, opacity: Math.max(0.92, opacity) === 1 ? 1 : undefined }}
    >
      <span style={{ opacity: 1 / Math.max(0.4, opacity) > 1.6 ? undefined : 1 }}>
        {label ?? fmtPct(value, 0)}
      </span>
      <span className="sr-only">{value}</span>
      <div
        className="absolute inset-0 rounded-sm"
        style={{ background: color, opacity }}
        aria-hidden
      />
    </div>
  );
}

/* Clean heat cell — divs only, no SR-only weirdness */
function ConversionCell({ value }: { value: number }) {
  const opacity = Math.max(0.15, Math.min(0.95, value));
  const textWhite = opacity > 0.55;
  return (
    <div
      className={`h-9 rounded-sm flex items-center justify-center text-[11.5px] font-semibold tabular-nums ${textWhite ? 'text-white' : 'text-fg'}`}
      style={{ backgroundColor: `rgb(var(--chart-2) / ${opacity})` }}
    >
      {(value * 100).toFixed(0)}%
    </div>
  );
}

function VintageCell({ value }: { value: number | null }) {
  if (value == null) {
    return <div className="h-7 rounded-sm bg-bg-muted/30 border border-border/40" />;
  }
  // delinquency 0..0.03 mapped to opacity
  const norm = Math.min(1, value / 0.035);
  const opacity = Math.max(0.12, norm);
  const textWhite = opacity > 0.5;
  return (
    <div
      className={`h-7 rounded-sm flex items-center justify-center text-[10px] font-semibold tabular-nums ${textWhite ? 'text-white' : 'text-fg'}`}
      style={{ backgroundColor: `rgb(var(--warning) / ${opacity})` }}
    >
      {(value * 100).toFixed(2)}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Page                                                                    */
/* ----------------------------------------------------------------------- */

export default function InsightsPage() {
  const medianApr = 12.85;
  const p75Apr = 17.42;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Partner Portal', href: '/' }, { label: 'Decisioning insights' }]}
        title="Decisioning insights"
        description="Approval, decline, latency, fair-lending, vintage, and per-lender win rate. Reproducible to policy version + input snapshot."
        actions={
          <>
            <Button variant="ghost" leadingIcon={<ChartIcon size={16} />}>
              Schedule report
            </Button>
            <Button>Download MIS pack</Button>
          </>
        }
        meta={
          <>
            <StatusPill tone="success" dot>
              Bias review — within tolerance
            </StatusPill>
            <StatusPill tone="info">Policy version orch_v_2026_05_a</StatusPill>
            <StatusPill tone="neutral">Cohort: last 30 days · 4,184 apps</StatusPill>
            <StatusPill tone="neutral">Refreshed 2026-05-15 04:00 UTC</StatusPill>
          </>
        }
      />
      <PageBody>
        <Banner intent="info" className="mb-5">
          The fair-lending monitoring engine evaluates disparate impact + equalized odds on each
          decisioned cohort weekly. Quarterly written review is exported to your bank-partner audit
          pack. All decisions reproducible from input snapshot + policy version orch_v_2026_05_a.
        </Banner>

        {/* ───────────────── B. 8-card KPI strip ───────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard
            label="Approval rate (30d)"
            value="61.2%"
            delta={{ value: '+2.1pp', direction: 'up', isGood: true }}
            series={seriesA}
          />
          <KpiCard
            label="Avg decision latency"
            value="528ms"
            delta={{ value: '-43ms', direction: 'down', isGood: true }}
            series={seriesL}
          />
          <KpiCard
            label="Decision-to-fund (median)"
            value="2h 14m"
            delta={{ value: '-18m', direction: 'down', isGood: true }}
            hint="RTP same-day · ACH next-day fallback"
          />
          <KpiCard
            label="Funded loans (30d)"
            value="1,842"
            delta={{ value: '+11.4%', direction: 'up', isGood: true }}
            series={seriesFunded}
          />
          <KpiCard
            label="Total $ funded (30d)"
            value="$25.54M"
            delta={{ value: '+14.2%', direction: 'up', isGood: true }}
            series={seriesDollars}
          />
          <KpiCard
            label="Pull-through (app → funded)"
            value="44.0%"
            delta={{ value: '+1.3pp', direction: 'up', isGood: true }}
            series={seriesPullthrough}
          />
          <KpiCard
            label="Avg loan size"
            value="$13,864"
            delta={{ value: '+$412', direction: 'up', isGood: true }}
            series={seriesAvgSize}
          />
          <KpiCard
            label="Net lift vs. baseline"
            value="+5.42pp"
            delta={{ value: '+0.34pp', direction: 'up', isGood: true }}
            series={seriesLift}
            hint="vs. single-lender control cohort"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
          <KpiCard
            label="Manual review rate"
            value="7.6%"
            delta={{ value: '-1.8pp', direction: 'down', isGood: true }}
            series={seriesManualReview}
            hint="QA-reviewed within 14d — 100%"
          />
          <KpiCard
            label="Stip clear rate"
            value="92.4%"
            delta={{ value: '+1.1pp', direction: 'up', isGood: true }}
            hint="Cleared within 48h SLA"
          />
          <KpiCard
            label="Adverse-action latency"
            value="42 min"
            delta={{ value: 'Reg B 30d ok', direction: 'flat' }}
            hint="Notice sent post-decline · 100% within 30 days"
          />
          <KpiCard
            label="Override audit coverage"
            value="100%"
            delta={{ value: '14-day QA', direction: 'flat' }}
            hint="14 overrides last 30d · 100% reviewed"
          />
        </div>

        {/* ───────────────── A. Volume & flow funnel ───────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="Application flow funnel (30 days)"
            description="Submitted → Pre-qual → KYC → Decisioned → Approved → Funded. Drop-off & median dwell per stage."
            action={<StatusPill tone="neutral">44.0% end-to-end</StatusPill>}
          />
          <CardBody>
            <FunnelChart steps={funnelSteps} />
            <div className="mt-3 text-[11.5px] text-fg-muted leading-relaxed">
              Largest drop occurs at the Decisioned → Approved step (38.8% loss) — consistent with
              the FICO floor + DTI threshold enforced by the orchestrator. Pre-qual to KYC stays in
              tight tolerance (5.6% drop). Funded conversion from approval = 91.6%.
            </div>
          </CardBody>
        </Card>

        {/* ───────────────── C. Lender win-rate table ───────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="Lender win-rate (30 days)"
            description={`${lenderWinRows.length} lenders across ${marketplaces.length} marketplaces. Routed = pre-qualified apps received; approval rate = approved / routed.`}
            action={
              <div className="flex items-center gap-2">
                <StatusPill tone="neutral">
                  Sources: {marketplaceLenders.length} lender configs · {marketplaces.length}{' '}
                  marketplaces
                </StatusPill>
              </div>
            }
          />
          <CardBody padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="bg-bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Lender
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Marketplace
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Apps routed
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Approval
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Avg APR
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Stip rate
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      SLA p95
                    </th>
                    <th className="px-4 py-2 text-center text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lenderWinRows.map((r) => {
                    const tone: StatusTone =
                      r.status === 'active'
                        ? 'success'
                        : r.status === 'degraded'
                          ? 'warning'
                          : 'neutral';
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border last:border-b-0 hover:bg-bg-muted/40"
                      >
                        <td className="px-4 py-2 font-medium">{r.lender}</td>
                        <td className="px-4 py-2 text-fg-muted">{r.marketplace}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {r.routed.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">
                          {fmtPct(r.approvalRate, 1)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmtBps(r.avgAprBps)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {fmtPct(r.stipRate, 1)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{fmtMs(r.slaP95Ms)}</td>
                        <td className="px-4 py-2 text-center">
                          <StatusPill tone={tone} dot>
                            {r.status}
                          </StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        {/* ───────────────── Approval by FICO + Decline distribution ───────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader
              title="Approval rate by FICO band — master cohort"
              description="Cohorts ≥ 25 applications. Lower bands shown for transparency; orchestration honors per-lender min-FICO floor."
            />
            <CardBody>
              <LabeledBarChart
                data={ficoBandApproval.map((d) => ({ label: d.label, value: d.value * 100 }))}
                height={170}
                formatValue={(v) => `${v.toFixed(0)}%`}
                highlightIndex={2}
              />
              <div className="mt-3 text-[12px] text-fg-muted leading-relaxed">
                The 660–699 cohort approval is up 5.4pp vs. last quarter, driven by Plaid cashflow
                additions. We continue to enforce ECOA non-discrimination notice + reason codes on
                every decline.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Decline reason distribution"
              description="Top 6 reasons cited on Reg B Adverse Action Notices in the last 30 days."
            />
            <CardBody>
              <div className="text-chart-4">
                <LabeledBarChart
                  data={declineReasonDistribution}
                  height={170}
                  formatValue={(v) => `${v}%`}
                />
              </div>
              <div className="mt-3 text-[12px] text-fg-muted leading-relaxed">
                Reason taxonomy is mapped to the Reg B § 1002 examples and reviewed quarterly with
                compliance. Each notice is reproducible from input snapshot + policy version.
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ───────────────── D. Brand × FICO small-multiples ───────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="Approval rate by brand × FICO band"
            description="Brand-scoped cuts of the master cohort. Useful for portfolio-level vs. vertical risk discussions."
          />
          <CardBody>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {Object.entries(brandFicoApproval).map(([brand, data]) => (
                <div key={brand} className="rounded-md border border-border bg-bg-muted/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-semibold">{brand}</h4>
                    <span className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Avg {fmtPct(data.reduce((s, d) => s + d.value, 0) / data.length, 1)}
                    </span>
                  </div>
                  <LabeledBarChart
                    data={data.map((d) => ({ label: d.label, value: d.value * 100 }))}
                    height={140}
                    formatValue={(v) => `${v.toFixed(0)}%`}
                  />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* ───────────────── E. Conversion heatmap + F. Vintage triangle ───────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader
              title="Conversion by vertical"
              description="Step-by-step funnel conversion, brand-scoped. Darker = higher rate."
            />
            <CardBody>
              <div className="grid grid-cols-[120px_repeat(3,1fr)] gap-1.5">
                <div />
                <div className="text-center text-[11px] text-fg-muted font-semibold uppercase tracking-wider">
                  MedPay
                </div>
                <div className="text-center text-[11px] text-fg-muted font-semibold uppercase tracking-wider">
                  TradePay
                </div>
                <div className="text-center text-[11px] text-fg-muted font-semibold uppercase tracking-wider">
                  CoachPay
                </div>
                {conversionRows.map((row) => (
                  <>
                    <div
                      key={`${row.label}-l`}
                      className="text-[12px] text-fg-secondary font-medium self-center"
                    >
                      {row.label}
                    </div>
                    <ConversionCell value={row.medpay} />
                    <ConversionCell value={row.tradepay} />
                    <ConversionCell value={row.coachpay} />
                  </>
                ))}
              </div>
              <div className="mt-3 text-[11.5px] text-fg-muted leading-relaxed">
                MedPay leads on accept-rate (68%) — patient demand is sticky. TradePay shows lower
                approved-to-accepted, consistent with larger ticket sizes and merchant-side stips.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Vintage performance triangle"
              description="Delinquency rate by origination month × age bucket. Triangular — newer vintages have shorter observed history."
              action={
                <StatusPill tone="warning" dot>
                  Anomaly: 2026-03 +80bps
                </StatusPill>
              }
            />
            <CardBody>
              <div className="grid grid-cols-[80px_repeat(6,1fr)] gap-1 text-[10px]">
                <div />
                {vintageWindowLabels.map((w) => (
                  <div
                    key={w}
                    className="text-center text-fg-muted font-semibold uppercase tracking-wider"
                  >
                    {w}
                  </div>
                ))}
                {vintageMonths.map((m, i) => {
                  const row = vintageMatrix[i] ?? [];
                  return (
                    <>
                      <div
                        key={`${m}-lbl`}
                        className="text-fg-secondary font-medium self-center text-[10.5px]"
                      >
                        {m}
                      </div>
                      {row.map((v, j) => (
                        <VintageCell key={`${m}-${j}`} value={v} />
                      ))}
                    </>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-3 text-[10.5px] text-fg-muted">
                <span className="uppercase tracking-wider font-semibold">Scale</span>
                <div className="flex items-center gap-1">
                  <div
                    className="w-4 h-3 rounded-sm"
                    style={{ backgroundColor: 'rgb(var(--warning) / 0.12)' }}
                  />
                  <span>0.0%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-4 h-3 rounded-sm"
                    style={{ backgroundColor: 'rgb(var(--warning) / 0.5)' }}
                  />
                  <span>1.5%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-4 h-3 rounded-sm"
                    style={{ backgroundColor: 'rgb(var(--warning) / 0.9)' }}
                  />
                  <span>3.0%+</span>
                </div>
              </div>
              <Banner intent="warning" className="mt-3">
                Q1 2026 vintage trending 80bps above peer cohorts at the 30d window — credit
                committee has been notified. Monitoring weekly; no policy change yet.
              </Banner>
            </CardBody>
          </Card>
        </div>

        {/* ───────────────── G. APR distribution histogram ───────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="APR distribution — accepted offers (30 days)"
            description="Distribution of accepted-offer APRs across 25 buckets from 4.99% to 29.99%."
            action={
              <div className="flex items-center gap-2">
                <StatusPill tone="neutral">n = 1,842</StatusPill>
                <StatusPill tone="info">Median {medianApr.toFixed(2)}%</StatusPill>
                <StatusPill tone="info">p75 {p75Apr.toFixed(2)}%</StatusPill>
              </div>
            }
          />
          <CardBody>
            <HistogramChart
              buckets={aprBuckets}
              medianApr={medianApr}
              p75Apr={p75Apr}
              height={200}
            />
            <div className="mt-2 text-[11.5px] text-fg-muted leading-relaxed">
              Distribution is roughly log-normal with a heavy mid-band around 12–15% reflecting the
              prime/near-prime mix. State-rate-cap-impacted offers (NY, MA, CT) cluster at the 16%
              cap.
            </div>
          </CardBody>
        </Card>

        {/* ───────────────── H. APR by lender × tier ───────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="Average APR by lender × credit tier"
            description="Em-dash means the lender does not serve that tier per its product configuration."
          />
          <CardBody padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="bg-bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Lender
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      {tierLabel.prime} <span className="text-fg-muted/60">(700-759)</span>
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      {tierLabel.near_prime} <span className="text-fg-muted/60">(640-699)</span>
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      {tierLabel.sub_prime} <span className="text-fg-muted/60">(580-639)</span>
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Deep-sub <span className="text-fg-muted/60">(&lt;580)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lenderTierApr.map((r) => (
                    <tr key={r.lender} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2 font-medium">{r.lender}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtBps(r.primeBps)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {fmtBps(r.nearPrimeBps)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtBps(r.subPrimeBps)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtBps(r.deepSubBps)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        {/* ───────────────── I. State coverage + L. Operational health ───────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader
              title="State coverage — top 10 by funded volume"
              description="State licensing + per-state lender allow-lists enforced at orchestration."
              action={<StatusPill tone="success">41 live · 9 restricted</StatusPill>}
            />
            <CardBody padded={false}>
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="bg-bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      State
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      $ Funded
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Loans
                    </th>
                    <th className="px-4 py-2 text-center text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stateCoverage.map((s) => (
                    <tr key={s.code} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-sm bg-chart-2/10 text-chart-2 text-[10px] font-bold tabular-nums">
                            {s.code}
                          </span>
                          <span className="font-medium">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {fmtCompactUsd(s.fundedCents)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-fg-muted">
                        {s.fundedCount}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <StatusPill tone={s.status === 'live' ? 'success' : 'warning'} dot>
                          {s.status}
                        </StatusPill>
                        {s.note && <div className="text-[10.5px] text-fg-muted mt-1">{s.note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Operational health"
              description="Real-time orchestrator + integration metrics — last 24h."
            />
            <CardBody>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                    Orchestrator latency
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-[12.5px]">
                    <div>
                      <div className="text-[10px] text-fg-muted uppercase tracking-wider">p50</div>
                      <div className="font-semibold tabular-nums">218ms</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-fg-muted uppercase tracking-wider">p95</div>
                      <div className="font-semibold tabular-nums">742ms</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-fg-muted uppercase tracking-wider">p99</div>
                      <div className="font-semibold tabular-nums">1.42s</div>
                    </div>
                  </div>
                  <div className="mt-2 text-chart-2">
                    <Sparkline data={seriesL} height={28} />
                  </div>
                </div>
                <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                    Lender API uptime
                  </div>
                  <div className="mt-1.5 text-[20px] font-semibold tabular-nums">99.94%</div>
                  <div className="text-[11px] text-fg-muted mt-0.5">
                    Last incident: 2026-05-09 (ClearPath, 17min)
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusPill tone="success" dot>
                      11/12 healthy
                    </StatusPill>
                    <StatusPill tone="warning">1 degraded</StatusPill>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                    Webhook delivery
                  </div>
                  <div className="mt-1.5 text-[20px] font-semibold tabular-nums">99.71%</div>
                  <div className="text-[11px] text-fg-muted mt-0.5">
                    3 retries pending · 0 in DLQ
                  </div>
                  <div className="mt-2 text-chart-2">
                    <Sparkline
                      data={[99.6, 99.7, 99.5, 99.8, 99.9, 99.7, 99.6, 99.8, 99.7, 99.71]}
                      height={28}
                    />
                  </div>
                </div>
                <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                    Audit-trail integrity
                  </div>
                  <div className="mt-1.5 text-[20px] font-semibold tabular-nums">PASS</div>
                  <div className="text-[11px] text-fg-muted mt-0.5">
                    Hash-chain verified 2026-05-15 04:00 UTC
                  </div>
                  <div className="mt-2">
                    <StatusPill tone="success" dot>
                      orch_v_2026_05_a · 0 mismatches
                    </StatusPill>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ───────────────── K. Risk & fraud snapshot ───────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="Risk & fraud snapshot"
            description="Pre-funding fraud controls — identity, device, synthetic, and stip flow."
            action={<StatusPill tone="success">12 cases auto-blocked · 0 escalations</StatusPill>}
          />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                  Fraud catch rate
                </div>
                <div className="mt-1.5 text-[22px] font-semibold tabular-nums">94.1%</div>
                <div className="text-[11px] text-fg-muted mt-0.5">
                  vs. 12mo trailing baseline 91.8%
                </div>
                <div className="text-[11px] text-success mt-1">↑ 2.3pp</div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                  False-positive rate
                </div>
                <div className="mt-1.5 text-[22px] font-semibold tabular-nums">3.2%</div>
                <div className="text-[11px] text-fg-muted mt-0.5">
                  FP downgraded after JIT review
                </div>
                <div className="text-[11px] text-success mt-1">↓ 0.4pp</div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                  Identity-match pass
                </div>
                <div className="mt-1.5 text-[22px] font-semibold tabular-nums">97.6%</div>
                <div className="text-[11px] text-fg-muted mt-0.5">Plaid IDV + Socure layer</div>
                <div className="text-[11px] text-success mt-1">↑ 0.2pp</div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                  Manual-review queue
                </div>
                <div className="mt-1.5 text-[22px] font-semibold tabular-nums">28</div>
                <div className="text-[11px] text-fg-muted mt-0.5">
                  Median wait 4.2h · 14d QA = 100%
                </div>
                <div className="text-[11px] text-warning mt-1">→ within SLA</div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ───────────────── J. Fair-lending deep-dive ───────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="Fair-lending deep dive"
            description="Disparate impact, equalized odds, and adverse-action notice latency across protected classes."
            action={
              <div className="flex items-center gap-2">
                <StatusPill tone="success" dot>
                  Within tolerance
                </StatusPill>
                <StatusPill tone="info">Weekly engine run</StatusPill>
              </div>
            }
          />
          <CardBody>
            {/* 4×3 disparate impact grid */}
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-2">
                Disparate impact — 4/5 rule pass/fail
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="bg-bg-muted/40 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        Dimension
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        Age (62+)
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        Sex
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        Race (BISG)
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        Geography
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {disparateImpact.map((r) => (
                      <tr key={r.dim} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2 font-medium">{r.dim}</td>
                        {([r.ageGroup, r.sex, r.raceProxy, r.geography] as const).map((pass, i) => (
                          <td key={i} className="px-3 py-2 text-center">
                            <StatusPill tone={pass ? 'success' : 'warning'} dot>
                              {pass ? 'pass' : 'review'}
                            </StatusPill>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-[11.5px] text-fg-muted leading-relaxed">
                Geography × approval-rate parity flagged for review — driven by NY rate-cap state
                where fewer prime lenders compete. Disposition note filed; not statistically
                significant at α=0.05.
              </div>
            </div>

            {/* Equalized odds delta */}
            <div className="mb-4">
              <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-2">
                Equalized-odds delta per protected class
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="bg-bg-muted/40 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        Class
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        ΔTPR
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        ΔFPR
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        ΔFNR
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                        Tolerance (0.03)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {equalizedOdds.map((r) => {
                      const maxAbs = Math.max(Math.abs(r.dTpr), Math.abs(r.dFpr), Math.abs(r.dFnr));
                      const inTolerance = maxAbs <= 0.03;
                      return (
                        <tr key={r.className} className="border-b border-border last:border-b-0">
                          <td className="px-3 py-2 font-medium">{r.className}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.dTpr >= 0 ? '+' : ''}
                            {r.dTpr.toFixed(3)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.dFpr >= 0 ? '+' : ''}
                            {r.dFpr.toFixed(3)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.dFnr >= 0 ? '+' : ''}
                            {r.dFnr.toFixed(3)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <StatusPill tone={inTolerance ? 'success' : 'warning'} dot>
                              {inTolerance ? 'within' : 'review'}
                            </StatusPill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Adverse-action latency + override audit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border border-border bg-bg-muted/20 p-4">
                <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
                  Adverse-action notice latency
                </div>
                <div className="text-[26px] font-semibold tabular-nums leading-none">42 min</div>
                <div className="text-[12px] text-fg-muted mt-1">
                  Mean time from decline → AAN dispatch
                </div>
                <div className="mt-3 space-y-1">
                  <DataRow label="Reg B 30-day window" value="100% compliant" />
                  <DataRow label="p95 latency" value="3h 14m" />
                  <DataRow label="Notices sent (30d)" value="1,576" />
                  <DataRow label="Format" value="Letter + email · 1003-compatible" />
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-4">
                <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold mb-1">
                  Override sample audit
                </div>
                <div className="text-[26px] font-semibold tabular-nums leading-none">100%</div>
                <div className="text-[12px] text-fg-muted mt-1">
                  of overrides QA-reviewed within 14d · 14 last 30d
                </div>
                <div className="mt-3 space-y-2">
                  {overrideSamples.map((o) => (
                    <div key={o.id} className="border border-border rounded-md p-2 bg-bg-elevated">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[11px] text-fg-muted">{o.id}</span>
                        <StatusPill tone={o.direction === 'up' ? 'success' : 'warning'} dot>
                          {o.direction === 'up' ? 'approve' : 'decline'}
                        </StatusPill>
                      </div>
                      <div className="text-[11.5px] text-fg-secondary">
                        <span className="font-medium">{o.brand}</span> · FICO {o.ficoBand} ·
                        reviewed {o.reviewedAt}
                      </div>
                      <div className="text-[11px] text-fg-muted mt-1 leading-snug">
                        {o.rationale}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ───────────────── Vintage approval rolling line ───────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="Vintage approval — 12-month rolling"
            description="Approval rate across the rolling 30-day vintage window. Stable trend = orchestration policy steady."
          />
          <CardBody>
            <div className="text-accent">
              <Sparkline data={seriesA} height={68} width={1080} filled />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-4 text-[11.5px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                  Min
                </div>
                <div className="font-semibold tabular-nums">{Math.min(...seriesA).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                  Median
                </div>
                <div className="font-semibold tabular-nums">
                  {(
                    [...seriesA].sort((a, b) => a - b)[Math.floor(seriesA.length / 2)] ?? 0
                  ).toFixed(1)}
                  %
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                  Max
                </div>
                <div className="font-semibold tabular-nums">{Math.max(...seriesA).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                  Latest
                </div>
                <div className="font-semibold tabular-nums">
                  {(seriesA[seriesA.length - 1] ?? 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ───────────────── M. Recent decision sample ───────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="Recent decision sample (last 20)"
            description="Explainable-AI replay row. Each decision is reproducible from input snapshot + policy version orch_v_2026_05_a."
            action={
              <div className="flex items-center gap-2">
                <StatusPill tone="info">Reproducible</StatusPill>
                <Button variant="ghost">Export 30-day</Button>
              </div>
            }
          />
          <CardBody padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      App ID
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Initials
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Brand
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      FICO
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Requested
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Decision
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Top reason
                    </th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      Lender route
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-fg-muted font-semibold">
                      TTD
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentDecisions.map((d) => {
                    const decisionTone: StatusTone =
                      d.decision === 'approved'
                        ? 'success'
                        : d.decision === 'declined'
                          ? 'danger'
                          : 'warning';
                    const decisionLabel = d.decision === 'manual_review' ? 'manual' : d.decision;
                    return (
                      <tr
                        key={d.appId}
                        className="border-b border-border last:border-b-0 hover:bg-bg-muted/40"
                      >
                        <td className="px-3 py-1.5 font-mono text-[11px] text-fg-muted">
                          app_{d.appId}
                        </td>
                        <td className="px-3 py-1.5 font-medium">{d.initials}</td>
                        <td className="px-3 py-1.5">{d.brand}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{d.fico}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {fmtCompactUsd(d.requestedCents)}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <StatusPill tone={decisionTone} dot>
                            {decisionLabel}
                          </StatusPill>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-fg-muted">
                          {d.reason}
                        </td>
                        <td className="px-3 py-1.5 text-fg-secondary">{d.lender}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-fg-muted">
                          {d.ttdMs === 0 ? '—' : fmtMs(d.ttdMs)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        {/* ───────────────── Fair-lending pre-controls (kept, expanded) ───────────────── */}
        <Card className="mb-4">
          <CardHeader title="Fair-lending pre-controls" />
          <CardBody className="space-y-2">
            <DataRow label="Protected-class features" value="0 direct · 0 proxy candidates" />
            <DataRow label="Disparate impact" value="Within 4/5 rule across age, sex, race proxy" />
            <DataRow label="Equalized odds" value="ΔTPR ≤ 0.03 · ΔFPR ≤ 0.02" />
            <DataRow label="Sensitive postcodes" value="Coverage check — 100%" />
            <DataRow label="Override sample audit" value="100% of overrides QA-reviewed in 14d" />
            <DataRow label="Adverse-action notices" value="100% sent within Reg B 30-day window" />
            <DataRow
              label="Bureau credit-bureau reconciliation"
              value="Pass · last verified 2026-05-13"
            />
            <DataRow
              label="Model documentation (SR 11-7)"
              value="Current · last attested 2026-04-22"
            />
          </CardBody>
        </Card>

        <div className="text-[11px] text-fg-muted leading-relaxed border-t border-border pt-4">
          All charts on this page are derived from the master decisioning event stream. Every row,
          cell, and bar is reproducible from input snapshot + policy version orch_v_2026_05_a.
          Cohort window: 30 days ending 2026-05-15 04:00 UTC. Fair-lending engine runs weekly;
          quarterly written review is exported to the bank-partner audit pack.
        </div>
      </PageBody>
    </>
  );
}
