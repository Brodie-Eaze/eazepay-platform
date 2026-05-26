import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requirePartnerSession, assertPartnerOwnership } from './server-guards';
import { signDemoPreset, _resetDemoCookieKeyCache } from './demo-cookie';
import { signAccountSession, _resetAccountCookieKeyCache } from './account-cookie';

/**
 * Server-guards tests (Task #41 / SEC-001).
 *
 * Coverage:
 *   - requireAdmin: anonymous → 401, demo brand → 403, demo master/admin/operator → ok
 *   - requirePartnerSession: anonymous → 401, account → partnerId, operator → admin override
 *   - assertPartnerOwnership: match → null, mismatch → 403, admin override → null
 */

function rawRequest(): NextRequest {
  return new NextRequest('http://localhost:3004/api/admin/audit');
}

async function adminDemoRequest(preset: 'master' | 'admin' | 'operator'): Promise<NextRequest> {
  const signed = await signDemoPreset(preset, 60);
  return new NextRequest('http://localhost:3004/api/admin/audit', {
    headers: { cookie: `eazepay_demo=${signed}` },
  });
}

async function brandDemoRequest(preset: 'medpay' | 'tradepay' | 'coachpay'): Promise<NextRequest> {
  const signed = await signDemoPreset(preset, 60);
  return new NextRequest('http://localhost:3004/api/admin/audit', {
    headers: { cookie: `eazepay_demo=${signed}` },
  });
}

async function accountRequest(
  partnerId: string,
  brand: 'medpay' | 'tradepay' | 'coachpay' = 'medpay',
): Promise<NextRequest> {
  const signed = await signAccountSession({ userId: 'u_1', brand, partnerId }, 60);
  return new NextRequest('http://localhost:3004/api/integrations/highsale/subaccount', {
    headers: { cookie: `eazepay_account=${signed}` },
  });
}

describe('server-guards', () => {
  beforeEach(() => {
    _resetDemoCookieKeyCache();
    _resetAccountCookieKeyCache();
    process.env.DEMO_COOKIE_SECRET = 'unit-test-secret-x'.padEnd(40, '_');
    process.env.ACCOUNT_COOKIE_SECRET = 'unit-test-account-x'.padEnd(40, '_');
  });

  describe('requireAdmin', () => {
    it('anonymous request returns 401 problem-details', async () => {
      const result = await requireAdmin(rawRequest());
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
        const body = await result.json();
        expect(body.code).toBe('not_signed_in');
      }
    });

    it('demo master preset → master_admin role', async () => {
      const result = await requireAdmin(await adminDemoRequest('master'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.role).toBe('master_admin');
        expect(result.actor).toBe('demo:master');
      }
    });

    it('demo admin preset → admin role', async () => {
      const result = await requireAdmin(await adminDemoRequest('admin'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.role).toBe('admin');
      }
    });

    it('demo brand preset (medpay) is NOT admin → 403', async () => {
      const result = await requireAdmin(await brandDemoRequest('medpay'));
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
        const body = await result.json();
        expect(body.code).toBe('forbidden');
      }
    });

    it('account session (real partner) is NOT admin → 403', async () => {
      const result = await requireAdmin(await accountRequest('partner_acme'));
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
      }
    });
  });

  describe('requirePartnerSession', () => {
    it('anonymous request returns 401', async () => {
      const result = await requirePartnerSession(rawRequest());
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
      }
    });

    it('account session returns the embedded partnerId + brand', async () => {
      const result = await requirePartnerSession(await accountRequest('partner_acme', 'medpay'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.partnerId).toBe('partner_acme');
        expect(result.brand).toBe('medpay');
        expect(result.isAdminOverride).toBe(false);
      }
    });

    it('operator demo session is treated as admin override (no partnerId)', async () => {
      const result = await requirePartnerSession(await adminDemoRequest('master'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.isAdminOverride).toBe(true);
        expect(result.partnerId).toBe('');
      }
    });

    it('brand demo session gets a synthetic non-matching partnerId', async () => {
      const result = await requirePartnerSession(await brandDemoRequest('medpay'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.brand).toBe('medpay');
        // Demo brand presets must NOT collide with any real partner id —
        // assertPartnerOwnership uses string-equality, so the synthetic
        // value has to start with a character no real slug uses.
        expect(result.partnerId.startsWith('_demo_')).toBe(true);
        expect(result.isAdminOverride).toBe(false);
      }
    });
  });

  describe('assertPartnerOwnership', () => {
    it('returns null on partnerId match', () => {
      const ctx = {
        partnerId: 'partner_acme',
        brand: 'medpay' as const,
        isAdminOverride: false,
      };
      expect(assertPartnerOwnership(ctx, 'partner_acme')).toBeNull();
    });

    it('returns 403 NextResponse on partnerId mismatch (cross-tenant)', async () => {
      const ctx = {
        partnerId: 'partner_acme',
        brand: 'medpay' as const,
        isAdminOverride: false,
      };
      const res = assertPartnerOwnership(ctx, 'partner_other');
      expect(res).toBeInstanceOf(NextResponse);
      if (res) {
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.code).toBe('forbidden');
      }
    });

    it('admin override bypasses ownership check', () => {
      const ctx = {
        partnerId: '',
        brand: 'direct' as const,
        isAdminOverride: true,
      };
      expect(assertPartnerOwnership(ctx, 'partner_acme')).toBeNull();
      expect(assertPartnerOwnership(ctx, 'partner_zzz')).toBeNull();
    });

    it('synthetic demo brand partnerId fails ownership against real slug', async () => {
      // Adversarial: a demo brand-preset session sends a request whose
      // body claims partnerId='partner_acme'. The synthetic prefix MUST
      // not equal any real slug, so assertPartnerOwnership returns 403.
      const ctx = {
        partnerId: '_demo_medpay',
        brand: 'medpay' as const,
        isAdminOverride: false,
      };
      const res = assertPartnerOwnership(ctx, 'partner_acme');
      expect(res).toBeInstanceOf(NextResponse);
      if (res) expect(res.status).toBe(403);
    });
  });
});
