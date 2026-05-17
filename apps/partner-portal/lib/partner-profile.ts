/**
 * Partner-scoped reporting helpers.
 *
 * Why this module exists:
 *   Every per-brand portal surface (`/v/<brand>/*`) MUST show data for
 *   ONLY the signed-in partner's business — never the brand-wide
 *   aggregate, and never another partner's data inside the same brand.
 *   Pre-fix, the Insights tab and the home dashboard rendered
 *   brand-aggregate snapshots by default, leaking cross-tenant
 *   reporting. This module is the canonical place to:
 *
 *     1. Resolve "who is signed in?" from the demo cookie (or future JWT)
 *        → which canonical master partner do we scope to?
 *     2. Derive per-partner metrics from a brand-wide profile by
 *        scaling volume numbers by the partner's share of brand volume,
 *        while preserving rates that are unitless (approval %, latency).
 *
 * Tenant isolation:
 *   The signed-in partner is resolved server-side (no React-render-time
 *   query-param tricks). For the demo cookie this is a strict mapping
 *   medpay→p_helio, tradepay→p_orion, coachpay→p_atlas (see
 *   DEMO_PARTNER_BY_BRAND in lib/submitted-applications.ts). When real
 *   JWT auth lands, the merchantId claim replaces the demo map.
 */

import type { BrandCode } from '@eazepay/shared-types';
import { BRANDS } from '@eazepay/shared-types';
import { partners as MASTER_PARTNERS, type PartnerSummary } from './master-data';

/** BrandCode ↔ partner.product label bridge (master-data uses CamelCase). */
const BRAND_TO_PRODUCT_LABEL: Record<Exclude<BrandCode, 'direct'>, PartnerSummary['product']> = {
  medpay: 'MedPay',
  tradepay: 'TradePay',
  coachpay: 'CoachPay',
};

/**
 * Demo-cookie → canonical partner per brand. Mirrors
 * DEMO_PARTNER_BY_BRAND in lib/submitted-applications.ts so the two
 * surfaces (insights + submitted-apps) agree on "who is signed in."
 * Keeping the map here (rather than importing) decouples this module
 * from the localStorage-backed submitted-apps store.
 */
const DEMO_PARTNER_BY_BRAND: Record<Exclude<BrandCode, 'direct'>, string> = {
  medpay: 'p_helio',
  tradepay: 'p_orion',
  coachpay: 'p_atlas',
};

/**
 * Resolve "the partner whose dashboard you are looking at." Today this
 * just maps brand → demo partner; tomorrow it'll read JWT.merchantId.
 * Returns the canonical PartnerSummary or null if the brand has no
 * configured demo partner (defensive — shouldn't happen for the 3
 * supported brands).
 */
export function currentPartnerForBrand(brand: Exclude<BrandCode, 'direct'>): PartnerSummary | null {
  const id = DEMO_PARTNER_BY_BRAND[brand];
  if (!id) return null;
  return MASTER_PARTNERS.find((p) => p.id === id) ?? null;
}

/**
 * Total funded-loan count across all partners on a given brand.
 * Used as the denominator for per-partner volume scaling. Multi-brand
 * partners count toward every brand they touch (acceptable simplification
 * for the dashboard — Multi-brand is one row in master-data).
 */
function brandFundedTotal(brand: Exclude<BrandCode, 'direct'>): number {
  const label = BRAND_TO_PRODUCT_LABEL[brand];
  return MASTER_PARTNERS.filter((p) => p.product === label || p.product === 'Multi-brand').reduce(
    (sum, p) => sum + p.fundedCount,
    0,
  );
}

/**
 * Partner's share (0..1) of the brand's funded-loan volume. Returns 0
 * when the partner doesn't belong to the brand (defensive — caller
 * should have resolved correctly).
 */
export function partnerShareOfBrand(
  partner: PartnerSummary,
  brand: Exclude<BrandCode, 'direct'>,
): number {
  const label = BRAND_TO_PRODUCT_LABEL[brand];
  if (partner.product !== label && partner.product !== 'Multi-brand') return 0;
  const total = brandFundedTotal(brand);
  if (total === 0) return 0;
  return partner.fundedCount / total;
}

/**
 * Scale a brand-wide numeric metric (count, dollars, etc.) to the
 * partner's slice. Rounded to the nearest integer because every
 * consumer of these numbers (funnel, KPIs, etc.) treats them as
 * counts of loans / dollars cents.
 */
export function scaleByPartnerShare(
  brandValue: number,
  partner: PartnerSummary,
  brand: Exclude<BrandCode, 'direct'>,
): number {
  const share = partnerShareOfBrand(partner, brand);
  return Math.round(brandValue * share);
}

/**
 * Variance helper for per-partner rate tweaks. Deterministic hash of
 * the partner id (so the variance is stable across renders), mapped
 * into the [-amplitude, +amplitude] range. Used to differentiate
 * partner approval rates / take-up rates from the brand mean without
 * making any partner look artificially good or bad.
 */
export function partnerVariance(partnerId: string, amplitude: number): number {
  let hash = 0;
  for (let i = 0; i < partnerId.length; i++) {
    hash = (hash * 31 + partnerId.charCodeAt(i)) | 0;
  }
  // Map int32 → [-1, 1] then scale by amplitude.
  const normalised = ((hash & 0xffff) / 0xffff) * 2 - 1;
  return normalised * amplitude;
}

/**
 * Friendly brand name for headers / banners. Returns 'MedPay', etc.
 */
export function brandDisplayName(brand: Exclude<BrandCode, 'direct'>): string {
  return BRANDS[brand].name;
}
