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

    it('F-006: rejects unverifiable eazepay_at cookie (no silent elevation)', async () => {
      // Pre-fix, any non-empty `eazepay_at` cookie returned
      // {mode:'real', placeholder:true} — operator-equivalent visibility
      // for anyone who could plant a cookie. The verifier stub now
      // returns invalid, so the resolver must fall through to mode:none.
      const ctx = await getSessionContext(mockReq({ eazepay_at: 'attacker-planted' }));
      expect(ctx).toEqual({ mode: 'none' });
    });

    it('F-006: repeated eazepay_at requests do not throw + remain no-session', async () => {
      // Warn is per-process latched (we don't want to spam under
      // sustained attacker probing). Behavioural contract: every call
      // still resolves to mode:none.
      for (let i = 0; i < 5; i++) {
        const ctx = await getSessionContext(mockReq({ eazepay_at: `probe-${i}` }));
        expect(ctx).toEqual({ mode: 'none' });
      }
    });

    it('F-006: eazepay_at + valid demo cookie falls through to demo session', async () => {
      const signed = await signDemoPreset('medpay', 60);
      const ctx = await getSessionContext(
        mockReq({ eazepay_at: 'attacker-planted', eazepay_demo: signed }),
      );
      expect(ctx).toEqual({
        mode: 'demo',
        preset: 'medpay',
        isOperator: false,
        brand: 'medpay',
      });
    });
  });

  describe('verifyAccessToken (F-006 stub)', () => {
    it('returns {valid:false} for any token until /v1/me is wired', async () => {
      const { verifyAccessToken } = await import('./session');
      expect(await verifyAccessToken('anything')).toEqual({ valid: false });
      expect(await verifyAccessToken('')).toEqual({ valid: false });
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
