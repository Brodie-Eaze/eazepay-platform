import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import {
  __resetEdgeRateLimitForTests,
  peek as peekEdgeRateLimit,
} from '../../../../lib/edge-rate-limit';

/**
 * SEC-203 — credential-stuffing rate limit.
 *
 * Two buckets: per-IP (10/min) and per-identifier (5/min). The 429
 * body MUST be identifier-agnostic so the response cannot be used
 * as an "email exists?" oracle.
 *
 * The success path is gated by the backend /v1/auth/login which is
 * unreachable in vitest — we don't try to test it here. The pre-fix
 * behaviour for an unreachable backend is the 502 / demo-fallback
 * branch, which is unchanged.
 */

function loginRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const PW = 'something-not-empty';

describe('POST /api/auth/login (SEC-203 rate limit)', () => {
  beforeEach(() => {
    __resetEdgeRateLimitForTests();
  });

  it('per-IP cap: the 11th attempt from one IP returns 429', async () => {
    const ip = '203.0.113.10';
    // 10 attempts allowed, all targeting different emails so the
    // per-identifier counter never fires; the IP counter is the gate.
    for (let i = 0; i < 10; i++) {
      const res = await POST(
        loginRequest(
          { identifier: `user${i}@example.com`, password: PW },
          { 'x-forwarded-for': ip },
        ),
      );
      // Any non-429 status is fine — the upstream backend reject (502 /
      // 401) doesn't matter, only that we got past the rate-limit gate.
      expect(res.status).not.toBe(429);
    }
    const eleventh = await POST(
      loginRequest({ identifier: 'user10@example.com', password: PW }, { 'x-forwarded-for': ip }),
    );
    expect(eleventh.status).toBe(429);
    expect(eleventh.headers.get('retry-after')).toMatch(/^\d+$/);
    const body = (await eleventh.json()) as { code: string };
    expect(body.code).toBe('rate_limited');
  });

  it('per-identifier cap: the 6th attempt against one email returns 429 even across IPs', async () => {
    const target = 'victim@example.com';
    for (let i = 0; i < 5; i++) {
      const res = await POST(
        loginRequest(
          { identifier: target, password: PW },
          { 'x-forwarded-for': `198.51.100.${i + 1}` },
        ),
      );
      expect(res.status).not.toBe(429);
    }
    const sixth = await POST(
      loginRequest({ identifier: target, password: PW }, { 'x-forwarded-for': '198.51.100.99' }),
    );
    expect(sixth.status).toBe(429);
  });

  it('case-insensitive identifier bucket: Alice@ and alice@ share the counter', async () => {
    // 5 attempts as 'Victim@example.com', sixth as 'victim@example.com'
    // — same bucket because we lowercase before keying.
    for (let i = 0; i < 5; i++) {
      const res = await POST(
        loginRequest(
          { identifier: 'Victim@example.com', password: PW },
          { 'x-forwarded-for': `198.51.100.${i + 1}` },
        ),
      );
      expect(res.status).not.toBe(429);
    }
    const sixth = await POST(
      loginRequest(
        { identifier: 'victim@example.com', password: PW },
        { 'x-forwarded-for': '198.51.100.99' },
      ),
    );
    expect(sixth.status).toBe(429);
  });

  it('429 body is identifier-agnostic (no email-exists oracle)', async () => {
    const ip = '203.0.113.42';
    // Trip the per-IP cap first.
    for (let i = 0; i < 10; i++) {
      await POST(
        loginRequest({ identifier: `u${i}@example.com`, password: PW }, { 'x-forwarded-for': ip }),
      );
    }
    const res = await POST(
      loginRequest({ identifier: 'anyone@example.com', password: PW }, { 'x-forwarded-for': ip }),
    );
    const text = await res.text();
    expect(text).not.toContain('anyone@example.com');
    expect(text).not.toMatch(/exist|unknown|found/i);
  });
});

/**
 * SEC-EZ-002 — demo-auth fallback must be HARD-disabled in production.
 *
 * The catch-block demo fallback mints an `eazepay_demo` cookie that
 * grants an operator/admin workspace WITHOUT real backend auth. In
 * vitest the upstream fetch to the backend is unreachable, so every
 * request lands in the catch block — exactly the branch the demo
 * fallback lives in. We exercise that branch under two NODE_ENV shapes
 * to prove the production hard-guard dominates the `DEMO_MODE_ENABLED`
 * flag.
 *
 * A "demo session" is observable two ways and we assert BOTH:
 *   1. response body has `demoMode: true` and a `preset`, and
 *   2. an `eazepay_demo` Set-Cookie is written.
 * The rejected (prod) path returns the honest 502 `backend_unreachable`
 * with neither marker.
 */
describe('POST /api/auth/login (SEC-EZ-002 demo-auth prod hard-disable)', () => {
  const SEED_EMAIL = 'admin@eazepay.local';
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoFlag = process.env.DEMO_MODE_ENABLED;

  beforeEach(() => {
    __resetEdgeRateLimitForTests();
  });

  afterEach(() => {
    // Restore env so neighbouring specs see a clean slate.
    if (originalNodeEnv === undefined) delete (process.env as Record<string, string>).NODE_ENV;
    else (process.env as Record<string, string>).NODE_ENV = originalNodeEnv;
    if (originalDemoFlag === undefined) delete process.env.DEMO_MODE_ENABLED;
    else process.env.DEMO_MODE_ENABLED = originalDemoFlag;
  });

  async function attemptDemoLogin(email = SEED_EMAIL) {
    // Unique IP per call so the per-IP cap never confounds the assertion.
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    return POST(loginRequest({ identifier: email, password: PW }, { 'x-forwarded-for': ip }));
  }

  it('prod + DEMO_MODE_ENABLED=true → demo login REJECTED (no demo cookie, no demoMode)', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'production';
    process.env.DEMO_MODE_ENABLED = 'true'; // leaked flag — must NOT re-open demo

    const res = await attemptDemoLogin();

    // Hard-guard wins: the seed email does NOT mint a demo session.
    expect(res.status).toBe(502);
    const body = (await res.clone().json()) as { code?: string; demoMode?: boolean };
    expect(body.demoMode).toBeUndefined();
    expect(body.code).toBe('backend_unreachable');
    // No demo cookie was set on the response.
    expect(res.headers.get('set-cookie') ?? '').not.toContain('eazepay_demo');
  });

  it('prod + DEMO_MODE_ENABLED=true → master seed email also REJECTED', async () => {
    // Defence-in-depth: the highest-privilege seed email must not slip
    // through either, regardless of DEMO_MASTER_ENABLED, because the
    // demo branch is never entered in prod.
    (process.env as Record<string, string>).NODE_ENV = 'production';
    process.env.DEMO_MODE_ENABLED = 'true';
    process.env.DEMO_MASTER_ENABLED = 'true';

    const res = await attemptDemoLogin('master@eazepay.local');

    expect(res.status).toBe(502);
    const body = (await res.clone().json()) as { code?: string; demoMode?: boolean };
    expect(body.demoMode).toBeUndefined();
    expect(res.headers.get('set-cookie') ?? '').not.toContain('eazepay_demo');

    delete process.env.DEMO_MASTER_ENABLED;
  });

  it('dev + DEMO_MODE_ENABLED=true → demo login STILL WORKS (mints demo cookie)', async () => {
    (process.env as Record<string, string>).NODE_ENV = 'development';
    process.env.DEMO_MODE_ENABLED = 'true';

    const res = await attemptDemoLogin();

    expect(res.status).toBe(200);
    const body = (await res.clone().json()) as { demoMode?: boolean; preset?: string };
    expect(body.demoMode).toBe(true);
    expect(body.preset).toBe('admin');
    expect(res.headers.get('set-cookie') ?? '').toContain('eazepay_demo');
  });

  it('dev with DEMO_MODE_ENABLED unset → demo login still works (default-on in dev)', async () => {
    // Mirrors middleware.ts / demo/route.ts posture: dev demo is gated
    // by `!== "false"`, so an unset flag keeps local previews browsable.
    (process.env as Record<string, string>).NODE_ENV = 'development';
    delete process.env.DEMO_MODE_ENABLED;

    const res = await attemptDemoLogin();

    expect(res.status).toBe(200);
    const body = (await res.clone().json()) as { demoMode?: boolean };
    expect(body.demoMode).toBe(true);
  });

  it('dev + DEMO_MODE_ENABLED=false → demo login disabled even in dev', async () => {
    // Explicit operator opt-out closes the surface in dev too.
    (process.env as Record<string, string>).NODE_ENV = 'development';
    process.env.DEMO_MODE_ENABLED = 'false';

    const res = await attemptDemoLogin();

    expect(res.status).toBe(502);
    const body = (await res.clone().json()) as { demoMode?: boolean };
    expect(body.demoMode).toBeUndefined();
  });
});

/**
 * SEC-EZ-005 — the per-IP brute-force cap must key on the hardened
 * `resolveClientIp()` parse, not the raw leftmost `X-Forwarded-For`.
 *
 * Attack chain (before fix): the cap keyed on `xff.split(',')[0]` — the
 * leftmost, attacker-controlled XFF entry. An attacker rotating that
 * prefix (`X-Forwarded-For: <random>, <real-proxy-ip>`) landed in a
 * fresh bucket on every request and galloped past the 10/min cap on the
 * single highest-value endpoint in the app.
 *
 * `resolveClientIp` trusts the RIGHTMOST (proxy-written) hop, so with a
 * fixed trailing proxy IP the bucket key is stable even as the attacker
 * rotates the spoofable leftmost entry. We send 11 requests whose ONLY
 * difference is the leftmost XFF entry; the 11th must 429.
 */
describe('POST /api/auth/login (SEC-EZ-005 XFF-spoof rate-limit)', () => {
  beforeEach(() => {
    __resetEdgeRateLimitForTests();
  });

  it('rotating the leftmost XFF entry cannot rotate past the per-IP cap', async () => {
    // Fixed trailing hop = the address our proxy actually saw. With
    // TRUSTED_PROXY_HOPS defaulting to 1, resolveClientIp returns this
    // rightmost entry regardless of the spoofed prefix.
    const realProxyIp = '198.51.100.77';

    for (let i = 0; i < 10; i++) {
      // Each request spoofs a DIFFERENT leftmost entry — the pre-fix
      // code would have bucketed each into its own counter.
      const spoofed = `10.0.0.${i}, ${realProxyIp}`;
      const res = await POST(
        loginRequest(
          { identifier: `user${i}@example.com`, password: PW },
          { 'x-forwarded-for': spoofed },
        ),
      );
      expect(res.status).not.toBe(429);
    }

    // 11th attempt, yet another spoofed leftmost — still the same real
    // hop, so it must trip the cap.
    const eleventh = await POST(
      loginRequest(
        { identifier: 'user10@example.com', password: PW },
        { 'x-forwarded-for': `10.0.0.250, ${realProxyIp}` },
      ),
    );
    expect(eleventh.status).toBe(429);

    // The counter accrued under the RESOLVED ip bucket, not any spoofed
    // leftmost value — proves the key derives from resolveClientIp.
    expect(peekEdgeRateLimit(`auth-login-ip:${realProxyIp}`)).not.toBeNull();
    expect(peekEdgeRateLimit('auth-login-ip:10.0.0.0')).toBeNull();
  });

  it('a stable real hop with X-Real-IP fallback is bucketed consistently', async () => {
    // When XFF is stripped (some Railway ingress paths), resolveClientIp
    // falls back to X-Real-IP. The cap must hold on that key too.
    const realIp = '203.0.113.200';
    for (let i = 0; i < 10; i++) {
      const res = await POST(
        loginRequest({ identifier: `r${i}@example.com`, password: PW }, { 'x-real-ip': realIp }),
      );
      expect(res.status).not.toBe(429);
    }
    const eleventh = await POST(
      loginRequest({ identifier: 'r10@example.com', password: PW }, { 'x-real-ip': realIp }),
    );
    expect(eleventh.status).toBe(429);
    expect(peekEdgeRateLimit(`auth-login-ip:${realIp}`)).not.toBeNull();
  });
});
