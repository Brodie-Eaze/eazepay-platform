import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { __resetEdgeRateLimitForTests } from '../../../../lib/edge-rate-limit';

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
      loginRequest(
        { identifier: 'user10@example.com', password: PW },
        { 'x-forwarded-for': ip },
      ),
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
      loginRequest(
        { identifier: target, password: PW },
        { 'x-forwarded-for': '198.51.100.99' },
      ),
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
        loginRequest(
          { identifier: `u${i}@example.com`, password: PW },
          { 'x-forwarded-for': ip },
        ),
      );
    }
    const res = await POST(
      loginRequest(
        { identifier: 'anyone@example.com', password: PW },
        { 'x-forwarded-for': ip },
      ),
    );
    const text = await res.text();
    expect(text).not.toContain('anyone@example.com');
    expect(text).not.toMatch(/exist|unknown|found/i);
  });
});
