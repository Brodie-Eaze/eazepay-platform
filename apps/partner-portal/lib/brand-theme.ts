/**
 * Central source of truth for the three vertical brands.
 *
 * Why this module exists
 * ----------------------
 * Before this module, three different surfaces each defined their own
 * brand config:
 *
 *   • `app/<brand>/checkout/page.tsx`    — `mpf-*` CSS namespace with
 *                                          inline color tokens
 *   • `app/<brand>/onboarding/page.tsx`  — `mp-onb-*` / `tp-onb-*` /
 *                                          `cp-onb-*` namespaces
 *   • `app/welcome/wizard.tsx`           — Tailwind arbitrary-value
 *                                          classes (`bg-[#0E7C66]`)
 *
 * Three independent definitions of "what color is MedPay teal" is one
 * rebrand decision away from a bug. This module is the canonical
 * record; the surfaces above will be migrated to read from it over
 * subsequent PRs (low-risk, mechanical work).
 *
 * Shape
 * -----
 *   • `BrandSlug` — the type for the URL slug (`'medpay'`, etc.)
 *   • `Industry` — the form-level industry value that maps onto a
 *     brand. Re-exported from `app/welcome/state.ts` so callers don't
 *     have to import from two places.
 *   • `BRAND_THEME` — the record keyed by `BrandSlug`.
 *   • `INDUSTRY_TO_BRAND` — the inverse mapping used by the
 *     `/api/onboarding/submit` route and the future operator-driven
 *     onboarding tool.
 *   • `getBrandTheme(slug)` / `getBrandFromIndustry(industry)` —
 *     accessors that return `null` for unknown values rather than
 *     throwing. Callers branch on the null.
 *
 * What's intentionally NOT here
 * -----------------------------
 *   • The dark Aurean-onboarding palette tokens (the `--accent` /
 *     `--ambient-glow` CSS variables on `/medpay/onboarding`). Those
 *     describe a *visual moment* (pre-form celebration), not the
 *     brand surface. The light theme below is the form / content
 *     surface; the dark theme stays inline in the onboarding pages.
 *   • Hover / focus / disabled state colors. The wizard derives those
 *     from Tailwind utility classes that compose with the accent.
 *     A full token system (every interactive state) is overkill for
 *     the three-brand scope today.
 */

import type { Industry } from '../app/welcome/state';

export type BrandSlug = 'medpay' | 'tradepay' | 'coachpay';

export interface BrandTheme {
  /** Visible name in headers + headings ("MedPay"). */
  name: string;
  /** Two-line wordmark — `markPrimary/markSecondary` rendered as
   *  `Med/Pay` in the header. Matches the existing checkout chrome. */
  markPrimary: string;
  markSecondary: string;
  /** Industry value that maps to this brand. The `/api/onboarding/submit`
   *  route uses the inverse mapping when a generic submission comes in. */
  industry: Extract<Industry, 'medical' | 'trades' | 'coaching'>;
  /** Primary brand color (hex). Used for buttons, active step pills,
   *  header icon background. Kept here so non-Tailwind consumers (eg.
   *  inline styles, JSON exports for non-React surfaces) can read it. */
  accentHex: string;
  /** Hover / lighter variant. */
  accentHexHover: string;
  /** Surface tint applied to the wizard `<main>` background — a very
   *  faint wash of the brand color so the form reads as a continuation
   *  of the landing page. Light enough to keep form fields legible. */
  surfaceTintHex: string;
  /**
   * Static Tailwind class strings. Tailwind's JIT scans `*.ts` /
   * `*.tsx` source for class literals — building strings at runtime
   * (`bg-[${accentHex}]`) wouldn't be visible to the scan. Listing
   * them as literals here means the scanner picks them up and the
   * CSS gets emitted for every brand, regardless of which page the
   * deploy reaches first.
   */
  accentBgClass: string;
  accentBgHoverClass: string;
  surfaceTintClass: string;
}

/**
 * Canonical theme record. Order matches the priority of the three
 * verticals in the founder's roadmap (MedPay first, then TradePay,
 * then CoachPay). Iteration order matters for sitemap generation.
 */
export const BRAND_THEME: Record<BrandSlug, BrandTheme> = {
  medpay: {
    name: 'MedPay',
    markPrimary: 'Med',
    markSecondary: 'Pay',
    industry: 'medical',
    accentHex: '#0E7C66',
    accentHexHover: '#22B8A0',
    surfaceTintHex: '#f3faf7',
    accentBgClass: 'bg-[#0E7C66]',
    accentBgHoverClass: 'hover:bg-[#22B8A0]',
    surfaceTintClass: 'bg-[#f3faf7]',
  },
  tradepay: {
    name: 'TradePay',
    markPrimary: 'Trade',
    markSecondary: 'Pay',
    industry: 'trades',
    accentHex: '#D4581A',
    accentHexHover: '#F47B3F',
    surfaceTintHex: '#fdf5ef',
    accentBgClass: 'bg-[#D4581A]',
    accentBgHoverClass: 'hover:bg-[#F47B3F]',
    surfaceTintClass: 'bg-[#fdf5ef]',
  },
  coachpay: {
    name: 'CoachPay',
    markPrimary: 'Coach',
    markSecondary: 'Pay',
    industry: 'coaching',
    accentHex: '#7C3AED',
    accentHexHover: '#A78BFA',
    surfaceTintHex: '#f6f3ff',
    accentBgClass: 'bg-[#7C3AED]',
    accentBgHoverClass: 'hover:bg-[#A78BFA]',
    surfaceTintClass: 'bg-[#f6f3ff]',
  },
};

/** Industry → brand. The form-step `Industry` enum has a fourth
 *  value (`'other'`) that maps to no brand — callers must handle
 *  that branch (`/api/onboarding/submit` returns 400 + a "we'll
 *  be in touch" message). */
export const INDUSTRY_TO_BRAND: Record<
  Extract<Industry, 'medical' | 'trades' | 'coaching'>,
  BrandSlug
> = {
  medical: 'medpay',
  trades: 'tradepay',
  coaching: 'coachpay',
};

/**
 * Lookup a theme by slug. Returns `null` for unknown values so the
 * caller can branch on the absence rather than catching a throw.
 *
 * The string-narrowing here is what lets the callsite avoid an
 * `as BrandSlug` cast — `slug as string` is sufficient since the
 * record keys are statically known.
 */
export function getBrandTheme(slug: string | undefined | null): BrandTheme | null {
  if (!slug) return null;
  return (BRAND_THEME as Record<string, BrandTheme | undefined>)[slug] ?? null;
}

/** Inverse of {@link getBrandTheme} — map an industry value to its
 *  brand slug. Returns `null` for `'other'` or any unknown value. */
export function getBrandFromIndustry(industry: Industry | ''): BrandSlug | null {
  if (industry === '' || industry === 'other') return null;
  return INDUSTRY_TO_BRAND[industry] ?? null;
}

/** Constant list of all brand slugs. Used by routing tables, sitemap
 *  generators, and tests that iterate over every brand. */
export const ALL_BRAND_SLUGS: readonly BrandSlug[] = Object.freeze([
  'medpay',
  'tradepay',
  'coachpay',
]);
