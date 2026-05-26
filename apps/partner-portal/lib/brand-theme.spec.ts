import { describe, it, expect } from 'vitest';
import {
  ALL_BRAND_SLUGS,
  BRAND_THEME,
  INDUSTRY_TO_BRAND,
  getBrandFromIndustry,
  getBrandTheme,
  type BrandSlug,
  type BrandTheme,
} from './brand-theme';
import { BRANDS } from '@eazepay/shared-types';

/**
 * Spec coverage for `lib/brand-theme.ts`.
 *
 * The brand record is a single source of truth — if a row goes
 * missing or a hex code typo's into invalidity, every brand-aware
 * surface breaks at once. The tests below pin the invariants:
 *
 *   • Every BrandSlug has a complete BrandTheme row
 *   • Every theme's industry maps back to the same slug via the
 *     inverse table (round-trip)
 *   • Hex codes are 6-char canonical (#RRGGBB)
 *   • Wordmark concatenation reads as the brand name (Med + Pay)
 *   • Accessors return null on bad input rather than throwing
 *
 * The tests don't pin the COLOR VALUES themselves — those are a
 * design call, not a contract. Changing #0E7C66 to a tweaked teal
 * is a one-line edit that shouldn't break a spec.
 */

const ALL_THEME_ROWS = Object.entries(BRAND_THEME) as Array<[BrandSlug, BrandTheme]>;

describe('lib/brand-theme', () => {
  describe('shape integrity', () => {
    it('exports a theme row for every brand in ALL_BRAND_SLUGS', () => {
      for (const slug of ALL_BRAND_SLUGS) {
        expect(BRAND_THEME[slug]).toBeDefined();
      }
    });

    it('every theme row has the expected fields populated', () => {
      for (const [, theme] of ALL_THEME_ROWS) {
        expect(theme.name).toMatch(/^[A-Z][a-zA-Z]+$/);
        expect(theme.markPrimary.length).toBeGreaterThan(0);
        expect(theme.markSecondary.length).toBeGreaterThan(0);
        expect(['medical', 'trades', 'coaching']).toContain(theme.industry);
        expect(theme.accentHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(theme.accentHexHover).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(theme.surfaceTintHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('every theme row has Tailwind-static class strings that embed the matching hex', () => {
      // Tailwind's JIT scans source files for these literal strings.
      // Pinning the format here means a future "let's reformat the
      // theme record" refactor can't silently drop a class string and
      // ship a deploy with unstyled brand buttons.
      for (const [, theme] of ALL_THEME_ROWS) {
        expect(theme.accentBgClass).toBe(`bg-[${theme.accentHex}]`);
        expect(theme.accentBgHoverClass).toBe(`hover:bg-[${theme.accentHexHover}]`);
        expect(theme.surfaceTintClass).toBe(`bg-[${theme.surfaceTintHex}]`);
      }
    });

    it('every theme name is the concatenation of its wordmark halves', () => {
      for (const [, theme] of ALL_THEME_ROWS) {
        expect(theme.name).toBe(`${theme.markPrimary}${theme.markSecondary}`);
      }
    });

    it('accent vs surface-tint hex are distinct (no all-white themes)', () => {
      for (const [, theme] of ALL_THEME_ROWS) {
        expect(theme.accentHex.toLowerCase()).not.toBe(theme.surfaceTintHex.toLowerCase());
      }
    });
  });

  describe('industry ↔ brand round-trip', () => {
    it('every theme.industry maps back to its own slug via INDUSTRY_TO_BRAND', () => {
      for (const [slug, theme] of ALL_THEME_ROWS) {
        expect(INDUSTRY_TO_BRAND[theme.industry]).toBe(slug);
      }
    });

    it('INDUSTRY_TO_BRAND covers exactly the three brand industries', () => {
      expect(Object.keys(INDUSTRY_TO_BRAND).sort()).toEqual(['coaching', 'medical', 'trades']);
    });
  });

  describe('getBrandTheme()', () => {
    it('returns the theme for a known slug', () => {
      const theme = getBrandTheme('medpay');
      expect(theme).not.toBeNull();
      expect(theme?.name).toBe('MedPay');
    });

    it('returns null for an unknown slug', () => {
      expect(getBrandTheme('unknown')).toBeNull();
      expect(getBrandTheme('')).toBeNull();
      expect(getBrandTheme(null)).toBeNull();
      expect(getBrandTheme(undefined)).toBeNull();
    });
  });

  describe('getBrandFromIndustry()', () => {
    it('returns the correct brand for each industry', () => {
      expect(getBrandFromIndustry('medical')).toBe('medpay');
      expect(getBrandFromIndustry('trades')).toBe('tradepay');
      expect(getBrandFromIndustry('coaching')).toBe('coachpay');
    });

    it('returns null for "other" and empty industry', () => {
      expect(getBrandFromIndustry('other')).toBeNull();
      expect(getBrandFromIndustry('')).toBeNull();
    });
  });

  /**
   * Brand-color lock against shared-types.
   *
   * `apps/partner-portal/lib/brand-theme.ts` is the canonical source
   * (used by checkout + onboarding wizard, the highest-traffic surfaces).
   * `libs/shared-types/src/brands.ts` exposes `accentHex` for marketing
   * surfaces and the orchestrator — these MUST match the canonical
   * theme, otherwise a partner sees one shade in the wizard and another
   * on a brand-aware admin page. Both files must be updated together.
   */
  describe('parity with @eazepay/shared-types BRANDS', () => {
    it.each(['medpay', 'tradepay', 'coachpay'] as const)(
      '%s accentHex matches BRANDS[%s].accentHex',
      (slug) => {
        expect(BRAND_THEME[slug].accentHex.toLowerCase()).toBe(
          BRANDS[slug].accentHex.toLowerCase(),
        );
      },
    );

    it('locks the three brand accent values', () => {
      expect(BRAND_THEME.medpay.accentHex).toBe('#0E7C66');
      expect(BRAND_THEME.tradepay.accentHex).toBe('#D4581A');
      expect(BRAND_THEME.coachpay.accentHex).toBe('#7C3AED');
    });
  });

  describe('ALL_BRAND_SLUGS', () => {
    it('contains exactly the three brand slugs in roadmap order', () => {
      expect(ALL_BRAND_SLUGS).toEqual(['medpay', 'tradepay', 'coachpay']);
    });

    it('is frozen so callers cannot mutate it', () => {
      expect(Object.isFrozen(ALL_BRAND_SLUGS)).toBe(true);
    });
  });
});
