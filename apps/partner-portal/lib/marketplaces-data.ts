/**
 * Lender Marketplaces — the third-party aggregators EazePay plugs into.
 *
 * A "marketplace" is a multi-lender platform with its own decision
 * engine, landing UI, and lender roster. EazePay routes applications
 * INTO a marketplace; the marketplace fans out to its own lenders and
 * returns ranked offers.
 *
 * Architecture:
 *
 *   /apply/<brand>?ref=<partner>
 *        ↓
 *   orchestration/route
 *        ↓
 *   parallel POST to every marketplace enabled for this:
 *     • brand (medpay / tradepay / coachpay)
 *     • partner (per-business override, optional)
 *     • applicant tier (prime+ / prime / near-prime / sub-prime)
 *        ↓
 *   each marketplace POSTs to its own lenders
 *        ↓
 *   marketplace returns aggregated offers
 *        ↓
 *   EazePay merges, dedupes, ranks consumer-best
 *        ↓
 *   customer sees the unified offer screen on /apply/<brand>
 *
 * Webhook flow (post-acceptance):
 *   customer accepts an offer → EazePay calls marketplace /bind →
 *   marketplace runs e-sign + funding → marketplace POSTs status
 *   events back to /api/v1/webhooks/lenders/{marketplace_id} (HMAC).
 */
import type { BrandCode } from '@eazepay/shared-types';

export type Tier = 'prime_plus' | 'prime' | 'near_prime' | 'sub_prime';

export interface Marketplace {
  id: string;
  displayName: string;
  legalName: string;
  /** Short tagline rendered under the name. */
  tagline: string;
  /** Logo letter (we don't host third-party logos in this demo). */
  logoLetter: string;
  /** Where the marketplace API lives. */
  apiBaseUrl: string;
  /** The marketplace's webhook URL — we POST status events here. */
  ourWebhookUrl: string;
  /** Their webhook URL — they POST events back to us here. */
  theirWebhookUrl: string;
  /** Whether the marketplace is globally enabled. */
  globallyEnabled: boolean;
  /** Per-vertical toggles — which brands the marketplace serves. */
  enabledByBrand: Record<Exclude<BrandCode, 'direct'>, boolean>;
  /** Credit tiers the marketplace's lender roster typically serves. */
  servesTiers: Tier[];
  /** Number of underlying lenders aggregated by this marketplace. */
  lenderCount: number;
  /** Performance signals shown to operators. */
  metrics: {
    p95LatencyMs: number;
    approvalRate30d: number; // 0..1
    fundedVolume30dCents: number;
    deliveryRate30d: number; // 0..1
  };
  /** Authentication method we use to call the marketplace. */
  authMethod: 'hmac' | 'oauth2_cc' | 'api_key';
  /** What product surface this marketplace was built for. */
  category: 'general' | 'medical' | 'home_improvement' | 'education' | 'consumer';
  /** Date marketplace was added to the rail. */
  addedAt: string;
}

const STATIC_NOW = Date.parse('2026-05-14T19:00:00.000Z');
const daysAgo = (d: number) => new Date(STATIC_NOW - d * 86_400_000).toISOString();

export const MARKETPLACES: Marketplace[] = [
  {
    id: 'mkt_engine_tech',
    displayName: 'engine.tech',
    legalName: 'Engine Financial, Inc.',
    tagline: 'Universal consumer-lending aggregator. 50+ lenders, single API.',
    logoLetter: 'E',
    apiBaseUrl: 'https://api.engine.tech/v1',
    ourWebhookUrl: 'https://api.eazepay.com/api/v1/webhooks/lenders/mkt_engine_tech',
    theirWebhookUrl: 'https://engine.tech/webhooks/eazepay',
    globallyEnabled: true,
    enabledByBrand: { tradepay: true, medpay: true, coachpay: true },
    servesTiers: ['prime_plus', 'prime', 'near_prime'],
    lenderCount: 52,
    metrics: {
      p95LatencyMs: 824,
      approvalRate30d: 0.68,
      fundedVolume30dCents: 18_400_000_00,
      deliveryRate30d: 0.998,
    },
    authMethod: 'hmac',
    category: 'general',
    addedAt: daysAgo(120),
  },
  {
    id: 'mkt_finwise',
    displayName: 'FinWise',
    legalName: 'FinWise Bank',
    tagline: 'Bank-partner marketplace. Prime + near-prime, all 50 states.',
    logoLetter: 'F',
    apiBaseUrl: 'https://partner-api.finwisebank.com/v2',
    ourWebhookUrl: 'https://api.eazepay.com/api/v1/webhooks/lenders/mkt_finwise',
    theirWebhookUrl: 'https://finwisebank.com/webhooks/eazepay',
    globallyEnabled: true,
    enabledByBrand: { tradepay: true, medpay: true, coachpay: false },
    servesTiers: ['prime_plus', 'prime'],
    lenderCount: 12,
    metrics: {
      p95LatencyMs: 612,
      approvalRate30d: 0.72,
      fundedVolume30dCents: 24_900_000_00,
      deliveryRate30d: 0.999,
    },
    authMethod: 'oauth2_cc',
    category: 'general',
    addedAt: daysAgo(95),
  },
  {
    id: 'mkt_hsp_medical',
    displayName: 'HSP Medical',
    legalName: 'HSP Patient Finance, LLC',
    tagline: 'Medical-vertical marketplace. Dental, vision, vet, fertility.',
    logoLetter: 'H',
    apiBaseUrl: 'https://api.hsp-medical.com/v1',
    ourWebhookUrl: 'https://api.eazepay.com/api/v1/webhooks/lenders/mkt_hsp_medical',
    theirWebhookUrl: 'https://hsp-medical.com/webhooks/eazepay',
    globallyEnabled: true,
    enabledByBrand: { tradepay: false, medpay: true, coachpay: false },
    servesTiers: ['prime_plus', 'prime', 'near_prime', 'sub_prime'],
    lenderCount: 18,
    metrics: {
      p95LatencyMs: 489,
      approvalRate30d: 0.74,
      fundedVolume30dCents: 9_240_000_00,
      deliveryRate30d: 0.997,
    },
    authMethod: 'hmac',
    category: 'medical',
    addedAt: daysAgo(78),
  },
  {
    id: 'mkt_homeimp_co',
    displayName: 'HomeImp Co.',
    legalName: 'HomeImp Lending Co., LLC',
    tagline: 'Home-improvement marketplace. HVAC, roofing, solar, windows.',
    logoLetter: 'H',
    apiBaseUrl: 'https://api.homeimp.co/v1',
    ourWebhookUrl: 'https://api.eazepay.com/api/v1/webhooks/lenders/mkt_homeimp_co',
    theirWebhookUrl: 'https://homeimp.co/webhooks/eazepay',
    globallyEnabled: false,
    enabledByBrand: { tradepay: false, medpay: false, coachpay: false },
    servesTiers: ['prime', 'near_prime', 'sub_prime'],
    lenderCount: 9,
    metrics: {
      p95LatencyMs: 743,
      approvalRate30d: 0.61,
      fundedVolume30dCents: 0,
      deliveryRate30d: 0.99,
    },
    authMethod: 'api_key',
    category: 'home_improvement',
    addedAt: daysAgo(8),
  },
  {
    id: 'mkt_eazepay_direct',
    displayName: 'EazePay Direct',
    legalName: 'EazePay Finance — issued via partner bank',
    tagline: 'Our in-house BuzzPay adapter. First-look priority.',
    logoLetter: 'E',
    apiBaseUrl: 'https://api.eazepay.com/v1/internal',
    ourWebhookUrl: 'https://api.eazepay.com/api/v1/webhooks/lenders/mkt_eazepay_direct',
    theirWebhookUrl: 'in-process',
    globallyEnabled: true,
    enabledByBrand: { tradepay: true, medpay: true, coachpay: true },
    servesTiers: ['prime_plus', 'prime', 'near_prime'],
    lenderCount: 1,
    metrics: {
      p95LatencyMs: 187,
      approvalRate30d: 0.88,
      fundedVolume30dCents: 41_200_000_00,
      deliveryRate30d: 1,
    },
    authMethod: 'hmac',
    category: 'general',
    addedAt: daysAgo(300),
  },
];

export const TIER_LABEL: Record<Tier, string> = {
  prime_plus: 'Prime+',
  prime: 'Prime',
  near_prime: 'Near-prime',
  sub_prime: 'Sub-prime',
};

export const AUTH_LABEL: Record<Marketplace['authMethod'], string> = {
  hmac: 'HMAC-SHA256 + nonce',
  oauth2_cc: 'OAuth 2.0 (client credentials)',
  api_key: 'API key',
};

export const CATEGORY_LABEL: Record<Marketplace['category'], string> = {
  general: 'General consumer',
  medical: 'Medical',
  home_improvement: 'Home improvement',
  education: 'Education',
  consumer: 'Consumer',
};
