import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { brandCodeFromSlug, resolveBrandAccess } from './brand-access';

describe('brand-access', () => {
  describe('brandCodeFromSlug', () => {
    it('resolves known slugs', () => {
      expect(brandCodeFromSlug('medpay')).toBe('medpay');
      expect(brandCodeFromSlug('tradepay')).toBe('tradepay');
      expect(brandCodeFromSlug('coachpay')).toBe('coachpay');
    });

    it('returns null for unknown slugs', () => {
      expect(brandCodeFromSlug('nope')).toBeNull();
      expect(brandCodeFromSlug('')).toBeNull();
      expect(brandCodeFromSlug('MEDPAY')).toBeNull();
    });
  });

  describe('resolveBrandAccess — unknown brand', () => {
    it('denies any unknown brand slug before reading session inputs', () => {
      expect(
        resolveBrandAccess('attacker', {
          hasRealSession: false,
          verifiedDemoPreset: 'medpay',
          verifiedAccountBrand: null,
        }),
      ).toEqual({ allowed: false, reason: 'unknown_brand_slug' });
    });
  });

  describe('resolveBrandAccess — demo cookie path', () => {
    it('allows matching brand preset on matching brand route', () => {
      expect(
        resolveBrandAccess('medpay', {
          hasRealSession: false,
          verifiedDemoPreset: 'medpay',
          verifiedAccountBrand: null,
        }),
      ).toEqual({ allowed: true, via: 'demo_brand_match' });
    });

    it('denies cross-brand access (medpay preset → tradepay route)', () => {
      expect(
        resolveBrandAccess('tradepay', {
          hasRealSession: false,
          verifiedDemoPreset: 'medpay',
          verifiedAccountBrand: null,
        }),
      ).toEqual({ allowed: false, reason: 'demo_brand_mismatch' });
    });

    it('denies cross-brand access (coachpay preset → medpay route)', () => {
      expect(
        resolveBrandAccess('medpay', {
          hasRealSession: false,
          verifiedDemoPreset: 'coachpay',
          verifiedAccountBrand: null,
        }),
      ).toEqual({ allowed: false, reason: 'demo_brand_mismatch' });
    });

    it('allows master demo preset on any brand', () => {
      for (const slug of ['medpay', 'tradepay', 'coachpay']) {
        expect(
          resolveBrandAccess(slug, {
            hasRealSession: false,
            verifiedDemoPreset: 'master',
            verifiedAccountBrand: null,
          }),
        ).toEqual({ allowed: true, via: 'demo_operator' });
      }
    });

    it('allows all/admin/operator/viewer/investor on any brand', () => {
      for (const preset of ['all', 'admin', 'operator', 'viewer', 'investor']) {
        for (const slug of ['medpay', 'tradepay', 'coachpay']) {
          expect(
            resolveBrandAccess(slug, {
              hasRealSession: false,
              verifiedDemoPreset: preset,
              verifiedAccountBrand: null,
            }),
          ).toEqual({ allowed: true, via: 'demo_operator' });
        }
      }
    });

    it('denies an unknown demo preset', () => {
      expect(
        resolveBrandAccess('medpay', {
          hasRealSession: false,
          verifiedDemoPreset: 'attacker-role',
          verifiedAccountBrand: null,
        }),
      ).toEqual({ allowed: false, reason: 'demo_preset_unknown' });
    });

    it('denies when verifiedDemoPreset is null and no real session', () => {
      expect(
        resolveBrandAccess('medpay', {
          hasRealSession: false,
          verifiedDemoPreset: null,
          verifiedAccountBrand: null,
        }),
      ).toEqual({ allowed: false, reason: 'no_session' });
    });
  });

  describe('resolveBrandAccess — real session path', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('F-006: real-session cookie is DENIED (no silent bypass)', () => {
      const result = resolveBrandAccess('medpay', {
        hasRealSession: true,
        verifiedDemoPreset: null,
        verifiedAccountBrand: null,
      });
      // Pre-fix: { allowed:true, via:'real_session_deferred' } — an
      // attacker with a planted cookie silently passed every brand
      // gate. Now denied with a distinct reason so dashboards can
      // alert on it.
      expect(result).toEqual({ allowed: false, reason: 'real_session_unverified' });
    });

    it('F-006: real-session bypass still denies an unknown brand slug first', () => {
      const result = resolveBrandAccess('attacker', {
        hasRealSession: true,
        verifiedDemoPreset: null,
        verifiedAccountBrand: null,
      });
      expect(result).toEqual({ allowed: false, reason: 'unknown_brand_slug' });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('resolveBrandAccess — account-session path', () => {
    it('allows when verifiedAccountBrand matches the URL brand', () => {
      expect(
        resolveBrandAccess('medpay', {
          hasRealSession: false,
          verifiedDemoPreset: null,
          verifiedAccountBrand: 'medpay',
        }),
      ).toEqual({ allowed: true, via: 'account_brand_match' });
    });

    it('denies when verifiedAccountBrand does not match (cross-brand)', () => {
      expect(
        resolveBrandAccess('tradepay', {
          hasRealSession: false,
          verifiedDemoPreset: null,
          verifiedAccountBrand: 'medpay',
        }),
      ).toEqual({ allowed: false, reason: 'account_brand_mismatch' });
    });

    it('account session takes priority over demo cookie', () => {
      expect(
        resolveBrandAccess('medpay', {
          hasRealSession: false,
          verifiedDemoPreset: 'master', // would normally grant operator
          verifiedAccountBrand: 'medpay',
        }),
      ).toEqual({ allowed: true, via: 'account_brand_match' });
    });
  });
});
