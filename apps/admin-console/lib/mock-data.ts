/**
 * Admin/Ops mock data. Mirrors the EazePay internal operator view —
 * application queue, UW workspace, lender route inspector (cross-
 * lender, unblurred), audit chain, risk flags, compliance reviews,
 * and JIT PII unmask flow.
 */
import type { RouteStep } from '@eazepay/ui/web';

export interface QueueApplication {
  id: string;
  applicantInitials: string;
  state: string;
  requestedCents: number;
  termMonths: number;
  category: 'home_improvement' | 'auto' | 'medical' | 'retail' | 'personal' | 'consolidation';
  status:
    | 'submitted'
    | 'underwriting'
    | 'offers_presented'
    | 'manual_review'
    | 'docs_required'
    | 'approved'
    | 'declined'
    | 'funded';
  riskScore: number; // 0-1000
  fraudFlags: number;
  channel: 'merchant' | 'consumer-direct';
  merchantName?: string;
  submittedAt: string;
  ageHours: number;
  /** UW analyst assigned. Null = unassigned, system-routed. */
  assignedTo: string | null;
  routedLenderCount: number;
  bestOfferAprBps?: number;
  /** Compliance hold flag */
  hold?: 'aml' | 'sanctions' | 'sar' | null;
}

export const queueApplications: QueueApplication[] = [
  {
    id: 'app_4nqLkR2vTjW',
    applicantInitials: 'J.M.',
    state: 'TX',
    requestedCents: 1_850_000,
    termMonths: 60,
    category: 'home_improvement',
    status: 'offers_presented',
    riskScore: 122,
    fraudFlags: 0,
    channel: 'merchant',
    merchantName: 'Pacific Solar Co.',
    submittedAt: '2026-05-04T18:40:11Z',
    ageHours: 0.2,
    assignedTo: null,
    routedLenderCount: 3,
    bestOfferAprBps: 1099,
  },
  {
    id: 'app_8mRT2WQpKvN',
    applicantInitials: 'D.K.',
    state: 'CA',
    requestedCents: 720_000,
    termMonths: 36,
    category: 'medical',
    status: 'funded',
    riskScore: 158,
    fraudFlags: 0,
    channel: 'merchant',
    merchantName: 'OrthoSmile Family Dental',
    submittedAt: '2026-05-04T17:18:00Z',
    ageHours: 1.4,
    assignedTo: 'Priya V.',
    routedLenderCount: 2,
    bestOfferAprBps: 1499,
  },
  {
    id: 'app_9xQpL4mNkjT',
    applicantInitials: 'A.R.',
    state: 'FL',
    requestedCents: 1_200_000,
    termMonths: 48,
    category: 'consolidation',
    status: 'declined',
    riskScore: 312,
    fraudFlags: 1,
    channel: 'consumer-direct',
    submittedAt: '2026-05-04T16:02:00Z',
    ageHours: 2.7,
    assignedTo: 'Devon L.',
    routedLenderCount: 4,
  },
  {
    id: 'app_KvN2QpL8mqT',
    applicantInitials: 'M.T.',
    state: 'NY',
    requestedCents: 2_500_000,
    termMonths: 72,
    category: 'home_improvement',
    status: 'manual_review',
    riskScore: 248,
    fraudFlags: 2,
    channel: 'merchant',
    merchantName: 'Bayview Roof & Gutter',
    submittedAt: '2026-05-04T15:11:00Z',
    ageHours: 3.5,
    assignedTo: 'Devon L.',
    routedLenderCount: 1,
    hold: 'sar',
  },
  {
    id: 'app_2KvNRpL8mqT',
    applicantInitials: 'S.P.',
    state: 'GA',
    requestedCents: 2_500_000,
    termMonths: 84,
    category: 'home_improvement',
    status: 'approved',
    riskScore: 88,
    fraudFlags: 0,
    channel: 'merchant',
    merchantName: 'Pacific Solar Co.',
    submittedAt: '2026-05-04T14:48:00Z',
    ageHours: 4.0,
    assignedTo: null,
    routedLenderCount: 3,
    bestOfferAprBps: 899,
  },
  {
    id: 'app_5NQpRT8mvK2',
    applicantInitials: 'L.W.',
    state: 'NC',
    requestedCents: 980_000,
    termMonths: 60,
    category: 'home_improvement',
    status: 'docs_required',
    riskScore: 192,
    fraudFlags: 0,
    channel: 'merchant',
    merchantName: 'Bayview Roof & Gutter',
    submittedAt: '2026-05-04T13:21:00Z',
    ageHours: 5.5,
    assignedTo: 'Priya V.',
    routedLenderCount: 2,
  },
  {
    id: 'app_7tpQR2NvKmL',
    applicantInitials: 'R.B.',
    state: 'WA',
    requestedCents: 450_000,
    termMonths: 24,
    category: 'personal',
    status: 'funded',
    riskScore: 104,
    fraudFlags: 0,
    channel: 'consumer-direct',
    submittedAt: '2026-05-04T12:08:00Z',
    ageHours: 6.7,
    assignedTo: 'Priya V.',
    routedLenderCount: 4,
    bestOfferAprBps: 1199,
  },
];

export const queueKpis = {
  inQueue: 47,
  inQueueDelta: { value: '+8', direction: 'up' as const, isGood: false },
  underwritingP95: '14m',
  underwritingP95Delta: { value: '-3m', direction: 'down' as const, isGood: true },
  fundedToday: '$1.21M',
  fundedTodayDelta: { value: '+22%', direction: 'up' as const, isGood: true },
  fraudRate7d: '0.41%',
  fraudRateDelta: { value: '-0.08pp', direction: 'down' as const, isGood: true },
};

export const lenderHealth = [
  { name: 'BuzzPay (internal)', tier: 0, status: 'ok', p95Ms: 184, errorRate: 0, approvalRate: 0.64 },
  { name: 'Evergreen Prime', tier: 1, status: 'ok', p95Ms: 612, errorRate: 0.002, approvalRate: 0.61 },
  { name: 'Sterling Direct', tier: 1, status: 'degraded', p95Ms: 1240, errorRate: 0.041, approvalRate: 0.57 },
  { name: 'PathPoint Medical', tier: 2, status: 'ok', p95Ms: 488, errorRate: 0.004, approvalRate: 0.58 },
  { name: 'Solstice Auto', tier: 2, status: 'ok', p95Ms: 712, errorRate: 0.011, approvalRate: 0.52 },
  { name: 'Bluemark Subprime', tier: 4, status: 'paused', p95Ms: 0, errorRate: 0, approvalRate: 0.71 },
];

export const auditLogs = [
  { id: 'evt_8KvR2NQp', at: '2026-05-04T18:42:01Z', actor: 'system', action: 'application.offers.presented', target: 'app_4nqLkR2vTjW' },
  { id: 'evt_KvR2NQpLm', at: '2026-05-04T18:42:00Z', actor: 'system', action: 'lender.route.evaluated', target: 'app_4nqLkR2vTjW · evergreen_prime' },
  { id: 'evt_R2NQpLmKv', at: '2026-05-04T18:41:58Z', actor: 'system', action: 'lender.route.evaluated', target: 'app_4nqLkR2vTjW · buzzpay' },
  { id: 'evt_NQpLmKvR2', at: '2026-05-04T18:41:55Z', actor: 'system', action: 'application.submitted', target: 'app_4nqLkR2vTjW' },
  { id: 'evt_QpLmKvR2N', at: '2026-05-04T18:41:52Z', actor: 'cust_jM7p2…', action: 'consent.granted', target: 'soft_pull · permissible_purpose 604(a)(3)(A)' },
  { id: 'evt_pLmKvR2NQ', at: '2026-05-04T17:21:33Z', actor: 'priya@eazepay.com', action: 'application.approved', target: 'app_8mRT2WQpKvN' },
  { id: 'evt_LmKvR2NQp', at: '2026-05-04T17:21:30Z', actor: 'priya@eazepay.com', action: 'pii.unmask.read', target: 'cust_dK3p2… · field: ssn' },
  { id: 'evt_mKvR2NQpL', at: '2026-05-04T17:18:10Z', actor: 'system', action: 'application.submitted', target: 'app_8mRT2WQpKvN' },
];

export const riskFlags = [
  {
    id: 'rf_8KvR2NQp',
    subject: 'app_KvN2QpL8mqT',
    flagType: 'velocity_3_apps_24h',
    severity: 'medium' as const,
    raisedAt: '2026-05-04T15:11:00Z',
    detail: 'Same device fingerprint submitted 3 applications in 24h across 2 surfaces.',
  },
  {
    id: 'rf_KvR2NQpLm',
    subject: 'cust_9xQp…',
    flagType: 'email_domain_disposable',
    severity: 'low' as const,
    raisedAt: '2026-05-04T16:02:00Z',
    detail: 'Applicant email matches known disposable domain list (Emailage risk score 712).',
  },
  {
    id: 'rf_R2NQpLmKv',
    subject: 'app_KvN2QpL8mqT',
    flagType: 'ofac_secondary_hit',
    severity: 'high' as const,
    raisedAt: '2026-05-04T15:11:30Z',
    detail: 'Soft fuzzy match against Consolidated Sanctions list — opened compliance review #cr_8Kv.',
  },
];

export const piiUnmaskRequests = [
  {
    id: 'pu_8KvR2NQp',
    requestedBy: 'priya@eazepay.com',
    subject: 'cust_dK3p2…',
    fields: ['ssn', 'dob', 'address'],
    reason: 'Approval review · file mismatch on bank statement.',
    requestedAt: '2026-05-04T17:21:18Z',
    status: 'approved' as const,
    approver: 'devon@eazepay.com',
    expiresAt: '2026-05-04T17:51:18Z',
  },
  {
    id: 'pu_KvR2NQpLm',
    requestedBy: 'priya@eazepay.com',
    subject: 'cust_KvN2…',
    fields: ['ssn', 'address', 'email'],
    reason: 'SAR pre-filing intake.',
    requestedAt: '2026-05-04T15:14:00Z',
    status: 'pending' as const,
  },
];

export const exampleRouteStepsAdmin: RouteStep[] = [
  {
    tier: 'Tier 0 — Internal',
    productName: 'BuzzPay Home Improvement (TrueTopia)',
    lenderName: 'BuzzPay',
    outcome: 'ineligible',
    latencyMs: 184,
    reasonCode: 'capacity_full_vintage',
    reasonDetail:
      'BuzzPay 2026-Q2 home-improvement vintage at 96% allocated; new bookings paused by guardrail (vintage_concentration_breach).',
    at: '2026-05-04T18:41:58Z',
  },
  {
    tier: 'Tier 1 — Prime',
    productName: 'Evergreen Home Improvement (Prime)',
    lenderName: 'Evergreen Prime',
    outcome: 'approved',
    latencyMs: 612,
    reasonCode: 'approved_within_policy',
    reasonDetail:
      'FICO 762, DTI 28.4%, Plaid-verified income, stability 4.2 yr. APR floor + 200 bps based on cashflow score.',
    at: '2026-05-04T18:42:00Z',
  },
  {
    tier: 'Tier 1 — Prime',
    productName: 'Sterling Direct Home',
    lenderName: 'Sterling',
    outcome: 'declined',
    latencyMs: 1240,
    reasonCode: 'state_residence_unsupported',
    reasonDetail: 'Sterling not licensed in TX for second-lien-style home improvement; orchestration filtered out at compliance step.',
    at: '2026-05-04T18:42:01Z',
  },
  {
    tier: 'Tier 2 — Specialist',
    productName: 'Solstice Home',
    lenderName: 'Solstice',
    outcome: 'approved',
    latencyMs: 712,
    reasonCode: 'approved_within_policy',
    reasonDetail: 'Counter at $1.7M / 60 / 1199 bps. Not surfaced — beaten by Tier 1 on cost.',
    at: '2026-05-04T18:42:01Z',
  },
];

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
