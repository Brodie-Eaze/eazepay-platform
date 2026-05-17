/**
 * Merchant Dashboard mock data — the surface a merchant signs in to.
 * Mirrors the same `Application` entity as partner/admin, but scoped
 * to the merchant's own funnel: their attach rate, their applications,
 * their settlements.
 */
import type { RouteStep } from '@eazepay/ui/web';

export const merchantOrg = {
  id: 'mer_pacificsolar_001',
  legalName: 'Pacific Solar Co.',
  displayName: 'Pacific Solar',
  industry: 'Home improvement · solar PV + battery',
  mcc: '1731',
  state: 'CA',
  kybStatus: 'verified' as const,
  contactName: 'Alex Wu',
  contactTitle: 'Operations Manager',
  status: 'active' as const,
  liveSince: '2025-08-12',
  monthlyVolumeCents: 4_872_140_00,
  attachRate: 0.42,
};

export interface MerchantApplication {
  id: string;
  customerName: string; // first + last initial
  customerEmail: string;
  state: string;
  status: 'in_progress' | 'approved' | 'declined' | 'expired' | 'funded';
  requestedCents: number;
  approvedCents?: number;
  termMonths: number;
  saleAmountCents: number;
  category: 'home_improvement';
  createdAt: string;
  decisionAt?: string;
  aprBps?: number;
  lenderOfRecord?: string;
}

export const applications: MerchantApplication[] = [
  {
    id: 'app_4nqLkR2vTjW',
    customerName: 'Julian M.',
    customerEmail: 'julian.m••@gmail.com',
    state: 'TX',
    status: 'funded',
    requestedCents: 1_850_000,
    approvedCents: 1_850_000,
    termMonths: 60,
    saleAmountCents: 1_950_000,
    category: 'home_improvement',
    createdAt: '2026-05-04T16:55:00Z',
    decisionAt: '2026-05-04T18:42:00Z',
    aprBps: 1099,
    lenderOfRecord: 'Cross River Bank (Evergreen Prime)',
  },
  {
    id: 'app_2KvNRpL8mqT',
    customerName: 'Sofia P.',
    customerEmail: 's.padilla••@yahoo.com',
    state: 'GA',
    status: 'funded',
    requestedCents: 2_500_000,
    approvedCents: 2_500_000,
    termMonths: 84,
    saleAmountCents: 2_640_000,
    category: 'home_improvement',
    createdAt: '2026-05-04T13:11:00Z',
    decisionAt: '2026-05-04T14:55:00Z',
    aprBps: 899,
    lenderOfRecord: 'Cross River Bank (Evergreen Prime)',
  },
  {
    id: 'app_RT8mQp2KvNL',
    customerName: 'Elena H.',
    customerEmail: 'elena.h••@protonmail.com',
    state: 'AZ',
    status: 'funded',
    requestedCents: 3_200_000,
    approvedCents: 3_200_000,
    termMonths: 120,
    saleAmountCents: 3_380_000,
    category: 'home_improvement',
    createdAt: '2026-05-04T07:48:00Z',
    decisionAt: '2026-05-04T09:48:00Z',
    aprBps: 849,
    lenderOfRecord: 'Cross River Bank (BuzzPay)',
  },
  {
    id: 'app_NvK2RpT8mQL',
    customerName: 'Marcus T.',
    customerEmail: 'marcus.t••@gmail.com',
    state: 'WA',
    status: 'in_progress',
    requestedCents: 1_600_000,
    termMonths: 60,
    saleAmountCents: 1_750_000,
    category: 'home_improvement',
    createdAt: '2026-05-04T18:48:00Z',
    aprBps: undefined,
  },
  {
    id: 'app_8KvR2NpQLmT',
    customerName: 'Priya S.',
    customerEmail: 'priya.s••@gmail.com',
    state: 'TX',
    status: 'declined',
    requestedCents: 1_200_000,
    termMonths: 48,
    saleAmountCents: 1_350_000,
    category: 'home_improvement',
    createdAt: '2026-05-03T15:42:00Z',
    decisionAt: '2026-05-03T15:46:00Z',
  },
];

export interface ApplicationLink {
  id: string;
  url: string;
  saleAmountCents?: number;
  customerEmail?: string;
  productNote?: string;
  expiresAt: string;
  status: 'active' | 'used' | 'expired';
  views: number;
  starts: number;
  submitted: number;
  funded: number;
  createdAt: string;
}

export const applicationLinks: ApplicationLink[] = [
  {
    id: 'lnk_8KvRT2mQpN',
    url: 'https://eazepay.com/apply/pacificsolar/8KvRT2mQpN',
    saleAmountCents: 1_950_000,
    customerEmail: 'marcus.t••@gmail.com',
    productNote: 'Quote #Q-2841 · 14.2kW + 13.5kWh battery',
    expiresAt: '2026-05-11T18:48:00Z',
    status: 'active',
    views: 4,
    starts: 2,
    submitted: 1,
    funded: 0,
    createdAt: '2026-05-04T18:48:00Z',
  },
  {
    id: 'lnk_RT2mQpN8Kv',
    url: 'https://eazepay.com/apply/pacificsolar/RT2mQpN8Kv',
    saleAmountCents: 1_950_000,
    customerEmail: 'julian.m••@gmail.com',
    productNote: 'Quote #Q-2839 · 11.6kW + 13.5kWh battery',
    expiresAt: '2026-05-11T16:55:00Z',
    status: 'used',
    views: 3,
    starts: 1,
    submitted: 1,
    funded: 1,
    createdAt: '2026-05-04T16:55:00Z',
  },
];

export interface Settlement {
  id: string;
  period: string;
  grossCents: number;
  mdrCents: number;
  netCents: number;
  applications: number;
  status: 'paid' | 'in_flight' | 'scheduled';
  paidAt?: string;
}

export const settlements: Settlement[] = [
  {
    id: 'stl_2026_05_03',
    period: 'May 3, 2026',
    grossCents: 7_550_000,
    mdrCents: 211_400,
    netCents: 7_338_600,
    applications: 3,
    status: 'in_flight',
  },
  {
    id: 'stl_2026_05_02',
    period: 'May 2, 2026',
    grossCents: 4_120_000,
    mdrCents: 115_360,
    netCents: 4_004_640,
    applications: 2,
    status: 'paid',
    paidAt: '2026-05-04T08:00Z',
  },
  {
    id: 'stl_2026_05_01',
    period: 'May 1, 2026',
    grossCents: 6_240_000,
    mdrCents: 174_720,
    netCents: 6_065_280,
    applications: 3,
    status: 'paid',
    paidAt: '2026-05-03T08:00Z',
  },
];

export const webhookDeliveries = [
  {
    id: 'wh_dlv_8KvR2NQp',
    event: 'application.funded',
    status: 'delivered',
    http: 200,
    attempts: 1,
    when: '2026-05-04T19:01Z',
  },
  {
    id: 'wh_dlv_KvR2NQpLm',
    event: 'application.approved',
    status: 'delivered',
    http: 200,
    attempts: 1,
    when: '2026-05-04T18:42Z',
  },
  {
    id: 'wh_dlv_R2NQpLmKv',
    event: 'application.submitted',
    status: 'delivered',
    http: 200,
    attempts: 1,
    when: '2026-05-04T18:40Z',
  },
];

export const conversionFunnel = [
  { label: 'Link opened', value: 412 },
  { label: 'Started', value: 268 },
  { label: 'KYC complete', value: 198 },
  { label: 'Submitted', value: 174 },
  { label: 'Approved', value: 112 },
  { label: 'Funded', value: 96 },
];

export const lenderMix = [
  { label: 'BuzzPay', value: 39 },
  { label: 'Evergreen Prime', value: 42 },
  { label: 'Solstice', value: 14 },
  { label: 'PathPoint', value: 1 },
];

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
