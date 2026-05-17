import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { allowedPartnerIdsForBrand, getSessionContext, requireSession } from './session';
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
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('getSessionContext', () => {
    it('returns mode:none when no cookies present', () => {
      expect(getSessionContext(mockReq({}))).toEqual({ mode: 'none' });
    });

    it('returns mode:none for unknown demo preset', () => {
      expect(getSessionContext(mockReq({ eazepay_demo: 'attacker' }))).toEqual({
        mode: 'none',
      });
    });

    it('resolves brand preset as scoped demo', () => {
      expect(getSessionContext(mockReq({ eazepay_demo: 'medpay' }))).toEqual({
        mode: 'demo',
        preset: 'medpay',
        isOperator: false,
        brand: 'medpay',
      });
    });

    it('resolves operator preset as cross-brand', () => {
      expect(getSessionContext(mockReq({ eazepay_demo: 'master' }))).toEqual({
        mode: 'demo',
        preset: 'master',
        isOperator: true,
        brand: null,
      });
    });

    it('treats real session as deferred + emits breadcrumb', () => {
      const ctx = getSessionContext(mockReq({ eazepay_at: 'jwt-payload' }));
      expect(ctx).toEqual({ mode: 'real', placeholder: true });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('allowedPartnerIdsForBrand', () => {
    it('empty array when no session', () => {
      expect(allowedPartnerIdsForBrand({ mode: 'none' }, 'medpay')).toEqual([]);
    });

    it('brand-scoped demo can only access its own brand partners', () => {
      const medpaySession = getSessionContext(mockReq({ eazepay_demo: 'medpay' }));
      const medpayIds = allowedPartnerIdsForBrand(medpaySession, 'medpay');
      expect(medpayIds.length).toBeGreaterThan(0);
      // Cross-brand request → empty
      expect(allowedPartnerIdsForBrand(medpaySession, 'tradepay')).toEqual([]);
    });

    it('operator demo session can access partners for any brand', () => {
      const opSession = getSessionContext(mockReq({ eazepay_demo: 'master' }));
      const medpayIds = allowedPartnerIdsForBrand(opSession, 'medpay');
      const tradepayIds = allowedPartnerIdsForBrand(opSession, 'tradepay');
      expect(medpayIds.length).toBeGreaterThan(0);
      expect(tradepayIds.length).toBeGreaterThan(0);
    });

    it('returned partners include Multi-brand for the brand request', () => {
      const opSession = getSessionContext(mockReq({ eazepay_demo: 'master' }));
      const medpayIds = allowedPartnerIdsForBrand(opSession, 'medpay');
      const multiBrandIds = MASTER_PARTNERS.filter((p) => p.product === 'Multi-brand').map(
        (p) => p.id,
      );
      for (const id of multiBrandIds) expect(medpayIds).toContain(id);
    });
  });

  describe('requireSession', () => {
    it('returns 401 Response when no session', () => {
      const res = requireSession(mockReq({}));
      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
    });

    it('returns null when session present', () => {
      expect(requireSession(mockReq({ eazepay_demo: 'medpay' }))).toBeNull();
    });
  });
});
