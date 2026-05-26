'use client';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { useParams, notFound, useRouter, useSearchParams } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  KpiCard,
  BarChart,
  StatusPill,
  Banner,
  Button,
  DataTable,
  Money,
  Apr,
  ChartIcon,
  LiveIndicator,
  TimeRangeSelector,
  TIME_RANGES,
  InteractiveBarChart,
  type Column,
  type TimeRange,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { ficoBandApproval } from '../../../../lib/mock-data';
import { applicationsForPartner } from '../../../../lib/master-data';
import {
  currentPartnerForBrand,
  partnerShareOfBrand,
  partnerVariance,
} from '../../../../lib/partner-profile';
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
 *  11.  Recent decisions sample (last 20, rows linked to /v/{brand}/applications/{id})
 *
 *  Sections 11 (Fair-lending deep dive), 12 (Decisioning agent
 *  health), and a "brand-anomalies + vintage rolling" grid were
 *  removed from the per-brand portal in 2026-05 — they're operator
 *  metrics, not partner-merchant metrics. The master /insights surface
 *  still renders them for cross-tenant oversight.
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
    approvalSeries: [
      62, 63, 64, 63, 65, 64, 65, 66, 64, 65, 65, 64, 65, 65, 66, 65, 64, 65, 66, 65, 64, 65, 66,
      65, 64, 65, 65, 66, 65, 64.8,
    ],
    latencyMs: 481,
    latencySeries: [
      510, 504, 498, 495, 490, 488, 486, 484, 482, 481, 480, 481, 483, 482, 481, 480, 479, 481, 482,
      481, 480, 481, 482, 481, 481, 480, 481, 482, 481, 481,
    ],
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
      {
        cohort: '2026-04',
        d30: 2.2,
        d60: null as unknown as number,
        d90: null as unknown as number,
      },
      {
        cohort: '2026-05',
        d30: null as unknown as number,
        d60: null as unknown as number,
        d90: null as unknown as number,
      },
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
      {
        code: 'min_fico_floor',
        label: 'FICO below floor',
        pct: 24,
        copy: 'Patient FICO below partner clinic’s prime-only lender minimum (660). Routed to sub-prime tier where eligible.',
      },
      {
        code: 'insurance_verification_failed',
        label: 'Insurance verification failed',
        pct: 19,
        copy: 'Eligibility ping to payer returned non-active coverage; patient cost-share could not be reconciled before decisioning timed out.',
      },
      {
        code: 'debt_to_income_high',
        label: 'DTI > policy',
        pct: 17,
        copy: 'DTI > 50% under MedPay v2026.05 policy; common in elective dental + fertility cohorts.',
      },
      {
        code: 'recent_delinquency_60d',
        label: 'Recent 60-day delinquency',
        pct: 14,
        copy: 'Open 60-day delinquency on Bureau tradeline reported within last 6 months.',
      },
      {
        code: 'treatment_plan_unverified',
        label: 'Treatment plan unverified',
        pct: 12,
        copy: 'Procedure code + clinic NPI mismatch — verification re-queued to clinic admin.',
      },
      {
        code: 'insufficient_stability',
        label: 'Insufficient stability',
        pct: 8,
        copy: 'Cashflow stability score below 55 on Plaid asset report.',
      },
      {
        code: 'other',
        label: 'Other',
        pct: 6,
        copy: 'Includes ID document quality, address mismatch, and fraud flags.',
      },
    ],
    lenderSlugs: [],
  },
  tradepay: {
    approvalRate: 0.581,
    approvalSeries: [
      55, 56, 56, 57, 57, 58, 57, 58, 58, 58, 59, 58, 57, 58, 58, 58, 58, 58, 59, 58, 58, 58, 59,
      58, 58, 58, 58, 58, 58, 58.1,
    ],
    latencyMs: 612,
    latencySeries: [
      702, 688, 681, 674, 668, 660, 654, 648, 642, 636, 630, 624, 618, 612, 614, 612, 611, 610, 612,
      614, 611, 610, 612, 614, 612, 611, 612, 614, 612, 612,
    ],
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
      {
        cohort: '2026-04',
        d30: 2.9,
        d60: null as unknown as number,
        d90: null as unknown as number,
      },
      {
        cohort: '2026-05',
        d30: null as unknown as number,
        d60: null as unknown as number,
        d90: null as unknown as number,
      },
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
      {
        code: 'dti_high',
        label: 'DTI above policy',
        pct: 26,
        copy: 'Combined housing + installment debt exceeds 45% on trades cohort — typically homeowners with active HELOC.',
      },
      {
        code: 'lien_position_concern',
        label: 'Lien position concerns',
        pct: 18,
        copy: 'Subject property has open mechanics lien or recorded second mortgage; routes to BuzzPay only.',
      },
      {
        code: 'min_fico_floor',
        label: 'FICO below floor',
        pct: 17,
        copy: 'Homeowner FICO below Orion Capital floor (700); reroutes to Kestrel (620+) if state-eligible.',
      },
      {
        code: 'recent_delinquency_60d',
        label: 'Recent 60-day delinquency',
        pct: 13,
        copy: 'Open mortgage or auto delinquency within 12 months — Reg B-mapped reason code dq_60.',
      },
      {
        code: 'income_unverified',
        label: 'Income unverified',
        pct: 11,
        copy: 'Self-employed contractor income could not be verified via Plaid; W-2 stub fallback failed parsing.',
      },
      {
        code: 'job_scope_unverified',
        label: 'Job scope unverified',
        pct: 9,
        copy: 'Contractor SOW PDF rejected at OCR — line items did not match category cap on TradePay HVAC product.',
      },
      {
        code: 'other',
        label: 'Other',
        pct: 6,
        copy: 'Includes state-eligibility, identity-document quality, and consortium fraud flags.',
      },
    ],
    lenderSlugs: [],
  },
  coachpay: {
    approvalRate: 0.714,
    approvalSeries: [
      69, 70, 70, 71, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71, 71, 72, 71,
      71, 72, 71, 71, 72, 71, 71.4,
    ],
    latencyMs: 446,
    latencySeries: [
      495, 488, 482, 476, 470, 464, 460, 456, 452, 450, 448, 446, 446, 446, 446, 446, 445, 446, 447,
      446, 446, 445, 446, 447, 446, 446, 446, 446, 446, 446,
    ],
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
      {
        cohort: '2026-04',
        d30: 2.4,
        d60: null as unknown as number,
        d90: null as unknown as number,
      },
      {
        cohort: '2026-05',
        d30: null as unknown as number,
        d60: null as unknown as number,
        d90: null as unknown as number,
      },
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
      {
        code: 'income_variability',
        label: 'Income variability (coaching biz)',
        pct: 23,
        copy: 'Self-employed coach income volatility exceeds policy variance; routes to ClearPath for sub-prime if eligible.',
      },
      {
        code: 'min_fico_floor',
        label: 'FICO below floor',
        pct: 19,
        copy: 'Student FICO below Atlas Career Capital prime floor (700); reroutes to ClearPath (600+).',
      },
      {
        code: 'program_unaccredited',
        label: 'Program not on approved list',
        pct: 16,
        copy: 'CoachPay only finances programs on the curated school list; submission re-queued to compliance for whitelist review.',
      },
      {
        code: 'dti_high',
        label: 'DTI above policy',
        pct: 14,
        copy: 'Combined student debt + installment exceeds 50%; especially common for bootcamp + certification stacking.',
      },
      {
        code: 'thin_file',
        label: 'Thin credit file',
        pct: 11,
        copy: '<24 months of credit history; alt-data fallback (rent + utilities) did not return enough signal.',
      },
      {
        code: 'enrollment_unverified',
        label: 'Enrollment unverified',
        pct: 10,
        copy: 'Program admin did not confirm enrollment within decision SLA — retry queued.',
      },
      {
        code: 'other',
        label: 'Other',
        pct: 7,
        copy: 'Includes ID-document quality, address mismatch, and OFAC flags.',
      },
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
    const appsBase = brand === 'tradepay' ? 420 : brand === 'medpay' ? 240 : 120;
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
    'J.M.',
    'D.K.',
    'A.R.',
    'S.P.',
    'L.W.',
    'R.B.',
    'M.T.',
    'E.H.',
    'P.S.',
    'O.G.',
    'K.N.',
    'T.W.',
    'C.B.',
    'F.J.',
    'B.L.',
    'N.R.',
    'Q.A.',
    'I.S.',
    'V.O.',
    'Y.D.',
  ];
  const baseSizeCents = brand === 'tradepay' ? 14_000_00 : brand === 'medpay' ? 6_400_00 : 3_500_00;
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
// Formatters
const pct = (n: number, decimals = 1) => `${(n * 100).toFixed(decimals)}%`;
const pctPoint = (n: number, decimals = 1) => `${n.toFixed(decimals)}pp`;
const numFmt = (n: number) => Intl.NumberFormat('en-US').format(n);
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

/**
 * KpiTileLink — wrap a KpiCard primitive in a router Link so the entire
 * card becomes the drill-in affordance. Mirrors the helper in
 * /admin/observability/page.tsx (Sprint H pattern).
 */
function KpiTileLink({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="block rounded-lg transition-colors hover:[&>div]:border-border-strong hover:[&>div]:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      {children}
    </Link>
  );
}

/* FICO band → canonical tier mapping used by the chart drill-in. The
 * insights chart uses band labels like "700+", "660–699"; the
 * /applications list reads `tier=` and matches against
 * `creditTierFor()` in dashboard-metrics.ts. */
const FICO_BAND_TO_TIER: Record<string, string> = {
  '720+': 'Prime',
  '700+': 'Prime',
  '700–719': 'Prime',
  '680–699': 'NearPrime',
  '660–699': 'NearPrime',
  '660–679': 'NearPrime',
  '640–659': 'NearPrime',
  '620–639': 'Subprime',
  '<660': 'Subprime',
  '<620': 'DeepSubprime',
};

export default function BrandInsightsPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brandCode = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  if (!brandCode || brandCode === 'direct') notFound();
  const brand = brandCode as Exclude<BrandCode, 'direct'>;
  const spec = BRANDS[brand];

  /* Sprint H: URL-driven time range so insights deep-links carry the
   * window. Drill-in URLs propagate `?range=` to the destination list. */
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
  const rangeQs = `&range=${range}`;
  const baseList = `/v/${brandSlug}/applications`;

  // Tenant isolation: this page renders the SIGNED-IN partner's
  // insights only. Pre-fix, the `?partnerId=` query string let any
  // viewer scope to any partner's data; the default view rendered
  // brand-wide aggregates that leaked cross-tenant volume. Now the
  // partner is resolved from session (demo cookie today, JWT.merchantId
  // tomorrow) and there is NO way to override.
  const partnerCtx = currentPartnerForBrand(brand);
  if (!partnerCtx) notFound();
  const partnerApps = applicationsForPartner(partnerCtx.id);

  // Per-partner scaled profile. Volume metrics (funnel, fundedLoans30d,
  // dollars) are scaled down by partner share of brand volume; rates
  // (approval %, latency, take-up) get a small deterministic variance
  // off the brand mean so different partners don't read identically.
  const brandProfile = PROFILES[brand];
  const partnerShare = partnerShareOfBrand(partnerCtx, brand);
  const profile = useMemo(() => {
    const scaleInt = (n: number): number => Math.round(n * partnerShare);
    const scaleBig = (cents: number): number => Math.round(cents * partnerShare);
    const rateOffset = partnerVariance(partnerCtx.id, 0.04); // ±4pp on rates
    const latencyOffset = Math.round(partnerVariance(partnerCtx.id, 60)); // ±60ms
    return {
      ...brandProfile,
      approvalRate: Math.max(0, Math.min(1, brandProfile.approvalRate + rateOffset)),
      latencyMs: Math.max(100, brandProfile.latencyMs + latencyOffset),
      takeUpRate: Math.max(0, Math.min(1, brandProfile.takeUpRate + rateOffset / 2)),
      manualReviewRate: Math.max(0, brandProfile.manualReviewRate + rateOffset / 8),
      fundedLoans30d: scaleInt(brandProfile.fundedLoans30d),
      fundedDollars30dCents: scaleBig(brandProfile.fundedDollars30dCents),
      funnel: {
        applications: scaleInt(brandProfile.funnel.applications),
        prequalPassed: scaleInt(brandProfile.funnel.prequalPassed),
        kycVerified: scaleInt(brandProfile.funnel.kycVerified),
        decisioned: scaleInt(brandProfile.funnel.decisioned),
        approved: scaleInt(brandProfile.funnel.approved),
        funded: scaleInt(brandProfile.funnel.funded),
      },
      ficoBandFunnel: brandProfile.ficoBandFunnel.map((row) => ({
        ...row,
        prequal: scaleInt(row.prequal),
        kyc: scaleInt(row.kyc),
        approved: scaleInt(row.approved),
        funded: scaleInt(row.funded),
      })),
      // Histograms + heatmaps stay rate-shaped (no absolute volume),
      // so we keep them — they describe the SAME risk distribution the
      // partner's loans roll up into.
    };
  }, [brandProfile, partnerCtx.id, partnerShare]);
  const persona = PERSONAS[brand];
  const lenderRows = lendersForBrand(brand);
  const recent = recentDecisionsFor(brand);

  // Volume + flow funnel — compute drop-off % from the partner-scoped profile.
  const funnelSteps = [
    { key: 'applications', label: 'Applications received', value: profile.funnel.applications },
    { key: 'prequalPassed', label: 'Pre-qual passed', value: profile.funnel.prequalPassed },
    { key: 'kycVerified', label: 'KYC verified', value: profile.funnel.kycVerified },
    { key: 'decisioned', label: 'Decisioned', value: profile.funnel.decisioned },
    { key: 'approved', label: 'Approved', value: profile.funnel.approved },
    { key: 'funded', label: 'Funded', value: profile.funnel.funded },
  ];
  const funnelMax = Math.max(funnelSteps[0]!.value, 1);

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
        const tone: Record<
          RecentDecision['decision'],
          'success' | 'warning' | 'danger' | 'info' | 'neutral'
        > = {
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
      cell: (r) => <span className="font-mono text-[11px] text-fg-muted">{r.topReasonCode}</span>,
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
      cell: (r) => (
        <span className="text-[12px] tabular-nums text-fg-muted">{fmtDur(r.decisionedMs)}</span>
      ),
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

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: spec.name, href: `/v/${brandSlug}` }, { label: 'Insights' }]}
        title={`${partnerCtx.legalName} · Insights`}
        description={`Approval, decline, latency, lender mix, vintage, and fair-lending cuts for ${partnerCtx.legalName} on ${spec.name}. Scoped to this account only — master operators see the full ${spec.name} network.`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <LiveIndicator pulseKey={range} />
            <TimeRangeSelector value={range} onChange={handleRangeChange} />
            <Button variant="ghost" leadingIcon={<ChartIcon size={16} />}>
              Schedule report
            </Button>
            <Button>Download MIS pack</Button>
          </div>
        }
        meta={
          <>
            <StatusPill tone="success">Bias review — within tolerance</StatusPill>
            <StatusPill tone="info">
              {spec.name} policy {brand}_v_2026_05
            </StatusPill>
            <StatusPill tone="neutral">Policy version orch_v_2026_05_a</StatusPill>
          </>
        }
      />
      <PageBody>
        {/* Tenant-isolation banner — every figure below is for this
            business only. partnerCtx is non-null by construction (the
            page notFound()s above if resolution fails). */}
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-bg-muted/40 px-4 py-3">
          <span
            className="size-9 rounded-full bg-fg text-bg-elevated flex items-center justify-center font-semibold text-[12px] tracking-wider shrink-0"
            aria-hidden
          >
            {partnerCtx.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-fg-muted">
              Your business view
            </p>
            <p className="text-[13px] font-semibold text-fg truncate">
              {partnerCtx.legalName}
              <span className="ml-2 font-normal text-fg-muted">
                · {spec.name} merchant · {partnerApps.length} application
                {partnerApps.length === 1 ? '' : 's'} · scoped to this account only
              </span>
            </p>
          </div>
          <Link
            href={`/v/${brandSlug}/team`}
            className="text-[11px] text-accent hover:underline inline-flex items-center gap-1 shrink-0"
          >
            Manage team &amp; roles
          </Link>
        </div>
        <Banner intent="info" className="mb-5">
          The fair-lending monitoring engine evaluates disparate impact + equalised odds on each
          decisioned {spec.name} cohort weekly. Quarterly written review is exported to your
          bank-partner audit pack. AAN latency p95 = 18.4 days (Reg B 30-day window).
        </Banner>

        {/* ───────────────────────── KPI strip ─────────────────────────
           Sprint H: the four most actionable KPIs are clickable drill-ins.
           Approval rate / funded loans / total funded / manual review all
           map cleanly to a `/applications?status=` filter scoped to this
           brand. The remaining KPIs are derived metrics (latency, lift)
           where a list drill-in is meaningless — left static. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiTileLink
            href={`${baseList}?status=approved${rangeQs}`}
            ariaLabel="Open approved applications"
          >
            <KpiCard
              label={`${spec.name} approval rate (30d)`}
              value={pct(profile.approvalRate, 1)}
              delta={{ value: '+2.1pp', direction: 'up', isGood: true }}
              series={profile.approvalSeries}
            />
          </KpiTileLink>
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
          <KpiTileLink
            href={`${baseList}?status=funded${rangeQs}`}
            ariaLabel="Open funded applications"
          >
            <KpiCard
              label={`${spec.name} funded loans (30d)`}
              value={numFmt(profile.fundedLoans30d)}
              delta={{ value: '+12.4%', direction: 'up', isGood: true }}
              series={fundedLoansSeries(profile.fundedLoans30d)}
            />
          </KpiTileLink>
          <KpiTileLink
            href={`${baseList}?status=funded${rangeQs}`}
            ariaLabel="Open funded applications by total funded"
          >
            <KpiCard
              label={`${spec.name} total funded (30d)`}
              value={<Money cents={profile.fundedDollars30dCents} compact />}
              delta={{ value: '+18%', direction: 'up', isGood: true }}
              series={fundedDollarsSeries(profile.fundedDollars30dCents)}
            />
          </KpiTileLink>
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
          <KpiTileLink
            href={`${baseList}?status=in_review${rangeQs}`}
            ariaLabel="Open applications under manual review"
          >
            <KpiCard
              label="Manual review rate"
              value={pct(profile.manualReviewRate, 1)}
              delta={{ value: '-0.3pp', direction: 'down', isGood: true }}
              series={manualReviewSeries(profile.manualReviewRate)}
            />
          </KpiTileLink>
        </div>

        {/* ───────────────────────── A. Volume & flow funnel ───────────────────────── */}
        <Card className="mb-4">
          <CardHeader
            title={`${spec.name} volume + flow funnel — last 30 days`}
            description={`Every ${persona.applicantSingular} application that hit the ${spec.name} surface. Drop-off % is relative to the prior step.`}
            action={
              <StatusPill tone="neutral">
                {numFmt(profile.funnel.applications)} applications
              </StatusPill>
            }
          />
          <CardBody>
            <div className="flex flex-col gap-2">
              {funnelSteps.map((step, idx) => {
                const widthPct = (step.value / funnelMax) * 100;
                const prev = idx === 0 ? null : funnelSteps[idx - 1]!.value;
                const drop = prev == null ? null : 1 - step.value / prev;
                const conversion = step.value / funnelMax;
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
                <div className="text-fg-muted text-[10px] uppercase tracking-wider">
                  Pre-qual rate
                </div>
                <div className="text-[14px] font-semibold tabular-nums mt-1">
                  {pct(profile.funnel.prequalPassed / profile.funnel.applications, 1)}
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-fg-muted text-[10px] uppercase tracking-wider">
                  KYC pass-through
                </div>
                <div className="text-[14px] font-semibold tabular-nums mt-1">
                  {pct(profile.funnel.kycVerified / profile.funnel.prequalPassed, 1)}
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-fg-muted text-[10px] uppercase tracking-wider">
                  Decision approval
                </div>
                <div className="text-[14px] font-semibold tabular-nums mt-1">
                  {pct(profile.funnel.approved / profile.funnel.decisioned, 1)}
                </div>
              </div>
              <div className="rounded-md border border-border bg-bg-muted/20 p-3">
                <div className="text-fg-muted text-[10px] uppercase tracking-wider">
                  Offer → fund
                </div>
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
              description="Click a band to filter — cohorts ≥ 25 applications. Orchestration honours the brand's min-FICO floor."
            />
            <CardBody>
              {/* Sprint H: FICO band → /applications?tier=. The
                  destination list reads `tier=` and applies a FICO-band
                  filter (see dashboard-metrics → creditTierFor). */}
              <InteractiveBarChart
                data={ficoBandApproval.map((d) => ({
                  label: d.label,
                  value: Math.round(d.value * 100),
                  meta: { band: d.label },
                }))}
                yMax={100}
                formatValue={(d) => `${d.value}% approved`}
                onSelect={(d) => {
                  const band = (d.meta?.band as string | undefined) ?? d.label;
                  const tier = FICO_BAND_TO_TIER[band];
                  const qs = tier
                    ? `?tier=${encodeURIComponent(tier)}${rangeQs}`
                    : `?band=${encodeURIComponent(band)}${rangeQs}`;
                  router.push(`${baseList}${qs}`);
                }}
                ariaLabel={`${spec.name} approval rate by FICO band`}
              />
              <div className="mt-3 text-[12px] text-fg-muted leading-relaxed">
                The 660–699 cohort approval is up 5.4pp vs. last quarter, driven by Plaid cashflow
                additions. ECOA non-discrimination notice + reason codes are enforced on every
                decline.
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
                    .map((r) => ({
                      label: r.label.split(' ').slice(0, 2).join(' '),
                      value: r.pct,
                    }))}
                  height={170}
                />
              </div>
              <div className="mt-3 text-[12px] text-fg-muted leading-relaxed">
                Reason taxonomy maps to Reg B § 1002 examples and is reviewed quarterly with
                compliance. Each notice is reproducible from input snapshot + policy version.
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
                      <div className="w-16 shrink-0 text-[12px] font-medium tabular-nums">
                        {band.band}
                      </div>
                      <div className="flex-1 grid grid-cols-4 gap-1 h-7">
                        <div className="bg-bg-muted/50 rounded-sm relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-fg/30"
                            style={{ width: '100%' }}
                          />
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
                Cells with fewer than 25 decisioned applications are suppressed to protect
                inference. Heat shading uses a single accent hue (no red/green) to avoid
                alarm-by-colour. Sorted high FICO → low FICO so higher approval bands sit at the
                top.
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
                Q1 2026 cohort is tracking +40bps above peer-of-record cohort — monitoring. No
                policy change under consideration; ORACLE drift sensor is green.
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
                    <span className="font-medium">
                      {spec.name} median {profile.aprBrandMedian.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-fg/40" />
                    <span className="text-fg-muted">
                      Industry median {profile.aprIndustryMedian.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-fg-muted">Δ</span>
                    <span className="font-medium text-success">
                      −{(profile.aprIndustryMedian - profile.aprBrandMedian).toFixed(1)}pp vs.
                      industry
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[12px] text-fg-muted leading-relaxed">
                Histogram is on accepted offers only (e-signed). Quoted-but-declined APRs are
                excluded so this reflects what {persona.applicant} actually pay. Bracket bins are
                200 bps wide.
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
                    <div
                      className="h-full bg-accent/70 rounded-full"
                      style={{ width: `${r.pct * 3}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
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
      </PageBody>
    </>
  );
}
