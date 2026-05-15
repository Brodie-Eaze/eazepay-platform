/**
 * Mock data for the Lender Marketplace admin pages.
 * Real data lands when the /v1/admin/marketplaces BFF routes are
 * wired; until then this file is the source of truth so the UI is
 * consistent across pages.
 *
 * Every row mirrors the shape of the new Prisma models (Marketplace,
 * MarketplaceLender, PartnerLenderAccess, HighsaleSnapshot, CreditTier).
 */
import type { BrandCode } from '@eazepay/shared-types';

export type CreditTier = 'prime_plus' | 'prime' | 'near_prime' | 'sub_prime' | 'no_match';
export type MarketplaceProvider = 'engine_tech' | 'in_house' | 'affiliate_network' | 'manual';
export type MarketplaceStatus = 'active' | 'paused' | 'disconnected';

export const tierLabel: Record<CreditTier, string> = {
  prime_plus: 'Prime+',
  prime: 'Prime',
  near_prime: 'Near-prime',
  sub_prime: 'Sub-prime',
  no_match: 'No match',
};

export const tierFico: Record<CreditTier, string> = {
  prime_plus: '760+',
  prime: '700–759',
  near_prime: '640–699',
  sub_prime: '580–639',
  no_match: '<580',
};

export interface MarketplaceRow {
  id: string;
  slug: string;
  legalName: string;
  displayName: string;
  provider: MarketplaceProvider;
  status: MarketplaceStatus;
  lenderCount: number;
  enabledCount: number;
  lastSyncAt: string;
}

export const marketplaces: MarketplaceRow[] = [
  {
    id: 'mkt_engine_tech',
    slug: 'engine-tech',
    legalName: 'Engine.Tech, Inc.',
    displayName: 'engine.tech',
    provider: 'engine_tech',
    status: 'active',
    lenderCount: 42,
    enabledCount: 36,
    lastSyncAt: '2026-05-04T06:00:00Z',
  },
  {
    id: 'mkt_in_house',
    slug: 'eazepay-direct',
    legalName: 'EazePay Direct Pool',
    displayName: 'EazePay direct',
    provider: 'in_house',
    status: 'active',
    lenderCount: 7,
    enabledCount: 7,
    lastSyncAt: '2026-05-04T06:00:00Z',
  },
  {
    id: 'mkt_affiliate',
    slug: 'partner-network',
    legalName: 'Partner Lending Network',
    displayName: 'Partner Network',
    provider: 'affiliate_network',
    status: 'paused',
    lenderCount: 18,
    enabledCount: 0,
    lastSyncAt: '2026-04-28T06:00:00Z',
  },
];

export interface MarketplaceLenderRow {
  id: string;
  marketplaceId: string;
  externalLenderId: string;
  legalName: string;
  displayName: string;
  servesTiers: CreditTier[];
  brands: BrandCode[]; // empty = all brands
  minAmountCents: number;
  maxAmountCents: number;
  minScore: number | null;
  permittedStates: string[]; // empty = all
  globallyEnabled: boolean;
  syncedAt: string;
  /**
   * Optional status applied when a lender is wired in code (adapter
   * scaffolded under `services/lender/src/adapters/`) but missing live
   * API credentials. Renders as a non-clickable badge in the lender
   * marketplace UI with a tooltip pointing at the adapter file an
   * engineer will edit once credentials are signed. When undefined
   * the row renders normally per `globallyEnabled`.
   */
  pendingIntegration?: {
    note: string;
    adapterFilePath: string;
    /** Optional minimum-term hint that survives until live integration. */
    minTermMonths?: number;
    maxTermMonths?: number;
  };
}

export const marketplaceLenders: MarketplaceLenderRow[] = [
  // engine.tech — medical pool
  {
    id: 'ml_eng_helia_med',
    marketplaceId: 'mkt_engine_tech',
    externalLenderId: 'eng_HELIA_MED_001',
    legalName: 'Helia Medical Finance, LLC',
    displayName: 'Helia Medical',
    servesTiers: ['prime_plus', 'prime', 'near_prime'],
    brands: ['medpay'],
    minAmountCents: 100_000,
    maxAmountCents: 50_000_00,
    minScore: 660,
    permittedStates: [],
    globallyEnabled: true,
    syncedAt: '2026-05-04T06:00:00Z',
  },
  {
    id: 'ml_eng_sageheal',
    marketplaceId: 'mkt_engine_tech',
    externalLenderId: 'eng_SAGEHEAL_002',
    legalName: 'SageHeal Finance Co.',
    displayName: 'SageHeal',
    servesTiers: ['prime', 'near_prime', 'sub_prime'],
    brands: ['medpay'],
    minAmountCents: 50_000,
    maxAmountCents: 30_000_00,
    minScore: 580,
    permittedStates: [],
    globallyEnabled: true,
    syncedAt: '2026-05-04T06:00:00Z',
  },
  // engine.tech — trades pool
  {
    id: 'ml_eng_orion_trade',
    marketplaceId: 'mkt_engine_tech',
    externalLenderId: 'eng_ORION_TRD_003',
    legalName: 'Orion Capital Group',
    displayName: 'Orion Capital',
    servesTiers: ['prime_plus', 'prime'],
    brands: ['tradepay'],
    minAmountCents: 500_000,
    maxAmountCents: 100_000_00,
    minScore: 700,
    permittedStates: [],
    globallyEnabled: true,
    syncedAt: '2026-05-04T06:00:00Z',
  },
  {
    id: 'ml_eng_kestrel_trade',
    marketplaceId: 'mkt_engine_tech',
    externalLenderId: 'eng_KESTREL_TRD_004',
    legalName: 'Kestrel Trade Finance',
    displayName: 'Kestrel',
    servesTiers: ['prime', 'near_prime', 'sub_prime'],
    brands: ['tradepay'],
    minAmountCents: 200_000,
    maxAmountCents: 60_000_00,
    minScore: 620,
    permittedStates: [],
    globallyEnabled: true,
    syncedAt: '2026-05-04T06:00:00Z',
  },
  // engine.tech — coaching pool
  {
    id: 'ml_eng_atlas_coach',
    marketplaceId: 'mkt_engine_tech',
    externalLenderId: 'eng_ATLASCAP_005',
    legalName: 'Atlas Career Capital',
    displayName: 'Atlas Career Cap',
    servesTiers: ['prime_plus', 'prime'],
    brands: ['coachpay'],
    minAmountCents: 100_000,
    maxAmountCents: 30_000_00,
    minScore: 700,
    permittedStates: [],
    globallyEnabled: true,
    syncedAt: '2026-05-04T06:00:00Z',
  },
  {
    id: 'ml_eng_clearpath_coach',
    marketplaceId: 'mkt_engine_tech',
    externalLenderId: 'eng_CLEARPATH_006',
    legalName: 'ClearPath Education Finance',
    displayName: 'ClearPath',
    servesTiers: ['prime', 'near_prime', 'sub_prime'],
    brands: ['coachpay'],
    minAmountCents: 50_000,
    maxAmountCents: 25_000_00,
    minScore: 600,
    permittedStates: [],
    globallyEnabled: false, // toggled off globally
    syncedAt: '2026-05-04T06:00:00Z',
  },
  // engine.tech — cross-brand prime+
  {
    id: 'ml_eng_summit_premier',
    marketplaceId: 'mkt_engine_tech',
    externalLenderId: 'eng_SUMMIT_007',
    legalName: 'Summit Premier Lending',
    displayName: 'Summit Premier',
    servesTiers: ['prime_plus'],
    brands: ['tradepay', 'medpay', 'coachpay'],
    minAmountCents: 200_000,
    maxAmountCents: 150_000_00,
    minScore: 760,
    permittedStates: [],
    globallyEnabled: true,
    syncedAt: '2026-05-04T06:00:00Z',
  },
  // in-house pool — EazePay BuzzPay (TrueTopia-backed)
  {
    id: 'ml_in_buzzpay',
    marketplaceId: 'mkt_in_house',
    externalLenderId: 'inh_BUZZPAY_001',
    legalName: 'BuzzPay by TrueTopia',
    displayName: 'BuzzPay',
    servesTiers: ['prime_plus', 'prime', 'near_prime'],
    brands: ['tradepay', 'medpay', 'coachpay', 'direct'],
    minAmountCents: 50_000,
    maxAmountCents: 80_000_00,
    minScore: 640,
    permittedStates: [],
    globallyEnabled: true,
    syncedAt: '2026-05-04T06:00:00Z',
  },
  // ---------------------------------------------------------------
  // Pending-integration lenders. Adapters live under
  // services/lender/src/adapters/ and throw `pending_api_credentials`
  // at quote() time. These rows surface in the marketplace UI with a
  // "Pending integration" badge so ops can see what's in the pipeline.
  // Append-only — coordinate with the operational-connectedness agent
  // (other agent may also be touching this file).
  // ---------------------------------------------------------------
  {
    id: 'ml_in_us_bank',
    marketplaceId: 'mkt_in_house',
    externalLenderId: 'usbank_PERSONAL_001',
    legalName: 'U.S. Bank, National Association',
    displayName: 'U.S. Bank',
    servesTiers: ['prime_plus', 'prime'],
    brands: ['tradepay', 'medpay', 'coachpay', 'direct'],
    minAmountCents: 500_000,
    maxAmountCents: 100_000_00,
    minScore: 700,
    permittedStates: [],
    globallyEnabled: false,
    syncedAt: '2026-05-15T00:00:00Z',
    pendingIntegration: {
      note: 'Pending integration. API received, awaiting credentials.',
      adapterFilePath: 'services/lender/src/adapters/us-bank.adapter.ts',
      minTermMonths: 24,
      maxTermMonths: 84,
    },
  },
  {
    id: 'ml_in_engine_tech',
    marketplaceId: 'mkt_engine_tech',
    externalLenderId: 'enginetech_DIRECT_001',
    legalName: 'Engine.Tech, Inc.',
    displayName: 'Engine.Tech',
    servesTiers: ['near_prime', 'sub_prime'],
    brands: ['tradepay', 'medpay', 'coachpay', 'direct'],
    minAmountCents: 100_000,
    maxAmountCents: 50_000_00,
    minScore: 580,
    permittedStates: [],
    globallyEnabled: false,
    syncedAt: '2026-05-15T00:00:00Z',
    pendingIntegration: {
      note: 'Pending integration. API outreach in progress. Card-stacking friendly (multiple offers per applicant).',
      adapterFilePath: 'services/lender/src/adapters/engine-tech.adapter.ts',
      minTermMonths: 6,
      maxTermMonths: 60,
    },
  },
  {
    id: 'ml_in_queen_street',
    marketplaceId: 'mkt_in_house',
    externalLenderId: 'queenstreet_PRIME_001',
    legalName: 'Queen Street Capital LLC',
    displayName: 'Queen Street Capital',
    servesTiers: ['prime_plus'],
    brands: ['tradepay', 'medpay', 'coachpay', 'direct'],
    minAmountCents: 1_000_000,
    maxAmountCents: 250_000_00,
    minScore: 760,
    permittedStates: [],
    globallyEnabled: false,
    syncedAt: '2026-05-15T00:00:00Z',
    pendingIntegration: {
      note: 'Pending integration. API outreach in progress. Prime-plus tier only.',
      adapterFilePath: 'services/lender/src/adapters/queen-street.adapter.ts',
      minTermMonths: 12,
      maxTermMonths: 120,
    },
  },
];

export interface PartnerAccessOverride {
  merchantId: string;
  marketplaceLenderId: string;
  enabled: boolean;
  reason: string | null;
  changedAt: string;
}

export const partnerAccessOverrides: PartnerAccessOverride[] = [
  {
    merchantId: 'p_helio', // Helio Dental Group
    marketplaceLenderId: 'ml_eng_kestrel_trade',
    enabled: false,
    reason: 'Trades-only lender; partner is dental.',
    changedAt: '2026-04-10T09:14Z',
  },
  {
    merchantId: 'p_orion', // Orion Roof & Solar
    marketplaceLenderId: 'ml_eng_clearpath_coach',
    enabled: false,
    reason: 'Compliance review — partner does not serve education vertical.',
    changedAt: '2026-04-22T11:00Z',
  },
  {
    merchantId: 'p_brio', // Brio Wellness Clinics
    marketplaceLenderId: 'ml_eng_sageheal',
    enabled: false,
    reason: 'Partner-requested allowlist excludes SageHeal.',
    changedAt: '2026-03-30T15:42Z',
  },
];

/**
 * Effective enabled state for a (partner, lender) pair.
 *  - If a PartnerAccessOverride exists, use its `enabled` value.
 *  - Otherwise, fall through to MarketplaceLender.globallyEnabled.
 *  - And only ever true if the parent Marketplace is `active`.
 */
export function isLenderEnabledForPartner(
  merchantId: string,
  lender: MarketplaceLenderRow,
  marketplace: MarketplaceRow,
): { enabled: boolean; via: 'global' | 'override' | 'marketplace-paused' } {
  if (marketplace.status !== 'active') {
    return { enabled: false, via: 'marketplace-paused' };
  }
  const override = partnerAccessOverrides.find(
    (o) => o.merchantId === merchantId && o.marketplaceLenderId === lender.id,
  );
  if (override) return { enabled: override.enabled, via: 'override' };
  return { enabled: lender.globallyEnabled, via: 'global' };
}

/** Format a Highsale-style financial-summary payload for the client view. */
export interface HighsaleSnapshotView {
  applicationId: string;
  highsaleRef: string;
  creditTier: CreditTier;
  ficoBand: string;
  inquiryAt: string;
  expiresAt: string;
  status: 'pending' | 'scored' | 'expired' | 'failed';
  summary: {
    annualIncomeCentsRange: { lowCents: number; highCents: number };
    tradelinesOpen: number;
    revolvingUtilizationPct: number;
    delinquencies60dLast12m: number;
    accountsInGoodStanding: number;
    monthsOfFileHistory: number;
    nsfEvents90d: number;
    primaryBankInstitution: string;
    averageMonthlyInflowCents: number;
    averageMonthlyOutflowCents: number;
    cashflowStabilityScore: number; // 0–100
  };
}

export const highsaleSnapshots: HighsaleSnapshotView[] = [
  {
    applicationId: 'a_002',
    highsaleRef: 'hs_2026_05_04_8KvR2NQp',
    creditTier: 'prime',
    ficoBand: '700–739',
    inquiryAt: '2026-05-04T18:41:00Z',
    expiresAt: '2026-05-18T18:41:00Z',
    status: 'scored',
    summary: {
      annualIncomeCentsRange: { lowCents: 9_600_000, highCents: 11_400_000 },
      tradelinesOpen: 8,
      revolvingUtilizationPct: 22,
      delinquencies60dLast12m: 0,
      accountsInGoodStanding: 12,
      monthsOfFileHistory: 142,
      nsfEvents90d: 0,
      primaryBankInstitution: 'Chase',
      averageMonthlyInflowCents: 8_412_00,
      averageMonthlyOutflowCents: 6_104_00,
      cashflowStabilityScore: 84,
    },
  },
  {
    applicationId: 'a_003',
    highsaleRef: 'hs_2026_05_03_PqL8RT2N',
    creditTier: 'prime_plus',
    ficoBand: '780+',
    inquiryAt: '2026-05-03T11:18:00Z',
    expiresAt: '2026-05-17T11:18:00Z',
    status: 'scored',
    summary: {
      annualIncomeCentsRange: { lowCents: 14_800_000, highCents: 17_200_000 },
      tradelinesOpen: 11,
      revolvingUtilizationPct: 14,
      delinquencies60dLast12m: 0,
      accountsInGoodStanding: 18,
      monthsOfFileHistory: 211,
      nsfEvents90d: 0,
      primaryBankInstitution: 'Capital One',
      averageMonthlyInflowCents: 12_180_00,
      averageMonthlyOutflowCents: 8_650_00,
      cashflowStabilityScore: 91,
    },
  },
];

export const lookupHighsaleSnapshot = (applicationId: string): HighsaleSnapshotView | null =>
  highsaleSnapshots.find((h) => h.applicationId === applicationId) ?? null;
