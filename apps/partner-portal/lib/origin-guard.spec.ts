import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { enforceOrigin, _resetAllowedOriginsCache } from './origin-guard';

/**
 * SEC-010 — origin-guard specs.
 *
 * Coverage:
 *   1. Production: allowlist exact-match enforced; mismatch → 403.
 *   2. Production: missing both Origin + Referer → 403.
 *   3. Production: trailing-slash, case differences normalise correctly.
 *   4. Production: Referer falls back when Origin is absent.
 *   5. Non-production: localhost / 127.0.0.1 always pass.
 *   6. Non-production: ALLOWED_ORIGINS still honoured when set.
 *   7. Webhook routes are NOT wrapped — that's a deployment contract,
 *      not a guard behaviour, but we cover the "missing both headers"
 *      branch explicitly so a future regression isn't silent.
 */

function reqWith(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://app.eazepay.com/api/integrations/highsale/subaccount', {
    method: 'POST',
    headers,
  });
}

describe('lib/origin-guard — enforceOrigin', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetAllowedOriginsCache();
    delete process.env.ALLOWED_ORIGINS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    _resetAllowedOriginsCache();
  });

  describe('production mode', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
    });

    it('passes when Origin exactly matches the allowlist', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com';
      _resetAllowedOriginsCache();
      const res = enforceOrigin(reqWith({ origin: 'https://app.eazepay.com' }));
      expect(res).toBeNull();
    });

    it('rejects a cross-origin POST with 403 forbidden_origin', async () => {
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com';
      _resetAllowedOriginsCache();
      const res = enforceOrigin(reqWith({ origin: 'https://evil.example.com' }));
      expect(res).toBeInstanceOf(NextResponse);
      if (res instanceof NextResponse) {
        expect(res.status).toBe(403);
        const body = (await res.json()) as { code: string };
        expect(body.code).toBe('forbidden_origin');
      }
    });

    it('rejects when both Origin and Referer are missing (prod-only)', async () => {
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com';
      _resetAllowedOriginsCache();
      const res = enforceOrigin(reqWith({}));
      expect(res).toBeInstanceOf(NextResponse);
      if (res instanceof NextResponse) expect(res.status).toBe(403);
    });

    it('falls back to Referer when Origin is missing', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com';
      _resetAllowedOriginsCache();
      const res = enforceOrigin(
        reqWith({ referer: 'https://app.eazepay.com/admin/observability' }),
      );
      expect(res).toBeNull();
    });

    it('rejects when Referer matches but Origin is on a different host', async () => {
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com';
      _resetAllowedOriginsCache();
      const res = enforceOrigin(
        reqWith({
          origin: 'https://evil.example.com',
          referer: 'https://app.eazepay.com/admin',
        }),
      );
      // Origin is the primary signal; only the FIRST candidate is
      // normalised+matched. Refusing rather than treating Referer as a
      // safety net stops an attacker forging a benign Referer.
      expect(res).toBeInstanceOf(NextResponse);
      if (res instanceof NextResponse) expect(res.status).toBe(403);
    });

    it('normalises trailing slash on allowlist entries', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com/';
      _resetAllowedOriginsCache();
      const res = enforceOrigin(reqWith({ origin: 'https://app.eazepay.com' }));
      expect(res).toBeNull();
    });

    it('normalises case differences (lower-cases the host)', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com';
      _resetAllowedOriginsCache();
      const res = enforceOrigin(reqWith({ origin: 'https://APP.EazePay.com' }));
      expect(res).toBeNull();
    });

    it('treats the literal string "null" Origin as missing', async () => {
      // Sandboxed iframes / file:// pages send `Origin: null`.
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com';
      _resetAllowedOriginsCache();
      const res = enforceOrigin(reqWith({ origin: 'null' }));
      expect(res).toBeInstanceOf(NextResponse);
      if (res instanceof NextResponse) expect(res.status).toBe(403);
    });

    it('supports a CSV allowlist of multiple origins', () => {
      process.env.ALLOWED_ORIGINS =
        'https://app.eazepay.com,https://admin.eazepay.com, https://demo.eazepay.com';
      _resetAllowedOriginsCache();
      expect(enforceOrigin(reqWith({ origin: 'https://app.eazepay.com' }))).toBeNull();
      expect(enforceOrigin(reqWith({ origin: 'https://admin.eazepay.com' }))).toBeNull();
      expect(enforceOrigin(reqWith({ origin: 'https://demo.eazepay.com' }))).toBeNull();
      const stranger = enforceOrigin(reqWith({ origin: 'https://stranger.eazepay.com' }));
      expect(stranger).toBeInstanceOf(NextResponse);
    });

    it('rejects localhost in production unless explicitly allowlisted', async () => {
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com';
      _resetAllowedOriginsCache();
      const res = enforceOrigin(reqWith({ origin: 'http://localhost:3004' }));
      expect(res).toBeInstanceOf(NextResponse);
      if (res instanceof NextResponse) expect(res.status).toBe(403);
    });
  });

  describe('non-production (dev) mode', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
    });

    it('passes localhost on any port without configuration', () => {
      expect(enforceOrigin(reqWith({ origin: 'http://localhost:3004' }))).toBeNull();
      expect(enforceOrigin(reqWith({ origin: 'http://localhost:8080' }))).toBeNull();
      expect(enforceOrigin(reqWith({ origin: 'https://localhost:3004' }))).toBeNull();
    });

    it('passes 127.0.0.1 on any port without configuration', () => {
      expect(enforceOrigin(reqWith({ origin: 'http://127.0.0.1:3000' }))).toBeNull();
      expect(enforceOrigin(reqWith({ origin: 'http://127.0.0.1' }))).toBeNull();
    });

    it('still rejects cross-origin POSTs in dev', async () => {
      const res = enforceOrigin(reqWith({ origin: 'https://evil.example.com' }));
      expect(res).toBeInstanceOf(NextResponse);
      if (res instanceof NextResponse) expect(res.status).toBe(403);
    });

    it('honours ALLOWED_ORIGINS when set in dev', () => {
      process.env.ALLOWED_ORIGINS = 'https://staging.eazepay.com';
      _resetAllowedOriginsCache();
      expect(enforceOrigin(reqWith({ origin: 'https://staging.eazepay.com' }))).toBeNull();
      // localhost still passes via the dev allowance
      expect(enforceOrigin(reqWith({ origin: 'http://localhost:3004' }))).toBeNull();
    });

    it('falls back to Referer in dev', () => {
      expect(
        enforceOrigin(reqWith({ referer: 'http://localhost:3004/admin/observability' })),
      ).toBeNull();
    });

    it('handles malformed Origin without throwing', () => {
      // `enforceOrigin` must never throw — a malformed header just
      // means we treat it as absent and fall through.
      expect(() => enforceOrigin(reqWith({ origin: 'not a url' }))).not.toThrow();
      // In dev mode, treating-as-absent => null (pass). Cover the
      // not-throwing invariant separately so the assertion is honest.
    });

    it('accepts a request with no Origin / Referer in dev (test convenience)', () => {
      const res = enforceOrigin(reqWith({}));
      expect(res).toBeNull();
    });
  });

  describe('response shape', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://app.eazepay.com';
      _resetAllowedOriginsCache();
    });

    it('returns RFC 7807 problem-details with code forbidden_origin', async () => {
      const res = enforceOrigin(reqWith({ origin: 'https://evil.example.com' }));
      if (!(res instanceof NextResponse)) throw new Error('expected NextResponse');
      expect(res.status).toBe(403);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Forbidden');
      expect(body.code).toBe('forbidden_origin');
      expect(body.status).toBe(403);
      // detail is a non-empty operator-readable string
      expect(typeof body.detail).toBe('string');
      expect((body.detail as string).length).toBeGreaterThan(0);
    });
  });
});
