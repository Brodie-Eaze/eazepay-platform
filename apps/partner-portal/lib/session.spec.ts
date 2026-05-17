import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { allowedPartnerIdsForBrand, getSessionContext, requireSession } from './session';
import { signDemoPreset, _resetDemoCookieKeyCache } from './demo-cookie';
import { partners as MASTER_PARTNERS } from './master-data';

function mockReq(cookies: Record<string, string>): NextRequest {
  return {
    cookies: {
      get: (name: string) => (cookies[name] ? { value: cookies[name] } : undefined),
    },
  } as unknown as NextRequest;
}

describe('session', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetDemoCookieKeyCache();
    process.env.DEMO_COOKIE_SECRET = 'unit-test-secret-x'.padEnd(40, '_');
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('getSessionContext', () => {
    it('returns mode:none when no cookies present', async () => {
      expect(await getSessionContext(mockReq({}))).toEqual({ mode: 'none' });
    });

    it('returns mode:none for unsigned cookie', async () => {
      // Bare preset (pre-SEC-103 cookie shape) is no longer accepted.
      expect(await getSessionContext(mockReq({ eazepay_demo: 'medpay' }))).toEqual({
        mode: 'none',
      });
    });

    it('returns mode:none for cookie signed with a different secret', async () => {
      const signed = await signDemoPreset('master', 60);
      _resetDemoCookieKeyCache();
      process.env.DEMO_COOKIE_SECRET = 'rotated-different-secret'.padEnd(40, '_');
      expect(await getSessionContext(mockReq({ eazepay_demo: signed }))).toEqual({
        mode: 'none',
      });
    });

    it('resolves brand preset as scoped demo', async () => {
      const signed = await signDemoPreset('medpay', 60);
      expect(await getSessionContext(mockReq({ eazepay_demo: signed }))).toEqual({
        mode: 'demo',
        preset: 'medpay',
        isOperator: false,
        brand: 'medpay',
      });
    });

    it('resolves operator preset as cross-brand', async () => {
      const signed = await signDemoPreset('master', 60);
      expect(await getSessionContext(mockReq({ eazepay_demo: signed }))).toEqual({
        mode: 'demo',
        preset: 'master',
        isOperator: true,
        brand: null,
      });
    });

    it('treats real session as deferred + emits breadcrumb', async () => {
      const ctx = await getSessionContext(mockReq({ eazepay_at: 'jwt-payload' }));
      expect(ctx).toEqual({ mode: 'real', placeholder: true });
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('allowedPartnerIdsForBrand', () => {
    it('empty array when no session', () => {
      expect(allowedPartnerIdsForBrand({ mode: 'none' }, 'medpay')).toEqual([]);
    });

    it('brand-scoped demo can only access its own brand partners', async () => {
      const signed = await signDemoPreset('medpay', 60);
      const medpaySession = await getSessionContext(mockReq({ eazepay_demo: signed }));
      const medpayIds = allowedPartnerIdsForBrand(medpaySession, 'medpay');
      expect(medpayIds.length).toBeGreaterThan(0);
      expect(allowedPartnerIdsForBrand(medpaySession, 'tradepay')).toEqual([]);
    });

    it('operator demo session can access partners for any brand', async () => {
      const signed = await signDemoPreset('master', 60);
      const opSession = await getSessionContext(mockReq({ eazepay_demo: signed }));
      const medpayIds = allowedPartnerIdsForBrand(opSession, 'medpay');
      const tradepayIds = allowedPartnerIdsForBrand(opSession, 'tradepay');
      expect(medpayIds.length).toBeGreaterThan(0);
      expect(tradepayIds.length).toBeGreaterThan(0);
    });

    it('returned partners include Multi-brand for the brand request', async () => {
      const signed = await signDemoPreset('master', 60);
      const opSession = await getSessionContext(mockReq({ eazepay_demo: signed }));
      const medpayIds = allowedPartnerIdsForBrand(opSession, 'medpay');
      const multiBrandIds = MASTER_PARTNERS.filter((p) => p.product === 'Multi-brand').map(
        (p) => p.id,
      );
      for (const id of multiBrandIds) expect(medpayIds).toContain(id);
    });
  });

  describe('requireSession', () => {
    it('returns 401 Response when no session', async () => {
      const res = await requireSession(mockReq({}));
      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
    });

    it('returns 401 when cookie signature is invalid', async () => {
      const res = await requireSession(mockReq({ eazepay_demo: 'medpay' }));
      expect(res?.status).toBe(401);
    });

    it('returns null when valid signed session present', async () => {
      const signed = await signDemoPreset('medpay', 60);
      expect(await requireSession(mockReq({ eazepay_demo: signed }))).toBeNull();
    });
  });
});
