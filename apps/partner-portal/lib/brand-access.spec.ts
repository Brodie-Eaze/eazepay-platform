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
    it('denies any unknown brand slug before reading cookies', () => {
      expect(resolveBrandAccess('attacker', { eazepay_demo: 'medpay' })).toEqual({
        allowed: false,
        reason: 'unknown_brand_slug',
      });
    });
  });

  describe('resolveBrandAccess — demo cookie path', () => {
    it('allows matching brand preset on matching brand route', () => {
      expect(resolveBrandAccess('medpay', { eazepay_demo: 'medpay' })).toEqual({
        allowed: true,
        via: 'demo_brand_match',
      });
    });

    it('denies cross-brand access (medpay preset → tradepay route)', () => {
      expect(resolveBrandAccess('tradepay', { eazepay_demo: 'medpay' })).toEqual({
        allowed: false,
        reason: 'demo_brand_mismatch',
      });
    });

    it('denies cross-brand access (coachpay preset → medpay route)', () => {
      expect(resolveBrandAccess('medpay', { eazepay_demo: 'coachpay' })).toEqual({
        allowed: false,
        reason: 'demo_brand_mismatch',
      });
    });

    it('allows master demo preset on any brand', () => {
      expect(resolveBrandAccess('medpay', { eazepay_demo: 'master' })).toEqual({
        allowed: true,
        via: 'demo_operator',
      });
      expect(resolveBrandAccess('tradepay', { eazepay_demo: 'master' })).toEqual({
        allowed: true,
        via: 'demo_operator',
      });
      expect(resolveBrandAccess('coachpay', { eazepay_demo: 'master' })).toEqual({
        allowed: true,
        via: 'demo_operator',
      });
    });

    it('allows all/admin/operator/viewer/investor on any brand', () => {
      for (const preset of ['all', 'admin', 'operator', 'viewer', 'investor']) {
        for (const slug of ['medpay', 'tradepay', 'coachpay']) {
          expect(resolveBrandAccess(slug, { eazepay_demo: preset })).toEqual({
            allowed: true,
            via: 'demo_operator',
          });
        }
      }
    });

    it('denies an unknown demo preset', () => {
      expect(resolveBrandAccess('medpay', { eazepay_demo: 'attacker-role' })).toEqual({
        allowed: false,
        reason: 'demo_preset_unknown',
      });
    });

    it('denies when no cookies are present', () => {
      expect(resolveBrandAccess('medpay', {})).toEqual({
        allowed: false,
        reason: 'no_session',
      });
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

    it('allows real session as deferred and emits a structured breadcrumb', () => {
      const result = resolveBrandAccess('medpay', { eazepay_at: 'jwt-payload' });
      expect(result).toEqual({ allowed: true, via: 'real_session_deferred' });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const arg = warnSpy.mock.calls[0]?.[0];
      expect(typeof arg).toBe('string');
      const parsed = JSON.parse(arg as string);
      expect(parsed.event).toBe('brand_access.real_session_deferred');
      expect(parsed.brand).toBe('medpay');
    });

    it('real-session bypass still denies an unknown brand slug', () => {
      const result = resolveBrandAccess('attacker', { eazepay_at: 'jwt' });
      expect(result).toEqual({ allowed: false, reason: 'unknown_brand_slug' });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
