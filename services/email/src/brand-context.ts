import type { BrandCode } from '@eazepay/shared-types';

/**
 * Per-vertical email branding context.
 *
 * Every branded email — welcome, password reset, team invite, invoice,
 * application status — passes through `resolveBrandContext(brand)` to
 * get the right from-address, accent color, logo URL, and copy
 * variants. A MedPay merchant gets emails from `noreply@medpay.eazepay.com`
 * with MedPay's emerald accent; TradePay gets safety-orange; CoachPay
 * gets indigo. Same email infrastructure, three brand surfaces.
 *
 * The `direct` BrandCode (cross-vertical EazePay) and master operator
 * mail both use the parent `noreply@eazepay.com` address. Operators
 * never receive brand-flavored email — only partner merchants do.
 *
 * Domain verification posture: each subdomain must be verified in
 * Resend (DKIM + SPF + DMARC). The from-address values below must
 * match an exact verified sender in the Resend dashboard or the API
 * returns 422 `from_address_invalid`.
 *
 * Logo URLs point at public CDN assets shipped with the marketing
 * site. Inline-base64 would be safer for off-line resilience but
 * inflates email size; URL works for every modern mail client.
 */
export interface BrandEmailContext {
  brand: BrandCode | 'master';
  /** Display name + email: `MedPay <noreply@medpay.eazepay.com>` */
  fromAddress: string;
  /** Address users reply to. Defaults to support@eazepay.com if unset. */
  replyTo: string;
  /** Hex accent for buttons + section headers. */
  accentHex: string;
  /** Public CDN URL to the brand wordmark (300px wide PNG). */
  logoUrl: string;
  /** Plain-language brand name for body copy ("MedPay", "TradePay"…). */
  brandName: string;
  /** Help-center URL for the footer. */
  helpUrl: string;
  /** Legal entity name for the footer disclaimer. */
  legalEntity: string;
}

const ROOT_DOMAIN = process.env.EMAIL_ROOT_DOMAIN ?? 'eazepay.com';
const CDN_BASE = process.env.EMAIL_CDN_BASE ?? `https://${ROOT_DOMAIN}/static/email`;

const CONTEXTS: Record<BrandCode | 'master', BrandEmailContext> = {
  medpay: {
    brand: 'medpay',
    fromAddress: `MedPay <noreply@medpay.${ROOT_DOMAIN}>`,
    replyTo: `support@medpay.${ROOT_DOMAIN}`,
    accentHex: '#0e7c66',
    logoUrl: `${CDN_BASE}/medpay-wordmark.png`,
    brandName: 'MedPay',
    helpUrl: `https://medpay.${ROOT_DOMAIN}/help`,
    legalEntity: 'EazePay Financial Services, LLC dba MedPay',
  },
  tradepay: {
    brand: 'tradepay',
    fromAddress: `TradePay <noreply@tradepay.${ROOT_DOMAIN}>`,
    replyTo: `support@tradepay.${ROOT_DOMAIN}`,
    accentHex: '#f97316',
    logoUrl: `${CDN_BASE}/tradepay-wordmark.png`,
    brandName: 'TradePay',
    helpUrl: `https://tradepay.${ROOT_DOMAIN}/help`,
    legalEntity: 'EazePay Financial Services, LLC dba TradePay',
  },
  coachpay: {
    brand: 'coachpay',
    fromAddress: `CoachPay <noreply@coachpay.${ROOT_DOMAIN}>`,
    replyTo: `support@coachpay.${ROOT_DOMAIN}`,
    accentHex: '#6366f1',
    logoUrl: `${CDN_BASE}/coachpay-wordmark.png`,
    brandName: 'CoachPay',
    helpUrl: `https://coachpay.${ROOT_DOMAIN}/help`,
    legalEntity: 'EazePay Financial Services, LLC dba CoachPay',
  },
  direct: {
    brand: 'direct',
    fromAddress: `EazePay <noreply@${ROOT_DOMAIN}>`,
    replyTo: `support@${ROOT_DOMAIN}`,
    accentHex: '#0d1530',
    logoUrl: `${CDN_BASE}/eazepay-wordmark.png`,
    brandName: 'EazePay',
    helpUrl: `https://${ROOT_DOMAIN}/help`,
    legalEntity: 'EazePay Financial Services, LLC',
  },
  master: {
    brand: 'master',
    fromAddress: `EazePay Operations <ops@${ROOT_DOMAIN}>`,
    replyTo: `ops@${ROOT_DOMAIN}`,
    accentHex: '#0d1530',
    logoUrl: `${CDN_BASE}/eazepay-wordmark.png`,
    brandName: 'EazePay',
    helpUrl: `https://${ROOT_DOMAIN}/help`,
    legalEntity: 'EazePay Financial Services, LLC',
  },
};

export function resolveBrandContext(brand: BrandCode | 'master'): BrandEmailContext {
  return CONTEXTS[brand];
}

/** Read-only export for tests / inspection. Don't mutate. */
export const BRAND_EMAIL_CONTEXTS = CONTEXTS;
