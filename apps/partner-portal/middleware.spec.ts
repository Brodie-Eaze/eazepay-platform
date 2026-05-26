import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { signDemoPreset, _resetDemoCookieKeyCache } from './lib/demo-cookie';

/**
 * Middleware fence smoke tests.
 *
 * The middleware has two jobs: inject `x-pathname` on the RSC request
 * headers, and bounce unauthed requests to `/sign-in?from=<safe-path>`.
 * SEC-008 closed an open-redirect vector in `from`; SEC-103 added HMAC
 * signature verification on the demo cookie so a forged value fails
 * the auth fence.
 *
 * Note: `NextRequest` in vitest doesn't emit a real 302 — the Response
 * object carries the redirect target in its `Location` header.
 */

function unauthedRequest(url: string): NextRequest {
  return new NextRequest(url);
}

function realAuthedRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { cookie: 'eazepay_at=fake-access-token' },
  });
}

async function demoAuthedRequest(url: string, preset = 'medpay'): Promise<NextRequest> {
  const signed = await signDemoPreset(preset, 60);
  return new NextRequest(url, {
    headers: { cookie: `eazepay_demo=${signed}` },
  });
}

function forgedDemoRequest(url: string, fakeValue = 'medpay'): NextRequest {
  // why: a bare preset (pre-SEC-103 cookie shape) is what an attacker
  // would set if they didn't have the HMAC secret.
  return new NextRequest(url, {
    headers: { cookie: `eazepay_demo=${fakeValue}` },
  });
}

describe('partner-portal middleware', () => {
  beforeEach(() => {
    _resetDemoCookieKeyCache();
    process.env.DEMO_COOKIE_SECRET = 'unit-test-secret-x'.padEnd(40, '_');
  });

  it('redirects unauthed /control-panel to /sign-in with from=/control-panel', async () => {
    const res = await middleware(unauthedRequest('http://localhost:3004/control-panel'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    const u = new URL(location!);
    expect(u.pathname).toBe('/sign-in');
    expect(u.searchParams.get('from')).toBe('/control-panel');
  });

  it('SEC-008 — scheme-relative path (//evil.com) is normalised to /', async () => {
    const res = await middleware(unauthedRequest('http://localhost:3004//evil.com'));
    const u = new URL(res.headers.get('location')!);
    expect(u.pathname).toBe('/sign-in');
    expect(u.searchParams.get('from')).toBe('/');
  });

  it('SEC-008 — absolute URL in pathname normalises to /', async () => {
    const res = await middleware(unauthedRequest('http://localhost:3004/https://evil.com/path'));
    const u = new URL(res.headers.get('location')!);
    expect(u.pathname).toBe('/sign-in');
    expect(u.searchParams.get('from')).toBe('/https://evil.com/path');
  });

  it('preserves the query string in the from parameter', async () => {
    const res = await middleware(
      unauthedRequest('http://localhost:3004/control-panel?tab=invites'),
    );
    const u = new URL(res.headers.get('location')!);
    expect(u.searchParams.get('from')).toBe('/control-panel?tab=invites');
  });

  it('authed request to /control-panel passes through (no redirect)', async () => {
    const res = await middleware(realAuthedRequest('http://localhost:3004/control-panel'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-request-x-pathname')).toBe('/control-panel');
  });

  it('public paths are not gated (no auth required)', async () => {
    const signIn = await middleware(unauthedRequest('http://localhost:3004/sign-in'));
    expect(signIn.headers.get('location')).toBeNull();
    const apply = await middleware(unauthedRequest('http://localhost:3004/apply/medpay'));
    expect(apply.headers.get('location')).toBeNull();
  });

  it('/_next/* is public', async () => {
    const nextAsset = await middleware(
      unauthedRequest('http://localhost:3004/_next/static/chunk.js'),
    );
    expect(nextAsset.headers.get('location')).toBeNull();
  });

  // SEC-001 / Task #41 — `/api/*` is NOT blanket-public anymore. The
  // allowlist captures webhooks, health, public consumer submit, and
  // auth/onboarding flows; everything else flows through the fence.
  describe('SEC-001 — /api/* auth fence', () => {
    it('/api/health is allowlisted (Railway probe must work without cookies)', async () => {
      const res = await middleware(unauthedRequest('http://localhost:3004/api/health'));
      expect(res.status).not.toBe(401);
      expect(res.headers.get('location')).toBeNull();
    });

    it('webhook ingestion routes are allowlisted (HMAC-auth at handler)', async () => {
      const hs = await middleware(
        unauthedRequest('http://localhost:3004/api/integrations/highsale/webhook'),
      );
      expect(hs.status).not.toBe(401);
      const mc = await middleware(
        unauthedRequest('http://localhost:3004/api/integrations/micamp/webhook'),
      );
      expect(mc.status).not.toBe(401);
    });

    it('public consumer apply submit is allowlisted', async () => {
      const res = await middleware(unauthedRequest('http://localhost:3004/api/v1/applications'));
      expect(res.status).not.toBe(401);
    });

    it('/api/admin/audit is fenced — anonymous request returns 401 JSON', async () => {
      const res = await middleware(unauthedRequest('http://localhost:3004/api/admin/audit'));
      expect(res.status).toBe(401);
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('/api/onboarding/provision is fenced — anonymous request returns 401 JSON', async () => {
      const res = await middleware(
        unauthedRequest('http://localhost:3004/api/onboarding/provision'),
      );
      expect(res.status).toBe(401);
    });

    it('authed admin request to /api/admin/audit passes through fence', async () => {
      const req = await demoAuthedRequest('http://localhost:3004/api/admin/audit', 'master');
      const res = await middleware(req);
      expect(res.status).not.toBe(401);
    });
  });

  describe('SEC-103 — signed demo cookie enforcement', () => {
    it('valid signed demo cookie passes through', async () => {
      const req = await demoAuthedRequest('http://localhost:3004/control-panel');
      const res = await middleware(req);
      expect(res.headers.get('location')).toBeNull();
    });

    it('forged (unsigned) demo cookie fails auth fence and redirects to /sign-in', async () => {
      const req = forgedDemoRequest('http://localhost:3004/control-panel', 'master');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      const u = new URL(res.headers.get('location')!);
      expect(u.pathname).toBe('/sign-in');
    });

    it('demo cookie signed with a different secret fails auth fence', async () => {
      const signed = await signDemoPreset('master', 60);
      _resetDemoCookieKeyCache();
      process.env.DEMO_COOKIE_SECRET = 'rotated-different-secret'.padEnd(40, '_');
      const req = new NextRequest('http://localhost:3004/control-panel', {
        headers: { cookie: `eazepay_demo=${signed}` },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
    });
  });
});
