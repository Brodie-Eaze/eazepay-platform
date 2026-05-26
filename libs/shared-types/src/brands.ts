/**
 * @deprecated for lifecycle/status concerns — use `./taxonomy.ts`.
 * This file remains the source of truth for brand presentation metadata
 * (full names, taglines, accent colors, envelopes) only. Builders Q + R
 * will migrate remaining lifecycle consumers off the duplicate
 * definitions in `apps/partner-portal/lib/master-data.ts`.
 *
 * EazePay product brands.
 *
 * Each brand is a distinct consumer-facing surface (logo + landing +
 * apply variant) routed through the same orchestration engine. A
 * Merchant signs up under one brand; a Partner is approved for one or
 * more brands; a Consumer applies under the brand the merchant chose.
 *
 * Codes are stable and stored on Merchant, LenderProduct,
 * LenderConnection, and Application rows.
 */
export type BrandCode = 'tradepay' | 'medpay' | 'coachpay' | 'direct';

export interface BrandSpec {
  code: BrandCode;
  /** Long form, e.g. "TradePay by EazePay" */
  fullName: string;
  /** Short tag, e.g. "TradePay" */
  name: string;
  /** One-liner used in nav chips + cards */
  tagline: string;
  /** Primary verticals served */
  verticals: string[];
  /** Typical loan size + term envelope (presentation only) */
  envelope: { sizeMin: number; sizeMax: number; termMin: number; termMax: number };
  /** Hex (light) — already in token form but exposed for marketing surfaces */
  accentHex: string;
  /** Internal slug used in URLs and route ids */
  slug: string;
}

export const BRANDS: Record<BrandCode, BrandSpec> = {
  tradepay: {
    code: 'tradepay',
    fullName: 'TradePay by EazePay',
    name: 'TradePay',
    tagline: 'Finance for home improvement, solar, roofing, HVAC, and contractor jobs.',
    verticals: ['Home improvement', 'Solar', 'Roof', 'HVAC', 'Pool & spa', 'Windows', 'Renovation'],
    envelope: { sizeMin: 2_000_00, sizeMax: 100_000_00, termMin: 24, termMax: 144 },
    // Slate primary + warm safety-orange accent — matches the TradePay landing page.
    // Source of truth: apps/partner-portal/lib/brand-theme.ts (BRAND_THEME.tradepay.accentHex).
    // brand-theme.spec.ts asserts this stays in sync.
    accentHex: '#D4581A',
    slug: 'tradepay',
  },
  medpay: {
    code: 'medpay',
    fullName: 'MedPay by EazePay',
    name: 'MedPay',
    tagline: 'Patient financing for dental, medical, vision, vet, and fertility.',
    verticals: ['Dental', 'Orthodontics', 'Cosmetic', 'Vision', 'Fertility', 'Vet', 'Specialty'],
    envelope: { sizeMin: 1_000_00, sizeMax: 50_000_00, termMin: 6, termMax: 84 },
    // Clinical teal — matches the MedPay landing page primary.
    accentHex: '#0E7C66',
    slug: 'medpay',
  },
  coachpay: {
    code: 'coachpay',
    fullName: 'CoachPay by EazePay',
    name: 'CoachPay',
    tagline: 'Pay-over-time for coaching, certifications, and professional development.',
    verticals: [
      'Executive coaching',
      'Certifications',
      'Bootcamps',
      'Career programs',
      'Online courses',
    ],
    envelope: { sizeMin: 500_00, sizeMax: 30_000_00, termMin: 6, termMax: 60 },
    // Violet — matches CoachPay landing + brand-theme.ts.
    // Source of truth: apps/partner-portal/lib/brand-theme.ts (BRAND_THEME.coachpay.accentHex).
    // brand-theme.spec.ts asserts this stays in sync.
    accentHex: '#7C3AED',
    slug: 'coachpay',
  },
  direct: {
    code: 'direct',
    fullName: 'EazePay Direct',
    name: 'EazePay Direct',
    tagline: 'General-purpose personal financing originated direct from the consumer app.',
    verticals: ['Consolidation', 'Personal', 'Life events'],
    envelope: { sizeMin: 1_000_00, sizeMax: 40_000_00, termMin: 12, termMax: 60 },
    accentHex: '#5B5BD6',
    slug: 'eazepay',
  },
};

export const BRAND_ORDER: BrandCode[] = ['tradepay', 'medpay', 'coachpay', 'direct'];

export const brandFor = (code: string | undefined | null): BrandSpec =>
  BRANDS[(code as BrandCode) ?? 'direct'] ?? BRANDS.direct;
