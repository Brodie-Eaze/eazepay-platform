/**
 * Mock data used by the Partner Portal for the BD demo. Mirrors the
 * shape of what a real lender partner would see for their slice of the
 * platform: applications routed to them, decisioning results, latency,
 * funding, and configuration.
 *
 * Real data lands when `/v1/partner/*` endpoints + partner OAuth are
 * wired through the BFF. Until then, this file is the single source so
 * every screen is consistent.
 */
export const partnerOrg = {
  id: 'lender_crossriver_evergreen',
  legalName: 'Evergreen Prime Finance',
  displayName: 'Evergreen Prime',
  tier: 'Tier 1 — Prime',
  contactName: 'Maya Chen',
  contactTitle: 'Head of Partnerships',
  productCount: 3,
  liveStates: 41,
  joinedAt: '2025-11-04',
};

export interface RoutedApplication {
  id: string;
  status: 'approved' | 'declined' | 'ineligible' | 'pending' | 'expired' | 'funded';
  applicantInitials: string;
  state: string;
  channel: 'merchant' | 'consumer-direct';
  merchantName?: string;
  requestedCents: number;
  termMonths: number;
  category: 'home_improvement' | 'auto' | 'medical' | 'retail' | 'personal' | 'consolidation';
  ficoBand: '<580' | '580-619' | '620-659' | '660-699' | '700-739' | '740-779' | '780+';
  decisionAt: string; // ISO
  latencyMs: number;
  aprBps?: number;
  fundedCents?: number;
  declineReasons?: string[];
  tier: 0 | 1 | 2 | 3 | 4;
}

export const applications: RoutedApplication[] = [
  {
    id: 'app_4nqLkR2vTjW',
    status: 'approved',
    applicantInitials: 'J.M.',
    state: 'TX',
    channel: 'merchant',
    merchantName: 'Pacific Solar Co.',
    requestedCents: 1_850_000,
    termMonths: 60,
    category: 'home_improvement',
    ficoBand: '740-779',
    decisionAt: '2026-05-04T18:42:00Z',
    latencyMs: 612,
    aprBps: 1099,
    tier: 1,
  },
  {
    id: 'app_8mRT2WQpKvN',
    status: 'funded',
    applicantInitials: 'D.K.',
    state: 'CA',
    channel: 'merchant',
    merchantName: 'OrthoSmile Family Dental',
    requestedCents: 720_000,
    termMonths: 36,
    category: 'medical',
    ficoBand: '700-739',
    decisionAt: '2026-05-04T17:21:00Z',
    latencyMs: 488,
    aprBps: 1499,
    fundedCents: 720_000,
    tier: 1,
  },
  {
    id: 'app_9xQpL4mNkjT',
    status: 'declined',
    applicantInitials: 'A.R.',
    state: 'FL',
    channel: 'consumer-direct',
    requestedCents: 1_200_000,
    termMonths: 48,
    category: 'consolidation',
    ficoBand: '620-659',
    decisionAt: '2026-05-04T16:08:00Z',
    latencyMs: 734,
    declineReasons: ['debt_to_income_high', 'recent_delinquency_60d'],
    tier: 1,
  },
  {
    id: 'app_2KvNRpL8mqT',
    status: 'approved',
    applicantInitials: 'S.P.',
    state: 'GA',
    channel: 'merchant',
    merchantName: 'Pacific Solar Co.',
    requestedCents: 2_500_000,
    termMonths: 84,
    category: 'home_improvement',
    ficoBand: '780+',
    decisionAt: '2026-05-04T14:55:00Z',
    latencyMs: 421,
    aprBps: 899,
    tier: 1,
  },
  {
    id: 'app_5NQpRT8mvK2',
    status: 'pending',
    applicantInitials: 'L.W.',
    state: 'NC',
    channel: 'merchant',
    merchantName: 'Bayview Roof & Gutter',
    requestedCents: 980_000,
    termMonths: 60,
    category: 'home_improvement',
    ficoBand: '660-699',
    decisionAt: '2026-05-04T13:32:00Z',
    latencyMs: 0,
    tier: 1,
  },
  {
    id: 'app_7tpQR2NvKmL',
    status: 'approved',
    applicantInitials: 'R.B.',
    state: 'WA',
    channel: 'consumer-direct',
    requestedCents: 450_000,
    termMonths: 24,
    category: 'personal',
    ficoBand: '720-759' as RoutedApplication['ficoBand'],
    decisionAt: '2026-05-04T12:11:00Z',
    latencyMs: 552,
    aprBps: 1199,
    tier: 1,
  },
  {
    id: 'app_KvNRT8mQp2L',
    status: 'ineligible',
    applicantInitials: 'M.T.',
    state: 'IL',
    channel: 'merchant',
    merchantName: 'OrthoSmile Family Dental',
    requestedCents: 1_500_000,
    termMonths: 72,
    category: 'medical',
    ficoBand: '580-619',
    decisionAt: '2026-05-04T11:02:00Z',
    latencyMs: 87,
    declineReasons: ['min_fico_floor'],
    tier: 1,
  },
  {
    id: 'app_RT8mQp2KvNL',
    status: 'approved',
    applicantInitials: 'E.H.',
    state: 'AZ',
    channel: 'merchant',
    merchantName: 'Pacific Solar Co.',
    requestedCents: 3_200_000,
    termMonths: 120,
    category: 'home_improvement',
    ficoBand: '780+',
    decisionAt: '2026-05-04T09:48:00Z',
    latencyMs: 503,
    aprBps: 849,
    tier: 1,
  },
];

// 30-day daily series
export const approval30d = [
  0.55, 0.57, 0.54, 0.58, 0.59, 0.6, 0.61, 0.58, 0.56, 0.59, 0.62, 0.61, 0.6, 0.59, 0.61, 0.63,
  0.62, 0.6, 0.61, 0.62, 0.6, 0.61, 0.62, 0.63, 0.62, 0.61, 0.62, 0.61, 0.62, 0.612,
];
export const latency30d = [
  812, 803, 798, 781, 776, 768, 770, 762, 755, 749, 752, 748, 744, 741, 745, 740, 738, 735, 742,
  738, 736, 740, 741, 738, 740, 742, 740, 738, 740, 742,
];

export interface LenderProduct {
  id: string;
  name: string;
  category: RoutedApplication['category'];
  minAmountCents: number;
  maxAmountCents: number;
  minTerm: number;
  maxTerm: number;
  aprFloorBps: number;
  aprCeilingBps: number;
  minFico: number;
  maxDtiPct: number;
  liveStates: number;
  status: 'active' | 'paused' | 'draft';
  approvalsToday: number;
  fundedMtdCents: number;
}

export const products: LenderProduct[] = [
  {
    id: 'prod_ev_homeimp_60_120',
    name: 'Evergreen Home Improvement (Prime)',
    category: 'home_improvement',
    minAmountCents: 500_000,
    maxAmountCents: 7_500_000,
    minTerm: 60,
    maxTerm: 144,
    aprFloorBps: 799,
    aprCeilingBps: 1599,
    minFico: 680,
    maxDtiPct: 45,
    liveStates: 41,
    status: 'active',
    approvalsToday: 31,
    fundedMtdCents: 2_840_000_00,
  },
  {
    id: 'prod_ev_medical_24_60',
    name: 'Evergreen Medical Pay-Over-Time',
    category: 'medical',
    minAmountCents: 100_000,
    maxAmountCents: 2_000_000,
    minTerm: 24,
    maxTerm: 60,
    aprFloorBps: 999,
    aprCeilingBps: 2399,
    minFico: 660,
    maxDtiPct: 50,
    liveStates: 38,
    status: 'active',
    approvalsToday: 12,
    fundedMtdCents: 1_240_000_00,
  },
  {
    id: 'prod_ev_personal_12_48',
    name: 'Evergreen Personal (Direct)',
    category: 'personal',
    minAmountCents: 100_000,
    maxAmountCents: 2_500_000,
    minTerm: 12,
    maxTerm: 48,
    aprFloorBps: 999,
    aprCeilingBps: 2899,
    minFico: 640,
    maxDtiPct: 50,
    liveStates: 33,
    status: 'active',
    approvalsToday: 4,
    fundedMtdCents: 792_140_00,
  },
];

export const declineReasonDistribution = [
  { label: 'DTI too high', value: 34 },
  { label: 'FICO < floor', value: 22 },
  { label: '60-day delinquency', value: 18 },
  { label: 'Insufficient stability', value: 11 },
  { label: 'Unverified income', value: 8 },
  { label: 'Other', value: 7 },
];

export const ficoBandApproval = [
  { label: '<620', value: 0.04 },
  { label: '620-659', value: 0.21 },
  { label: '660-699', value: 0.58 },
  { label: '700-739', value: 0.78 },
  { label: '740-779', value: 0.88 },
  { label: '780+', value: 0.94 },
];

// Webhook delivery sample
export interface WebhookDelivery {
  id: string;
  eventType: string;
  endpoint: string;
  status: 'delivered' | 'failed' | 'pending';
  httpStatus?: number;
  attempts: number;
  deliveredAt?: string;
  durationMs?: number;
}

export const webhookDeliveries: WebhookDelivery[] = [
  {
    id: 'wh_dlv_8KvR2NQp',
    eventType: 'application.routed',
    endpoint: 'https://api.evergreen-prime.com/eazepay/webhooks',
    status: 'delivered',
    httpStatus: 200,
    attempts: 1,
    deliveredAt: '2026-05-04T18:42:01Z',
    durationMs: 121,
  },
  {
    id: 'wh_dlv_KvR2NQpLm',
    eventType: 'application.declined',
    endpoint: 'https://api.evergreen-prime.com/eazepay/webhooks',
    status: 'delivered',
    httpStatus: 200,
    attempts: 1,
    deliveredAt: '2026-05-04T16:08:02Z',
    durationMs: 98,
  },
  {
    id: 'wh_dlv_R2NQpLmKv',
    eventType: 'application.routed',
    endpoint: 'https://api.evergreen-prime.com/eazepay/webhooks',
    status: 'failed',
    httpStatus: 503,
    attempts: 4,
    deliveredAt: '2026-05-04T14:55:00Z',
    durationMs: 30021,
  },
];

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  env: 'sandbox' | 'live';
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export const apiKeys: ApiKey[] = [
  {
    id: 'key_live_2KvN8',
    name: 'Production — primary',
    prefix: 'ep_live_2KvN8…',
    env: 'live',
    scopes: ['applications:read', 'applications:respond', 'webhooks:receive'],
    createdAt: '2025-12-14T10:00:00Z',
    lastUsedAt: '2026-05-04T18:42:01Z',
    revoked: false,
  },
  {
    id: 'key_sandbox_R8mQp',
    name: 'Sandbox — integration',
    prefix: 'ep_test_R8mQp…',
    env: 'sandbox',
    scopes: ['applications:read', 'applications:respond', 'webhooks:receive', 'sandbox:replay'],
    createdAt: '2025-11-12T15:30:00Z',
    lastUsedAt: '2026-05-03T22:13:00Z',
    revoked: false,
  },
];
