'use client';
import Link from 'next/link';
import { useParams, useSearchParams, notFound } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  KpiCard,
  BarChart,
  Sparkline,
  StatusPill,
  Banner,
  Button,
  DataRow,
  DataTable,
  Money,
  Apr,
  ChartIcon,
  type Column,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import {
  approval30d,
  latency30d,
  declineReasonDistribution,
  ficoBandApproval,
} from '../../../../lib/mock-data';
import { findPartner, applicationsForPartner } from '../../../../lib/master-data';
import {
  marketplaceLenders,
  marketplaces,
  type MarketplaceLenderRow,
} from '../../../../lib/marketplace-data';

/**
 * Per-brand decisioning insights.
 *
 * Mirrors the master `/insights` page but every metric is filtered to
 * the active brand — a MedPay merchant only sees the approval, latency,
 * funnel, lender mix, vintage, and fair-lending cuts that apply to
 * their own brand. Vintage curves, decline taxonomies, and disparate
 * impact controls are reproducible to the brand's policy version.
 *
 * Layout depth modelled on tier-1 merchant decisioning consoles:
 *   1.  Compliance banner + policy version
 *   2.  8-card KPI strip with sparklines + deltas
 *   3.  6-step volume + flow funnel (apps → pre-qual → KYC → decisioned → approved → funded)
 *   4.  Approval rate by FICO band (bar)
 *   5.  Lender performance table (only lenders that route to this brand)
 *   6.  Approval funnel by FICO band (stacked)
 *   7.  Loan size × FICO heatmap
 *   8.  Vintage delinquency heatmap (last 12 months × DPD buckets)
 *   9.  APR distribution histogram (brand vs. industry median annotations)
 *  10.  Brand-specific top decline reasons with vertical copy
 *  11.  Fair-lending deep dive (DI matrix, EO delta, postcodes, overrides, AAN latency)
 *  12.  Decisioning agent health (7 AUREAN agents — actions/hr, status, last error)
 *  13.  Recent decisions sample (last 20, rows linked to /v/{brand}/applications/{id})
 *  14.  Brand-specific anomaly callouts (narrative panel)
 */

// ────────────────────────────────────────────────────────────────────────────
// Type helpers
// ────────────────────────────────────────────────────────────────────────────

type BrandPersona = {
  applicant: string; // "patients", "homeowners", "students"
  applicantSingular: string;
  asset: string; // "treatment plans", "jobs", "programs"
  merchantNoun: string; // "clinics", "contractors", "cohorts"
};

const PERSONAS: Record<Exclude<BrandCode, 'direct'>, BrandPersona> = {
  medpay: {
    applicant: 'patients',
    applicantSingular: 'patient',
    asset: 'treatment plans',
    merchantNoun: 'clinics',
  },
  tradepay: {
    applicant: 'homeowners',
    applicantSingular: 'homeowner',
    asset: 'jobs',
    merchantNoun: 'contractors',
  },
  coachpay: {
    applicant: 'students',
    applicantSingular: 'student',
    asset: 'programs',
    merchantNoun: 'cohorts',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Per-brand numeric profiles. Each brand has a plausible volume +
// performance shape so the dashboard reads correctly when the merchant
// switches brand surfaces.
// ────────────────────────────────────────────────────────────────────────────

type BrandProfile = {
  approvalRate: number; // 0-1
  approvalSeries: number[];
  latencyMs: number;
  latencySeries: number[];
  decisionToFundMedian: string;
  takeUpRate: number; // 0-1
  fundedLoans30d: number;
  fundedDollars30dCents: number;
  pullThrough: number; // 0-1
  avgLoanSizeCents: number;
  netLiftPp: number; // percentage-points vs baseline
  manualReviewRate: number; // 0-1
  funnel: {
    applications: number;
    prequalPassed: number;
    kycVerified: number;
    decisioned: number;
    approved: number;
    funded: number;
  };
  ficoBandFunnel: Array<{
    band: string;
    prequal: number;
    kyc: number;
    approved: number;
    funded: number;
  }>;
  // heatmap value = approval rate %, NaN = below cohort threshold
  loanSizeFicoMatrix: Array<{ band: string; cells: Array<number | null> }>;
  vintageMatrix: Array<{ cohort: string; d30: number; d60: number; d90: number }>;
  aprHistogram: Array<{ label: string; value: number }>;
  aprBrandMedian: number; // %
  aprIndustryMedian: number; // %
  declineReasons: Array<{ code: string; label: string; pct: number; copy: string }>;
  lenderSlugs: string[]; // legalNames or ids we feature
};

const PROFILES: Record<Exclude<BrandCode, 'direct'>, BrandProfile> = {
  medpay: {
    approvalRate: 0.648,
    approvalSeries: [62, 63, 64, 63, 65, 64, 65, 66, 64, 65, 65, 64, 65, 65, 66, 65, 64, 65, 66, 65, 64, 65, 66, 65, 64, 65, 65, 66, 65, 64.8],
    latencyMs: 481,
    latencySeries: [510, 504, 498, 495, 490, 488, 486, 484, 482, 481, 480, 481, 483, 482, 481, 480, 479, 481, 482, 481, 480, 481, 482, 481, 481, 480, 481, 482, 481, 481],
    decisionToFundMedian: '1h 48m',
    takeUpRate: 0.412,
    fundedLoans30d: 612,
    fundedDollars30dCents: 4_240_180_00,
    pullThrough: 0.267,
    avgLoanSizeCents: 6_927_00,
    netLiftPp: 7.8,
    manualReviewRate: 0.041,
    funnel: {
      applications: 2294,
      prequalPassed: 1864,
      kycVerified: 1681,
      decisioned: 1612,
      approved: 1045,
      funded: 612,
    },
    ficoBandFunnel: [
      { band: '<620', prequal: 184, kyc: 142, approved: 6, funded: 3 },
      { band: '620-659', prequal: 240, kyc: 211, approved: 49, funded: 26 },
      { band: '660-699', prequal: 412, kyc: 376, approved: 232, funded: 138 },
      { band: '700-739', prequal: 488, kyc: 451, approved: 374, funded: 222 },
      { band: '740-779', prequal: 311, kyc: 296, approved: 271, funded: 154 },
      { band: '780+', prequal: 229, kyc: 222, approved: 213, funded: 124 },
    ],
    loanSizeFicoMatrix: [
      { band: '780+', cells: [96, 95, 94, 92] },
      { band: '740-779', cells: [91, 88, 84, 78] },
      { band: '700-739', cells: [82, 77, 71, 63] },
      { band: '660-699', cells: [68, 59, 49, 36] },
      { band: '620-659', cells: [27, 19, 11, null] },
      { band: '<620', cells: [6, null, null, null] },
    ],
    vintageMatrix: [
      { cohort: '2025-06', d30: 1.8, d60: 0.9, d90: 0.4 },
      { cohort: '2025-07', d30: 1.9, d60: 0.9, d90: 0.4 },
      { cohort: '2025-08', d30: 2.0, d60: 1.0, d90: 0.5 },
      { cohort: '2025-09', d30: 2.1, d60: 1.0, d90: 0.5 },
      { cohort: '2025-10', d30: 2.0, d60: 1.1, d90: 0.5 },
      { cohort: '2025-11', d30: 2.2, d60: 1.1, d90: 0.6 },
      { cohort: '2025-12', d30: 2.3, d60: 1.2, d90: 0.6 },
      { cohort: '2026-01', d30: 2.5, d60: 1.3, d90: 0.7 },
      { cohort: '2026-02', d30: 2.4, d60: 1.3, d90: 0.6 },
      { cohort: '2026-03', d30: 2.3, d60: 1.2, d90: null as unknown as number },
      { cohort: '2026-04', d30: 2.2, d60: null as unknown as number, d90: null as unknown as number },
      { cohort: '2026-05', d30: null as unknown as number, d60: null as unknown as number, d90: null as unknown as number },
    ],
    aprHistogram: [
      { label: '6-8', value: 28 },
      { label: '8-10', value: 64 },
      { label: '10-12', value: 102 },
      { label: '12-14', value: 148 },
      { label: '14-16', value: 124 },
      { label: '16-18', value: 86 },
      { label: '18-20', value: 41 },
      { label: '20-24', value: 19 },
    ],
    aprBrandMedian: 13.9,
    aprIndustryMedian: 15.7,
    declineReasons: [
      { code: 'min_fico_floor', label: 'FICO below floor', pct: 24, copy: 'Patient FICO below partner clinic’s prime-only lender minimum (660). Routed to sub-prime tier where eligible.' },
      { code: 'insurance_verification_failed', label: 'Insurance verification failed', pct: 19, copy: 'Eligibility ping to payer returned non-active coverage; patient cost-share could not be reconciled before decisioning timed out.' },
      { code: 'debt_to_income_high', label: 'DTI > policy', pct: 17, copy: 'DTI > 50% under MedPay v2026.05 policy; common in elective dental + fertility cohorts.' },
      { code: 'recent_delinquency_60d', label: 'Recent 60-day delinquency', pct: 14, copy: 'Open 60-day delinquency on Bureau tradeline reported within last 6 months.' },
      { code: 'treatment_plan_unverified', label: 'Treatment plan unverified', pct: 12, copy: 'Procedure code + clinic NPI mismatch — verification re-queued to clinic admin.' },
      { code: 'insufficient_stability', label: 'Insufficient stability', pct: 8, copy: 'Cashflow stability score below 55 on Plaid asset report.' },
      { code: 'other', label: 'Other', pct: 6, copy: 'Includes ID document quality, address mismatch, and fraud flags.' },
    ],
    lenderSlugs: [],
  },
  tradepay: {
    approvalRate: 0.581,
    approvalSeries: [55, 56, 56, 57, 57, 58, 57, 58, 58, 58, 59, 58, 57, 58, 58, 58, 58, 58, 59, 58, 58, 58, 59, 58, 58, 58, 58, 58, 58, 58.1],
    latencyMs: 612,
    latencySeries: [702, 688, 681, 674, 668, 660, 654, 648, 642, 636, 630, 624, 618, 612, 614, 612, 611, 610, 612, 614, 611, 610, 612, 614, 612, 611, 612, 614, 612, 612],
    decisionToFundMedian: '2h 41m',
    takeUpRate: 0.389,
    fundedLoans30d: 1148,
    fundedDollars30dCents: 17_842_640_00,
    pullThrough: 0.224,
    avgLoanSizeCents: 15_543_00,
    netLiftPp: 9.4,
    manualReviewRate: 0.062,
    funnel: {
      applications: 5128,
      prequalPassed: 3964,
      kycVerified: 3401,
      decisioned: 3196,
      approved: 1856,
      funded: 1148,
    },
    ficoBandFunnel: [
      { band: '<620', prequal: 318, kyc: 244, approved: 11, funded: 4 },
      { band: '620-659', prequal: 504, kyc: 426, approved: 71, funded: 34 },
      { band: '660-699', prequal: 882, kyc: 794, approved: 388, funded: 224 },
      { band: '700-739', prequal: 1108, kyc: 1011, approved: 731, funded: 462 },
      { band: '740-779', prequal: 692, kyc: 642, approved: 489, funded: 288 },
      { band: '780+', prequal: 460, kyc: 442, approved: 387, funded: 232 },
    ],
    loanSizeFicoMatrix: [
      { band: '780+', cells: [94, 93, 92, 91] },
      { band: '740-779', cells: [86, 84, 82, 78] },
      { band: '700-739', cells: [74, 70, 66, 60] },
      { band: '660-699', cells: [56, 49, 41, 31] },
      { band: '620-659', cells: [21, 14, 8, null] },
      { band: '<620', cells: [4, null, null, null] },
    ],
    vintageMatrix: [
      { cohort: '2025-06', d30: 2.4, d60: 1.3, d90: 0.6 },
      { cohort: '2025-07', d30: 2.5, d60: 1.3, d90: 0.7 },
      { cohort: '2025-08', d30: 2.6, d60: 1.4, d90: 0.7 },
      { cohort: '2025-09', d30: 2.7, d60: 1.4, d90: 0.8 },
      { cohort: '2025-10', d30: 2.8, d60: 1.5, d90: 0.8 },
      { cohort: '2025-11', d30: 2.9, d60: 1.6, d90: 0.9 },
      { cohort: '2025-12', d30: 3.0, d60: 1.7, d90: 0.9 },
      { cohort: '2026-01', d30: 3.2, d60: 1.8, d90: 1.0 },
      { cohort: '2026-02', d30: 3.1, d60: 1.7, d90: 0.9 },
      { cohort: '2026-03', d30: 3.0, d60: 1.6, d90: null as unknown as number },
      { cohort: '2026-04', d30: 2.9, d60: null as unknown as number, d90: null as unknown as number },
      { cohort: '2026-05', d30: null as unknown as number, d60: null as unknown as number, d90: null as unknown as number },
    ],
    aprHistogram: [
      { label: '6-8', value: 41 },
      { label: '8-10', value: 118 },
      { label: '10-12', value: 184 },
      { label: '12-14', value: 246 },
      { label: '14-16', value: 218 },
      { label: '16-18', value: 162 },
      { label: '18-20', value: 91 },
      { label: '20-24', value: 38 },
    ],
    aprBrandMedian: 13.4,
    aprIndustryMedian: 15.1,
    declineReasons: [
      { code: 'dti_high', label: 'DTI above policy', pct: 26, copy: 'Combined housing + installment debt exceeds 45% on trades cohort — typically homeowners with active HELOC.' },
      { code: 'lien_position_concern', label: 'Lien position concerns', pct: 18, copy: 'Subject property has open mechanics lien or recorded second mortgage; routes to BuzzPay only.' },
      { code: 'min_fico_floor', label: 'FICO below floor', pct: 17, copy: 'Homeowner FICO below Orion Capital floor (700); reroutes to Kestrel (620+) if state-eligible.' },
      { code: 'recent_delinquency_60d', label: 'Recent 60-day delinquency', pct: 13, copy: 'Open mortgage or auto delinquency within 12 months — Reg B-mapped reason code dq_60.' },
      { code: 'income_unverified', label: 'Income unverified', pct: 11, copy: 'Self-employed contractor income could not be verified via Plaid; W-2 stub fallback failed parsing.' },
      { code: 'job_scope_unverified', label: 'Job scope unverified', pct: 9, copy: 'Contractor SOW PDF rejected at OCR — line items did not match category cap on TradePay HVAC product.' },
      { code: 'other', label: 'Other', pct: 6, copy: 'Includes state-eligibility, identity-document quality, and consortium fraud flags.' },
    ],
    lenderSlugs: [],
  },
  coachpay: {
    approvalRate: 0.714,
    approvalSeries: [69, 70, 70, 71, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71, 71.4],
    latencyMs: 446,
    latencySeries: [495, 488, 482, 476, 470, 464, 460, 456, 452, 450, 448, 446, 446, 446, 446, 446, 445, 446, 447, 446, 446, 445, 446, 447, 446, 446, 446, 446, 446, 446],
    decisionToFundMedian: '1h 12m',
    takeUpRate: 0.537,
    fundedLoans30d: 384,
    fundedDollars30dCents: 1_482_960_00,
    pullThrough: 0.318,
    avgLoanSizeCents: 3_862_00,
    netLiftPp: 11.2,
    manualReviewRate: 0.028,
    funnel: {
      applications: 1208,
      prequalPassed: 1041,
      kycVerified: 974,
      decisioned: 941,
      approved: 672,
      funded: 384,
    },
    ficoBandFunnel: [
      { band: '<620', prequal: 88, kyc: 71, approved: 8, funded: 4 },
      { band: '620-659', prequal: 142, kyc: 127, approved: 38, funded: 22 },
      { band: '660-699', prequal: 244, kyc: 226, approved: 154, funded: 91 },
      { band: '700-739', prequal: 286, kyc: 271, approved: 232, funded: 138 },
      { band: '740-779', prequal: 168, kyc: 162, approved: 142, funded: 82 },
      { band: '780+', prequal: 113, kyc: 110, approved: 98, funded: 47 },
    ],
    loanSizeFicoMatrix: [
      { band: '780+', cells: [97, 96, 94, null] },
      { band: '740-779', cells: [93, 90, 86, null] },
      { band: '700-739', cells: [86, 82, 76, null] },
      { band: '660-699', cells: [74, 67, 58, null] },
      { band: '620-659', cells: [33, 22, 12, null] },
      { band: '<620', cells: [9, null, null, null] },
    ],
    vintageMatrix: [
      { cohort: '2025-06', d30: 2.0, d60: 1.0, d90: 0.5 },
      { cohort: '2025-07', d30: 2.1, d60: 1.1, d90: 0.5 },
      { cohort: '2025-08', d30: 2.2, d60: 1.1, d90: 0.5 },
      { cohort: '2025-09', d30: 2.3, d60: 1.2, d90: 0.6 },
      { cohort: '2025-10', d30: 2.4, d60: 1.2, d90: 0.6 },
      { cohort: '2025-11', d30: 2.5, d60: 1.3, d90: 0.7 },
      { cohort: '2025-12', d30: 2.6, d60: 1.4, d90: 0.7 },
      { cohort: '2026-01', d30: 2.7, d60: 1.4, d90: 0.8 },
      { cohort: '2026-02', d30: 2.6, d60: 1.4, d90: 0.7 },
      { cohort: '2026-03', d30: 2.5, d60: 1.3, d90: null as unknown as number },
      { cohort: '2026-04', d30: 2.4, d60: null as unknown as number, d90: null as unknown as number },
      { cohort: '2026-05', d30: null as unknown as number, d60: null as unknown as number, d90: null as unknown as number },
    ],
    aprHistogram: [
      { label: '6-8', value: 12 },
      { label: '8-10', value: 28 },
      { label: '10-12', value: 56 },
      { label: '12-14', value: 92 },
      { label: '14-16', value: 78 },
      { label: '16-18', value: 51 },
      { label: '18-20', value: 24 },
      { label: '20-24', value: 9 },
    ],
    aprBrandMedian: 13.1,
    aprIndustryMedian: 16.4,
    declineReasons: [
      { code: 'income_variability', label: 'Income variability (coaching biz)', pct: 23, copy: 'Self-employed coach income volatility exceeds policy variance; routes to ClearPath for sub-prime if eligible.' },
      { code: 'min_fico_floor', label: 'FICO below floor', pct: 19, copy: 'Student FICO below Atlas Career Capital prime floor (700); reroutes to ClearPath (600+).' },
      { code: 'program_unaccredited', label: 'Program not on approved list', pct: 16, copy: 'CoachPay only finances programs on the curated school list; submission re-queued to compliance for whitelist review.' },
      { code: 'dti_high', label: 'DTI above policy', pct: 14, copy: 'Combined student debt + installment exceeds 50%; especially common for bootcamp + certification stacking.' },
      { code: 'thin_file', label: 'Thin credit file', pct: 11, copy: '<24 months of credit history; alt-data fallback (rent + utilities) did not return enough signal.' },
      { code: 'enrollment_unverified', label: 'Enrollment unverified', pct: 10, copy: 'Program admin did not confirm enrollment within decision SLA — retry queued.' },
      { code: 'other', label: 'Other', pct: 7, copy: 'Includes ID-document quality, address mismatch, and OFAC flags.' },
    ],
    lenderSlugs: [],
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Helper: lender rows filtered to brand
// ────────────────────────────────────────────────────────────────────────────

type LenderPerfRow = {
  lender: MarketplaceLenderRow;
  marketplaceName: string;
  appsRouted: number;
  approvalRate: number; // 0-1
  avgAprBps: number;
  stipRate: number; // 0-1
  slaP95Ms: number;
  status: 'healthy' | 'watch' | 'paused';
};

function lendersForBrand(brand: BrandCode): LenderPerfRow[] {
  const filtered = marketplaceLenders.filter(
    (l) => l.brands.includes(brand) || l.brands.length === 0,
  );
  // Stable, deterministic mock perf numbers — seeded by lender id length so they're stable per render.
  return filtered.map((lender, idx) => {
    const mkt = marketplaces.find((m) => m.id === lender.marketplaceId);
    const seed = (lender.id.length * 31 + idx * 7) % 100;
    const appsBase =
      brand === 'tradepay' ? 420 : brand === 'medpay' ? 240 : 120;
    return {
      lender,
      marketplaceName: mkt?.displayName ?? 'unknown',
      appsRouted: appsBase + seed * 4,
      approvalRate: 0.42 + (seed % 35) / 100,
      avgAprBps: 999 + (seed % 22) * 80,
      stipRate: 0.04 + (seed % 12) / 100,
      slaP95Ms: 380 + (seed % 18) * 18,
      status: !lender.globallyEnabled
        ? 'paused'
        : mkt?.status !== 'active'
          ? 'paused'
          : seed % 9 === 0
            ? 'watch'
            : 'healthy',
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Mini sparkline series for each KPI tile (cheap, stable deltas)
// ────────────────────────────────────────────────────────────────────────────

const fundedLoansSeries = (target: number): number[] => {
  const base = Math.max(8, Math.round(target / 32));
  return Array.from({ length: 30 }, (_, i) =>
    Math.round(base + Math.sin(i / 3) * (base * 0.18) + (i / 30) * (base * 0.3)),
  );
};

const fundedDollarsSeries = (target: number): number[] => {
  const base = Math.max(1, Math.round(target / 32));
  return Array.from({ length: 30 }, (_, i) =>
    Math.round(base + Math.cos(i / 4) * (base * 0.22) + (i / 30) * (base * 0.25)),
  );
};

const pullThroughSeries = (target: number): number[] => {
  return Array.from({ length: 30 }, (_, i) =>
    Math.max(15, target * 100 + Math.sin(i / 2.5) * 1.4 + (i / 30) * 1.1),
  );
};

const avgLoanSizeSeries = (cents: number): number[] => {
  const base = cents / 100;
  return Array.from({ length: 30 }, (_, i) =>
    Math.round(base + Math.sin(i / 2.7) * (base * 0.04) - (i / 30) * (base * 0.02)),
  );
};

const netLiftSeries = (target: number): number[] => {
  return Array.from({ length: 30 }, (_, i) =>
    Math.max(2, target + Math.cos(i / 3.5) * 1.6 - (i / 30) * 0.6),
  );
};

const manualReviewSeries = (target: number): number[] => {
  return Array.from({ length: 30 }, (_, i) =>
    Math.max(0.5, target * 100 + Math.sin(i / 4) * 0.6 + (i / 30) * 0.4),
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Recent decisions sample (synthetic but realistic — links to /v/{brand}/applications/{id})
// ────────────────────────────────────────────────────────────────────────────

type RecentDecision = {
  id: string;
  initials: string;
  fico: number;
  amountCents: number;
  decision: 'approved' | 'declined' | 'pending' | 'manual_review' | 'funded';
  topReasonCode: string;
  lenderShort: string;
  decisionedMs: number;
  decisionedAt: string;
};

function recentDecisionsFor(brand: Exclude<BrandCode, 'direct'>): RecentDecision[] {
  const initials = [
    'J.M.', 'D.K.', 'A.R.', 'S.P.', 'L.W.', 'R.B.', 'M.T.', 'E.H.', 'P.S.', 'O.G.',
    'K.N.', 'T.W.', 'C.B.', 'F.J.', 'B.L.', 'N.R.', 'Q.A.', 'I.S.', 'V.O.', 'Y.D.',
  ];
  const baseSizeCents =
    brand === 'tradepay' ? 14_000_00 : brand === 'medpay' ? 6_400_00 : 3_500_00;
  const baseLenders =
    brand === 'tradepay'
      ? ['Orion Capital', 'Kestrel', 'BuzzPay', 'Summit Premier']
      : brand === 'medpay'
        ? ['Helia Medical', 'SageHeal', 'BuzzPay', 'Summit Premier']
        : ['Atlas Career Cap', 'ClearPath', 'BuzzPay', 'Summit Premier'];

  const decisions: RecentDecision['decision'][] = [
    'approved',
    'approved',
    'approved',
    'funded',
    'declined',
    'approved',
    'manual_review',
    'approved',
    'declined',
    'funded',
    'approved',
    'pending',
    'approved',
    'funded',
    'declined',
    'approved',
    'manual_review',
    'funded',
    'approved',
    'declined',
  ];

  const reasons = [
    'approved_within_policy',
    'cashflow_score_high',
    'thick_file_bonus',
    'rtp_capable',
    'dti_high',
    'approved_within_policy',
    'override_pending_qa',
    'approved_within_policy',
    'min_fico_floor',
    'rtp_capable',
    'approved_within_policy',
    'awaiting_doc_verification',
    'approved_within_policy',
    'ach_settled',
    'recent_delinquency_60d',
    'approved_within_policy',
    'override_pending_qa',
    'rtp_capable',
    'approved_within_policy',
    'insurance_verification_failed',
  ];

  const now = Date.now();
  return Array.from({ length: 20 }, (_, i) => {
    const fico = 580 + ((i * 17) % 220);
    return {
      id: `app_${brand}_${i.toString().padStart(2, '0')}${Math.abs(((i + 1) * 9301) % 9973)
        .toString(36)
        .padStart(6, '0')}`,
      initials: initials[i % initials.length]!,
      fico,
      amountCents: Math.round(baseSizeCents * (0.6 + ((i * 13) % 100) / 100)),
      decision: decisions[i]!,
      topReasonCode: reasons[i]!,
      lenderShort: baseLenders[i % baseLenders.length]!,
      decisionedMs: 320 + ((i * 47) % 580),
      decisionedAt: new Date(now - i * 7 * 60 * 1000).toISOString(),
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 7 AUREAN agents (decisioning-agent health table)
// ────────────────────────────────────────────────────────────────────────────

type AgentHealth = {
  code: 'PRISM' | 'VEGA' | 'ORACLE' | 'HELIX' | 'NEXUS' | 'FLUX' | 'ECHO';
  role: string;
  actionsLastHour: number;
  status: 'healthy' | 'degraded' | 'paused';
  p95Ms: number;
  lastError: string | null;
  lastActionAt: string;
};

function agentHealthFor(brand: Exclude<BrandCode, 'direct'>): AgentHealth[] {
  const mult = brand === 'tradepay' ? 2.6 : brand === 'medpay' ? 1.4 : 0.8;
  const now = new Date(Date.now() - 60_000).toISOString();
  return [
    {
      code: 'PRISM',
      role: 'Apply-flow choreographer',
      actionsLastHour: Math.round(214 * mult),
      status: 'healthy',
      p95Ms: 121,
      lastError: null,
      lastActionAt: now,
    },
    {
      code: 'VEGA',
      role: 'Enrichment fan-out',
      actionsLastHour: Math.round(186 * mult),
      status: 'healthy',
      p95Ms: 248,
      lastError: null,
      lastActionAt: now,
    },
    {
      code: 'ORACLE',
      role: 'Propensity + cashflow scoring',
      actionsLastHour: Math.round(168 * mult),
      status: 'healthy',
      p95Ms: 312,
      lastError: null,
      lastActionAt: now,
    },
    {
      code: 'HELIX',
      role: 'Rep + clinic match routing',
      actionsLastHour: Math.round(141 * mult),
      status: brand === 'tradepay' ? 'degraded' : 'healthy',
      p95Ms: 162,
      lastError:
        brand === 'tradepay'
          ? '1 of 14 region pods reported 502 from rep-capacity service @ 18:04Z'
          : null,
      lastActionAt: now,
    },
    {
      code: 'NEXUS',
      role: 'Lender marketplace router',
      actionsLastHour: Math.round(132 * mult),
      status: 'healthy',
      p95Ms: 281,
      lastError: null,
      lastActionAt: now,
    },
    {
      code: 'FLUX',
      role: 'Payment + reconciliation',
      actionsLastHour: Math.round(108 * mult),
      status: 'healthy',
      p95Ms: 198,
      lastError: null,
      lastActionAt: now,
    },
    {
      code: 'ECHO',
      role: 'Attribution + signal feedback',
      actionsLastHour: Math.round(84 * mult),
      status: 'healthy',
      p95Ms: 226,
      lastError: null,
      lastActionAt: now,
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Disparate-impact grid (protected-class × outcome) — same shape per brand,
// numbers gently differ.
// ────────────────────────────────────────────────────────────────────────────

type DiCell = { label: string; delta: number; note: string; ok: boolean };

function diGridFor(brand: Exclude<BrandCode, 'direct'>): DiCell[][] {
  // 4 metrics × 3 protected-class axes
  const offset =
    brand === 'tradepay' ? 0.4 : brand === 'medpay' ? 0.1 : -0.2;
  const grid: DiCell[][] = [
    [
      { label: 'Approval ratio', delta: 0.91 - offset / 10, note: 'AIR vs majority', ok: true },
      { label: 'False-positive Δ', delta: 0.018 + offset / 50, note: 'ΔFPR', ok: true },
      { label: 'False-negative Δ', delta: 0.022 + offset / 60, note: 'ΔFNR', ok: true },
      { label: 'AAN latency p95', delta: 18.4, note: 'days, target <30', ok: true },
    ],
    [
      { label: 'Approval ratio', delta: 0.93 - offset / 11, note: 'AIR vs majority', ok: true },
      { label: 'False-positive Δ', delta: 0.014 + offset / 70, note: 'ΔFPR', ok: true },
      { label: 'False-negative Δ', delta: 0.019 + offset / 80, note: 'ΔFNR', ok: true },
      { label: 'AAN latency p95', delta: 16.8, note: 'days, target <30', ok: true },
    ],
    [
      { label: 'Approval ratio', delta: 0.86 - offset / 7, note: 'AIR vs majority', ok: false },
      { label: 'False-positive Δ', delta: 0.026 + offset / 50, note: 'ΔFPR', ok: true },
      { label: 'False-negative Δ', delta: 0.029 + offset / 40, note: 'ΔFNR', ok: true },
      { label: 'AAN latency p95', delta: 21.2, note: 'days, target <30', ok: true },
    ],
  ];
  return grid;
}

const diRowLabels = ['Sex (M vs F)', 'Age (≥62 vs <62)', 'Race proxy (BISG quintile 1 vs 5)'];

// Formatters
const pct = (n: number, decimals = 1) => `${(n * 100).toFixed(decimals)}%`;
const pctPoint = (n: number, decimals = 1) => `${n.toFixed(decimals)}pp`;
const numFmt = (n: number) => Intl.NumberFormat('en-US').format(n);
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
const fmtDur = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`);

// Heat shading helper for vintage + matrix cells (single-hue, lower opacity for null).
function heatShade(v: number | null | undefined, min: number, max: number): string {
  if (v == null || Number.isNaN(v)) return 'rgba(120,120,130,0.06)';
  const t = Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
  const alpha = 0.08 + t * 0.42;
  // Single accent hue; UI tokens are token-based so we use plain rgba for the heatmap fill only.
  return `rgba(99,102,241,${alpha.toFixed(3)})`;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export default function BrandInsightsPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const searchParams = useSearchParams();
  const partnerIdParam = searchParams?.get('partnerId') ?? null;
  // Resolve to the canonical master partner (handles slug bridging too).
  // When present, this turns the insights page into a partner-scoped
  // view — same drill the master `/control-panel/[partnerId]` applications
  // tab shows, so the cross-link from /reports lands consistently.
  const partnerCtx = partnerIdParam ? findPartner(partnerIdParam) ?? null : null;
  const partnerApps = partnerCtx ? applicationsForPartner(partnerCtx.id) : [];
  const brandCode = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  if (!brandCode || brandCode === 'direct') notFound();
  const brand = brandCode as Exclude<BrandCode, 'direct'>;
  const spec = BRANDS[brand];
  const profile = PROFILES[brand];
  const persona = PERSONAS[brand];
  const lenderRows = lendersForBrand(brand);
  const recent = recentDecisionsFor(brand);
  const agents = agentHealthFor(brand);
  const diGrid = diGridFor(brand);

  // Volume + flow funnel — compute drop-off %
  const funnelSteps = [
    { key: 'applications', label: 'Applications received', value: profile.funnel.applications },
    { key: 'prequalPassed', label: 'Pre-qual passed', value: profile.funnel.prequalPassed },
    { key: 'kycVerified', label: 'KYC verified', value: profile.funnel.kycVerified },
    { key: 'decisioned', label: 'Decisioned', value: profile.funnel.decisioned },
    { key: 'approved', label: 'Approved', value: profile.funnel.approved },
    { key: 'funded', label: 'Funded', value: profile.funnel.funded },
  ];
  const funnelMax = funnelSteps[0]!.value;

  // Recent-decisions table columns
  const recentCols: Column<RecentDecision>[] = [
    {
      key: 'id',
      header: 'App ID',
      cell: (r) => (
        <Link
          href={`/v/${brandSlug}/applications/${r.id}`}
          className="font-mono text-[12px] text-accent hover:underline"
        >
          {r.id.slice(0, 18)}…
        </Link>
      ),
      width: '24%',
    },
    {
      key: 'initials',
      header: persona.applicantSingular,
      cell: (r) => <span className="text-[13px] tabular-nums">{r.initials}</span>,
      width: '8%',
    },
    {
      key: 'fico',
      header: 'FICO',
      align: 'right',
      cell: (r) => <span className="text-[13px] tabular-nums">{r.fico}</span>,
      width: '7%',
    },
    {
      key: 'amount',
      header: 'Requested',
      align: 'right',
      cell: (r) => <Money cents={r.amountCents} className="text-[13px]" noFractions />,
      width: '12%',
    },
    {
      key: 'decision',
      header: 'Decision',
      cell: (r) => {
        const tone: Record<RecentDecision['decision'], 'success' | 'warning' | 'danger' | 'info' | 'neutral'> =
          {
            approved: 'success',
            funded: 'success',
            declined: 'danger',
            manual_review: 'warning',
            pending: 'info',
          };
        return (
          <StatusPill tone={tone[r.decision]} dot>
            {r.decision.replace('_', ' ')}
          </StatusPill>
        );
      },
      width: '13%',
    },
    {
      key: 'reason',
      header: 'Top reason',
      cell: (r) => (
        <span className="font-mono text-[11px] text-fg-muted">{r.topReasonCode}</span>
      ),
      width: '17%',
    },
    {
      key: 'lender',
      header: 'Lender',
      cell: (r) => <span className="text-[13px]">{r.lenderShort}</span>,
      width: '11%',
    },
    {
      key: 'ttd',
      header: 'TTD',
      align: 'right',
      cell: (r) => <span className="text-[12px] tabular-nums text-fg-muted">{fmtDur(r.decisionedMs)}</span>,
      width: '8%',
    },
  ];

  // Lender performance columns
  const lenderCols: Column<LenderPerfRow>[] = [
    {
      key: 'lender',
      header: 'Lender',
      cell: (r) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-medium">{r.lender.displayName}</span>
          <span className="text-[11px] text-fg-muted">{r.lender.legalName}</span>
        </div>
      ),
      width: '22%',
    },
    {
      key: 'mkt',
      header: 'Marketplace',
      cell: (r) => <span className="text-[12px] text-fg-muted">{r.marketplaceName}</span>,
      width: '12%',
    },
    {
      key: 'apps',
      header: 'Apps routed',
      align: 'right',
      cell: (r) => <span className="text-[13px] tabular-nums">{numFmt(r.appsRouted)}</span>,
      width: '10%',
    },
    {
      key: 'approval',
      header: 'Approval',
      align: 'right',
      cell: (r) => <span className="text-[13px] tabular-nums">{pct(r.approvalRate)}</span>,
      width: '9%',
    },
    {
      key: 'apr',
      header: 'Avg APR',
      align: 'right',
      cell: (r) => <Apr bps={r.avgAprBps} className="text-[13px]" />,
      width: '9%',
    },
    {
      key: 'stip',
      header: 'Stip rate',
      align: 'right',
      cell: (r) => <span className="text-[13px] tabular-nums">{pct(r.stipRate)}</span>,
      width: '9%',
    },
    {
      key: 'sla',
      header: 'SLA p95',
      align: 'right',
      cell: (r) => <span className="text-[13px] tabular-nums">{fmtDur(r.slaP95Ms)}</span>,
      width: '9%',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => {
        const tone: Record<LenderPerfRow['status'], 'success' | 'warning' | 'danger'> = {
          healthy: 'success',
          watch: 'warning',
          paused: 'danger',
        };
        return (
          <StatusPill tone={tone[r.status]} dot>
            {r.status}
          </StatusPill>
        );
      },
      width: '10%',
    },
  ];

  // Agent table columns
  const agentCols: Column<AgentHealth>[] = [
    {
      key: 'code',
      header: 'Agent',
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-mono text-[13px] font-semibold tracking-wider">{r.code}</span>
          <span className="text-[11px] text-fg-muted">{r.role}</span>
        </div>
      ),
      width: '24%',
    },
    {
      key: 'actions',
      header: 'Actions / hr',
      align: 'right',
      cell: (r) => <span className="text-[13px] tabular-nums">{numFmt(r.actionsLastHour)}</span>,
      width: '12%',
    },
    {
      key: 'p95',
      header: 'p95 latency',
      align: 'right',
      cell: (r) => <span className="text-[13px] tabular-nums">{fmtDur(r.p95Ms)}</span>,
      width: '12%',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <StatusPill
          tone={r.status === 'healthy' ? 'success' : r.status === 'degraded' ? 'warning' : 'danger'}
          dot
        >
          {r.status}
        </StatusPill>
      ),
      width: '12%',
    },
    {
      key: 'lastErr',
      header: 'Last error',
      cell: (r) =>
        r.lastError ? (
          <span className="text-[12px] text-warning">{r.lastError}</span>
        ) : (
          <span className="text-[12px] text-fg-muted">—</span>
        ),
      width: '32%',
    },
    {
      key: 'when',
      header: 'Last action',
      align: 'right',
      cell: (r) => <span className="text-[12px] text-fg-muted">{fmtTime(r.lastActionAt)}</span>,
      width: '8%',
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: spec.name, href: `/v/${brandSlug}` }, { label: 'Insights' }]}
        title={`${spec.name} insights`}
        description={`Brand-scoped approval, decline, latency, lender mix, vintage, and fair-lending cuts. Every chart reproducible to the active policy version + input snapshot. Scoped to ${persona.applicant} routed under the ${spec.name} surface.`}
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
            <StatusPill tone="success">Bias review — within tolerance</StatusPill>
            <StatusPill tone="info">{spec.name} policy {brand}_v_2026_05</StatusPill>
            <StatusPill tone="neutral">Policy version orch_v_2026_05_a</StatusPill>
          </>
        }
      />
      <PageBody>
        {partnerCtx && (
          <div className="mb-4 rounded-lg border border-border bg-bg-elevated px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="size-9 rounded-full bg-bg-muted text-fg flex items-center justify-center font-semibold text-[12px] shrink-0">
                {partnerCtx.initials}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
                  Partner-scoped view
                </p>
                <p className="text-[13px] font-semibold text-fg truncate">
                  {partnerCtx.legalName}{' '}
                  <span className="font-normal text-fg-muted">
                    · {partnerApps.length} application{partnerApps.length === 1 ? '' : 's'} on this brand
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/control-panel/${partnerCtx.id}`}
                className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
              >
                Open partner control page
              </Link>
              <Link
                href={`/v/${brandSlug}/insights`}
                className="h-8 px-3 rounded-md border border-border bg-bg-elevated text-[11px] font-medium text-fg-secondary hover:bg-bg-muted inline-flex items-center"
              >
                Clear filter
              </Link>
            </div>
          </div>
        )}
        <Banner intent="info" className="mb-5">
          The fair-lending monitoring engine evaluates disparate impact + equalised odds on each
          decisioned {spec.name} cohort weekly. Quarterly written review is exported to your
          bank-partner audit pack. AAN latency p95 = 18.4 days (Reg B 30-day window).
        </Banner>

        {/* ───────────────────────── KPI strip (8 cards) ───────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiCard
            label={`${spec.name} approval rate (30d)`}
            value={pct(profile.approvalRate, 1)}
            delta={{ value: '+2.1pp', direction: 'up', isGood: true }}
            series={profile.approvalSeries}
          />
          <KpiCard
            label="Avg decision latency"
            value={`${profile.latencyMs}ms`}
            delta={{ value: '-43ms', direction: 'down', isGood: true }}
            series={profile.latencySeries}
          />
          <KpiCard
            label="Decision-to-fund (median)"
            value={profile.decisionToFundMedian}
            delta={{ value: '-18m', direction: 'down', isGood: true }}
            hint="RTP same-day · ACH fallback"
          />
          <KpiCard
            label={`${spec.name} take-up`}
            value={pct(profile.takeUpRate, 1)}
            delta={{ value: '+4.3pp', direction: 'up', isGood: true }}
            hint="Offer → e-signed"
          />
          <KpiCard
            label={`${spec.name} funded loans (30d)`}
            value={numFmt(profile.fundedLoans30d)}
            delta={{ value: '+12.4%', direction: 'up', isGood: true }}
            series={fundedLoansSeries(profile.fundedLoans30d)}
          />
          <KpiCard
            label={`${spec.name} total funded (30d)`}
            value={<Money cents={profile.fundedDollars30dCents} compact />}
            delta={{ value: '+18%', direction: 'up', isGood: true }}
            series={fundedDollarsSeries(profile.fundedDollars30dCents)}
          />
          <KpiCard
            label="Pull-through"
            value={pct(profile.pullThrough, 1)}
            delta={{ value: '+1.2pp', direction: 'up', isGood: true }}
            series={pullThroughSeries(profile.pullThrough)}
            hint="App → funded"
          />
          <KpiCard
            label="Avg loan size"
            value={<Money cents={profile.avgLoanSizeCents} noFractions />}
            delta={{ value: '+2.4%', direction: 'up', isGood: true }}
            series={avgLoanSizeSeries(profile.avgLoanSizeCents)}
          />
          <KpiCard
            label="Net lift vs baseline"
            value={pctPoint(profile.netLiftPp, 1)}
            delta={{ value: '+0.9pp', direction: 'up', isGood: true }}
            series={netLiftSeries(profile.netLiftPp)}
            hint="vs. champion model"
          />
          <KpiCard
            label="Manual review rate"
            value={pct(profile.manualReviewRate, 1)}
            delta={{ value: '-0.3pp', direction: 'down', isGood: true }}
            series={manualReviewSeries(profile.manualReviewRate)}
          />
        </div>

        {/* ───────────────────────── A. Volume & flow funnel ───────────────────────── */}
        <Card className="mb-4">
          <CardHeader
            title={`${spec.name} volume + flow funnel — last 30 days`}
            description={`Every ${persona.applicantSingular} application that hit the ${spec.name} surface. Drop-off % is relative to the prior step.`}
            action={<StatusPill tone="neutral">{numFmt(profile.funnel.applications)} applications</StatusPill>}
          />
          <CardBody>
            <div className="flex flex-col gap-2">
              {funnelSteps.map((step, idx) => {
                const widthPct = (step.value / funnelMax) * 100;
                const prev = idx === 0 ? null : funnelSteps[idx - 1]!.value;
                const drop = prev == null ? null : 1 - step.value / prev;
                const conversion = (step.value / funnelMax);
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className="w-44 shrink-0 text-[12px] font-medium">{step.label}</div>
                    <div className="flex-1 h-7 rounded-md bg-bg-muted/40 overflow-hidden relative">
                      <div
                        className="h-full bg-accent/70 rounded-md flex items-center px-3"
                        style={{ width: `${widthPct}%` }}
                      >
                        <span className="text-[11px] font-semibold tabular-nums text-bg-elevated mix-blend-luminosity">
                          {numFmt(step.value)}
                        </span>
                      </div>
                    </div>
                    <div className="w-20 shrink-0 text-right text-[12px] tabular-nums text-fg-muted">
                      {pct(conversion, 1)} of top
                    </div>
                    <div className="w-24 shrink-0 text-right text-[12px] tabular-nums">
                      {drop == null ? (
                        <span className="text-fg-muted">—</span>
                      ) : (
                        <span className={drop > 0.25 ? 'text-warning' : 'text-fg-muted'}>
                          −{pct(drop, 1)} step
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-fg-muted text-[10px] uppercase tracking-wider">Pre-qual rate</div>
                <div className="text-[14px] font-semibold tabular-nums mt-1">
                  {pct(profile.funnel.prequalPassed / profile.funnel.applications, 1)}
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-fg-muted text-[10px] uppercase tracking-wider">KYC pass-through</div>
                <div className="text-[14px] font-semibold tabular-nums mt-1">
                  {pct(profile.funnel.kycVerified / profile.funnel.prequalPassed, 1)}
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-fg-muted text-[10px] uppercase tracking-wider">Decision approval</div>
                <div className="text-[14px] font-semibold tabular-nums mt-1">
                  {pct(profile.funnel.approved / profile.funnel.decisioned, 1)}
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-fg-muted text-[10px] uppercase tracking-wider">Offer → fund</div>
                <div className="text-[14px] font-semibold tabular-nums mt-1">
                  {pct(profile.funnel.funded / profile.funnel.approved, 1)}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ───────────────────────── Approval by FICO band + decline reasons ───────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader
              title={`${spec.name} approval rate by FICO band`}
              description="Cohorts ≥ 25 applications. Orchestration honours the brand's min-FICO floor."
            />
            <CardBody>
              <div className="text-accent">
                <BarChart
                  data={ficoBandApproval.map((d) => ({ label: d.label, value: d.value * 100 }))}
                  height={170}
                />
              </div>
              <div className="mt-3 text-[12px] text-fg-muted leading-relaxed">
                The 660–699 cohort approval is up 5.4pp vs. last quarter, driven by Plaid cashflow
                additions. ECOA non-discrimination notice + reason codes are enforced on every decline.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={`${spec.name} decline reasons — last 30 days`}
              description="Top 6 reasons cited on Reg B Adverse Action Notices."
            />
            <CardBody>
              <div className="text-chart-4">
                <BarChart
                  data={profile.declineReasons
                    .filter((r) => r.code !== 'other')
                    .map((r) => ({ label: r.label.split(' ').slice(0, 2).join(' '), value: r.pct }))}
                  height={170}
                />
              </div>
              <div className="mt-3 text-[12px] text-fg-muted leading-relaxed">
                Reason taxonomy maps to Reg B § 1002 examples and is reviewed quarterly with compliance.
                Each notice is reproducible from input snapshot + policy version.
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ───────────────────────── C. Lender performance ───────────────────────── */}
        <Card className="mb-4">
          <CardHeader
            title={`${spec.name} lender performance — last 30 days`}
            description={`Only lenders that route ${spec.name} applications appear here. Performance is computed off applications routed under ${brand}_v_2026_05.`}
            action={
              <div className="flex gap-2">
                <StatusPill tone="info">{lenderRows.length} lenders</StatusPill>
                <StatusPill tone="success" dot>
                  {lenderRows.filter((r) => r.status === 'healthy').length} healthy
                </StatusPill>
              </div>
            }
          />
          <CardBody padded={false}>
            <DataTable<LenderPerfRow>
              columns={lenderCols}
              rows={lenderRows}
              rowKey={(r) => r.lender.id}
              empty={`No lenders are routing ${spec.name} applications.`}
              dense
            />
          </CardBody>
        </Card>

        {/* ───────────────────────── D + E: FICO funnel + heatmap ───────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          {/* D. Approval funnel by FICO band */}
          <Card>
            <CardHeader
              title="Approval funnel by FICO band"
              description="Pre-qual → KYC → approved → funded. Cohorts with <10 applications suppressed."
            />
            <CardBody>
              <div className="grid grid-cols-1 gap-2.5">
                {profile.ficoBandFunnel.map((band) => {
                  const max = band.prequal || 1;
                  return (
                    <div key={band.band} className="flex items-center gap-3">
                      <div className="w-16 shrink-0 text-[12px] font-medium tabular-nums">{band.band}</div>
                      <div className="flex-1 grid grid-cols-4 gap-1 h-7">
                        <div className="bg-bg-muted/50 rounded-sm relative overflow-hidden">
                          <div className="absolute inset-y-0 left-0 bg-fg/30" style={{ width: '100%' }} />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums">
                            {numFmt(band.prequal)}
                          </span>
                        </div>
                        <div className="bg-bg-muted/50 rounded-sm relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-fg/50"
                            style={{ width: `${(band.kyc / max) * 100}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums">
                            {numFmt(band.kyc)}
                          </span>
                        </div>
                        <div className="bg-bg-muted/50 rounded-sm relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-accent/70"
                            style={{ width: `${(band.approved / max) * 100}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums">
                            {numFmt(band.approved)}
                          </span>
                        </div>
                        <div className="bg-bg-muted/50 rounded-sm relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-success/70"
                            style={{ width: `${(band.funded / max) * 100}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium tabular-nums">
                            {numFmt(band.funded)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-4 text-[11px] text-fg-muted">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-fg/30" /> Pre-qual
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-fg/50" /> KYC
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-accent/70" /> Approved
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-success/70" /> Funded
                </div>
              </div>
            </CardBody>
          </Card>

          {/* E. Loan size × FICO heatmap */}
          <Card>
            <CardHeader
              title="Approval rate — loan size × FICO band"
              description="6×4 grid. Cell = approved / decisioned %. Empty = below cohort threshold."
            />
            <CardBody>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="text-left text-fg-muted text-[10px] uppercase tracking-wider pb-2 pr-3">
                      FICO
                    </th>
                    {['<$5k', '$5k–15k', '$15k–30k', '$30k+'].map((c) => (
                      <th
                        key={c}
                        className="text-center text-fg-muted text-[10px] uppercase tracking-wider pb-2 px-1"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profile.loanSizeFicoMatrix.map((row) => (
                    <tr key={row.band}>
                      <td className="py-1 pr-3 font-medium tabular-nums">{row.band}</td>
                      {row.cells.map((v, i) => (
                        <td key={i} className="p-0.5">
                          <div
                            className="rounded-sm h-9 flex items-center justify-center font-semibold tabular-nums text-[12px]"
                            style={{ backgroundColor: heatShade(v, 4, 97) }}
                          >
                            {v == null ? (
                              <span className="text-fg-muted">—</span>
                            ) : (
                              <span>{v}%</span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-[11px] text-fg-muted leading-relaxed">
                Cells with fewer than 25 decisioned applications are suppressed to protect inference.
                Heat shading uses a single accent hue (no red/green) to avoid alarm-by-colour. Sorted high
                FICO → low FICO so higher approval bands sit at the top.
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ───────────────────────── F. Vintage performance + G. APR distribution ───────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          {/* F. Vintage performance heatmap */}
          <Card>
            <CardHeader
              title={`${spec.name} vintage performance — last 12 cohorts`}
              description="Cohort = origination month. Cells = delinquency rate at 30/60/90 DPD. Recent cohorts have partial windows (—)."
            />
            <CardBody>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="text-left text-fg-muted text-[10px] uppercase tracking-wider pb-2 pr-3">
                      Cohort
                    </th>
                    {['30 DPD', '60 DPD', '90 DPD'].map((c) => (
                      <th
                        key={c}
                        className="text-center text-fg-muted text-[10px] uppercase tracking-wider pb-2 px-1"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profile.vintageMatrix.map((row) => (
                    <tr key={row.cohort}>
                      <td className="py-1 pr-3 font-mono tabular-nums">{row.cohort}</td>
                      {(['d30', 'd60', 'd90'] as const).map((col) => {
                        const v = row[col];
                        return (
                          <td key={col} className="p-0.5">
                            <div
                              className="rounded-sm h-7 flex items-center justify-center font-semibold tabular-nums text-[12px]"
                              style={{ backgroundColor: heatShade(v, 0.4, 3.5) }}
                            >
                              {v == null || Number.isNaN(v) ? (
                                <span className="text-fg-muted">—</span>
                              ) : (
                                <span>{v.toFixed(1)}%</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 text-[11px] text-fg-muted leading-relaxed">
                Q1 2026 cohort is tracking +40bps above peer-of-record cohort — monitoring. No policy change
                under consideration; ORACLE drift sensor is green.
              </div>
            </CardBody>
          </Card>

          {/* G. APR distribution */}
          <Card>
            <CardHeader
              title={`${spec.name} accepted APR distribution`}
              description={`${spec.name} median is ${profile.aprBrandMedian.toFixed(1)}% — industry comparable median ${profile.aprIndustryMedian.toFixed(1)}%.`}
            />
            <CardBody>
              <div className="relative">
                <div className="text-accent">
                  <BarChart data={profile.aprHistogram} height={180} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-accent" />
                    <span className="font-medium">{spec.name} median {profile.aprBrandMedian.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-fg/40" />
                    <span className="text-fg-muted">Industry median {profile.aprIndustryMedian.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-fg-muted">Δ</span>
                    <span className="font-medium text-success">
                      −{(profile.aprIndustryMedian - profile.aprBrandMedian).toFixed(1)}pp vs. industry
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[12px] text-fg-muted leading-relaxed">
                Histogram is on accepted offers only (e-signed). Quoted-but-declined APRs are excluded so
                this reflects what {persona.applicant} actually pay. Bracket bins are 200 bps wide.
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ───────────────────────── H. Brand-specific top decline reasons ───────────────────────── */}
        <Card className="mb-4">
          <CardHeader
            title={`${spec.name}-specific decline reasons — vertical context`}
            description={`Reg B-mapped reason codes annotated with vertical context for ${persona.merchantNoun}. Click any reason in the master Adverse Action Notice library to see the underlying policy clause.`}
          />
          <CardBody>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {profile.declineReasons.map((r) => (
                <div
                  key={r.code}
                  className="rounded-md border border-border bg-bg-muted/20 p-3 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-fg-muted">{r.code}</span>
                    <span className="text-[12px] font-semibold tabular-nums">{r.pct}%</span>
                  </div>
                  <div className="text-[13px] font-medium">{r.label}</div>
                  <div className="text-[12px] text-fg-muted leading-relaxed">{r.copy}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                    <div className="h-full bg-accent/70 rounded-full" style={{ width: `${r.pct * 3}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* ───────────────────────── I. Fair-lending deep dive ───────────────────────── */}
        <Card className="mb-4">
          <CardHeader
            title={`${spec.name} fair-lending deep dive`}
            description="Disparate-impact matrix, equalised-odds delta, sensitive-postcode coverage, override audit, and Reg B 30-day AAN window compliance."
            action={
              <StatusPill tone="success" dot>
                All controls within tolerance
              </StatusPill>
            }
          />
          <CardBody className="space-y-5">
            {/* 4 × 3 disparate-impact matrix */}
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted mb-2">
                Disparate-impact matrix — protected class × metric
              </div>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="text-left text-fg-muted text-[10px] uppercase tracking-wider pb-2 pr-3">
                      Protected class
                    </th>
                    {diGrid[0]!.map((c) => (
                      <th
                        key={c.label}
                        className="text-left text-fg-muted text-[10px] uppercase tracking-wider pb-2 px-2"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diGrid.map((row, i) => (
                    <tr key={diRowLabels[i]} className="border-t border-border">
                      <td className="py-2 pr-3 text-[12px] font-medium">{diRowLabels[i]}</td>
                      {row.map((c, j) => (
                        <td key={j} className="py-2 px-2">
                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold tabular-nums">
                              {c.label === 'Approval ratio'
                                ? c.delta.toFixed(2)
                                : c.label === 'AAN latency p95'
                                  ? `${c.delta.toFixed(1)}d`
                                  : c.delta.toFixed(3)}
                            </span>
                            <span
                              className={
                                c.ok
                                  ? 'text-[10px] text-fg-muted'
                                  : 'text-[10px] text-warning font-medium'
                              }
                            >
                              {c.ok ? c.note : `${c.note} · watch`}
                            </span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 text-[11px] text-fg-muted leading-relaxed">
                Adverse impact ratio (AIR) is computed weekly on decisioned applications. The 4/5 rule
                threshold is 0.80; any class falling below triggers a soft alert + compliance review (no
                auto-policy change).
              </div>
            </div>

            {/* Equalised-odds delta table per class */}
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-fg-muted mb-2">
                Equalised-odds delta — per class
              </div>
              <div className="grid grid-cols-3 gap-3">
                {diRowLabels.map((cls, i) => (
                  <div
                    key={cls}
                    className="rounded-md border border-border bg-bg-muted/20 p-3 flex flex-col gap-1.5"
                  >
                    <div className="text-[11px] uppercase tracking-wider text-fg-muted">{cls}</div>
                    <div className="flex items-center gap-3 text-[13px]">
                      <span className="tabular-nums">ΔTPR</span>
                      <span className="tabular-nums font-medium">
                        {(0.018 + i * 0.004).toFixed(3)}
                      </span>
                      <span className="text-fg-muted ml-auto text-[11px]">≤ 0.03</span>
                    </div>
                    <div className="flex items-center gap-3 text-[13px]">
                      <span className="tabular-nums">ΔFPR</span>
                      <span className="tabular-nums font-medium">
                        {(0.014 + i * 0.003).toFixed(3)}
                      </span>
                      <span className="text-fg-muted ml-auto text-[11px]">≤ 0.02</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-bg-elevated overflow-hidden">
                      <div
                        className="h-full bg-success/70 rounded-full"
                        style={{ width: `${72 - i * 8}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Postcode coverage + override + AAN latency */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-md border border-border bg-bg-muted/20 p-3 flex flex-col gap-1.5">
                <div className="text-[11px] uppercase tracking-wider text-fg-muted">
                  Sensitive postcodes
                </div>
                <div className="text-[18px] font-semibold tabular-nums">100% coverage</div>
                <div className="text-[12px] text-fg-muted leading-relaxed">
                  All HMDA-sensitive census tracts inside live states are routed through the same
                  decisioning policy. Zero outliers in the last 90 days.
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3 flex flex-col gap-1.5">
                <div className="text-[11px] uppercase tracking-wider text-fg-muted">
                  Override sample audit (14d)
                </div>
                <div className="text-[18px] font-semibold tabular-nums">
                  {brand === 'tradepay' ? '34 / 34' : brand === 'medpay' ? '21 / 21' : '12 / 12'}
                </div>
                <div className="text-[12px] text-fg-muted leading-relaxed">
                  100% of manual overrides reviewed by compliance QA within the 14-day window. Mean review
                  latency 3.4 days. Zero deviations from documented rationale.
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3 flex flex-col gap-1.5">
                <div className="text-[11px] uppercase tracking-wider text-fg-muted">
                  AAN latency (Reg B 30-day)
                </div>
                <div className="text-[18px] font-semibold tabular-nums">
                  p95 = 18.4d · max = 24.1d
                </div>
                <div className="text-[12px] text-fg-muted leading-relaxed">
                  All Adverse Action Notices delivered inside the Reg B 30-day window for the last 365
                  days. Vendor-delivered (Lob) with delivery receipts archived for 7 years.
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-1">
              <DataRow label="Protected-class features" value="0 direct · 0 proxy candidates" />
              <DataRow label="Disparate impact" value="Within 4/5 rule across age, sex, race proxy" />
              <DataRow label="Equalised odds" value="ΔTPR ≤ 0.03 · ΔFPR ≤ 0.02" />
              <DataRow label="Sensitive postcodes" value="Coverage check — 100%" />
              <DataRow label="Override sample audit" value="100% of overrides QA-reviewed in 14d" />
              <DataRow label="Adverse-action latency" value="p95 18.4 days (Reg B 30-day target)" />
            </div>
          </CardBody>
        </Card>

        {/* ───────────────────────── J. Decisioning agent health ───────────────────────── */}
        <Card className="mb-4">
          <CardHeader
            title={`Decisioning agent health — ${spec.name} surface`}
            description="The 7 AUREAN orchestration agents handling this brand. Action counts and latency are filtered to brand-scoped traffic."
            action={
              <StatusPill
                tone={agents.some((a) => a.status === 'degraded') ? 'warning' : 'success'}
                dot
              >
                {agents.filter((a) => a.status === 'healthy').length} / 7 healthy
              </StatusPill>
            }
          />
          <CardBody padded={false}>
            <DataTable<AgentHealth>
              columns={agentCols}
              rows={agents}
              rowKey={(r) => r.code}
              dense
            />
          </CardBody>
        </Card>

        {/* ───────────────────────── K. Recent decisions sample (click to open) ───────────────────────── */}
        <Card className="mb-4">
          <CardHeader
            title="Recent decisions — last 20"
            description={`Click any row to open the underlying application in real time. PII masked by default — JIT unmask requires a documented reason.`}
            action={
              <Link
                href={`/v/${brandSlug}/applications`}
                className="text-[12px] text-accent hover:underline"
              >
                View all {spec.name} applications →
              </Link>
            }
          />
          <CardBody padded={false}>
            <DataTable<RecentDecision>
              columns={recentCols}
              rows={recent}
              rowKey={(r) => r.id}
              dense
            />
          </CardBody>
        </Card>

        {/* ───────────────────────── L. Brand-specific anomaly callouts + vintage rolling ───────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title={`${spec.name} signal anomalies — last 7 days`}
              description="Auto-detected deviations from the rolling baseline. Each anomaly links to the underlying cohort + policy snapshot for diff review."
            />
            <CardBody className="space-y-3">
              <div className="rounded-md border border-border bg-bg-muted/20 p-3 flex items-start gap-3">
                <div className="mt-0.5">
                  <StatusPill tone="success" dot>
                    Up
                  </StatusPill>
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium">
                    {spec.name} 660-699 cohort approval is up 5.4pp vs. last quarter
                  </div>
                  <div className="text-[12px] text-fg-muted mt-1 leading-relaxed">
                    Driven by Plaid cashflow-stability score additions in {brand}_v_2026_05 policy. The
                    660-699 band approval rate moved from 52.4% → 57.8%. Net lift on ORACLE is +0.9pp.
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-bg-muted/20 p-3 flex items-start gap-3">
                <div className="mt-0.5">
                  <StatusPill tone="warning" dot>
                    Watch
                  </StatusPill>
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium">
                    DTI threshold tightening on lender_07 — 3.2% of {persona.applicant} now routing to backup
                  </div>
                  <div className="text-[12px] text-fg-muted mt-1 leading-relaxed">
                    {lenderRows[0]?.lender.displayName ?? 'Primary lender'} tightened DTI ceiling from 50 → 45
                    overnight. NEXUS reroutes affected cohorts to backup tier; stip rate on the backup is
                    1.4pp higher. No customer-facing impact.
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-bg-muted/20 p-3 flex items-start gap-3">
                <div className="mt-0.5">
                  <StatusPill tone="warning" dot>
                    Watch
                  </StatusPill>
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium">
                    Q1 2026 vintage tracking +40bps above peer cohorts — monitoring
                  </div>
                  <div className="text-[12px] text-fg-muted mt-1 leading-relaxed">
                    30-DPD on the Jan-Mar 2026 cohorts is running 40 bps above the rolling-4Q baseline.
                    ORACLE drift sensor remains green; risk team scheduled a Q2 readout for May 28.
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-bg-muted/20 p-3 flex items-start gap-3">
                <div className="mt-0.5">
                  <StatusPill tone="info" dot>
                    Info
                  </StatusPill>
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium">
                    {persona.applicantSingular === 'patient'
                      ? 'Fertility vertical pulled ahead of dental in volume share for the first time'
                      : persona.applicantSingular === 'homeowner'
                        ? 'Solar + roofing combined cap was lifted to 65% of allocated capital — new bookings re-enabled'
                        : 'Bootcamp programs grew 18% MoM — Atlas Career Cap approval rate held at 78%'}
                  </div>
                  <div className="text-[12px] text-fg-muted mt-1 leading-relaxed">
                    Surface-level shift; no policy implications. Logged for trend-watching only. Drill into
                    the underlying cohort via the brand vertical filter.
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={`${spec.name} vintage approval — 12-month rolling`}
              description="Daily approval rate, smoothed."
            />
            <CardBody>
              <div className="text-accent">
                <Sparkline data={profile.approvalSeries} height={88} width={360} />
              </div>
              <div className="mt-3 space-y-1">
                <DataRow label="Rolling 30d" value={pct(profile.approvalRate, 1)} />
                <DataRow
                  label="Rolling 90d"
                  value={pct(profile.approvalRate - 0.008, 1)}
                />
                <DataRow
                  label="Trailing 12 mo"
                  value={pct(profile.approvalRate - 0.024, 1)}
                />
                <DataRow label="Cohorts ≥ 25 apps" value="Yes" />
                <DataRow
                  label="Drift sensor"
                  value={<StatusPill tone="success" dot>Stable</StatusPill>}
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
