import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { __resetEdgeRateLimitForTests } from '../../../../lib/edge-rate-limit';

/**
 * SEC-202 — public application-create surface hardening.
 *
 * The verifier stub fails closed (lib/partner-api-key.ts) so every
 * authenticated path here returns 401 — the surface is sealed until
 * the real key-issuance flow lands. The relevant adversarial coverage
 * is: anonymous reject, malformed Authorization, rate-limit fires,
 * PII never appears in the response.
 */

const VALID_BODY = {
  brand: 'tradepay',
  channel: { type: 'merchant', merchant_ref: 'mer_001' },
  applicant: {
    first_name: 'Avery',
    last_name: 'Lee',
    email: 'avery@example.com',
    phone: '5125551234',
    state: 'TX',
  },
  request: {
    amount_cents: 1_850_000,
    term_months: 60,
    purpose: 'home_improvement',
  },
} as const;

function buildRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/v1/applications', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/applications (SEC-202)', () => {
  beforeEach(() => {
    __resetEdgeRateLimitForTests();
  });

  it('401 unauthorized when no Authorization header', async () => {
    const res = await POST(buildRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('unauthorized');
  });

  it('401 unauthorized for a non-Bearer scheme', async () => {
    const res = await POST(buildRequest(VALID_BODY, { authorization: 'Basic dXNlcjpwYXNz' }));
    expect(res.status).toBe(401);
  });

  it('401 unauthorized for any bearer token (verifier fails closed)', async () => {
    const res = await POST(
      buildRequest(VALID_BODY, {
        authorization: 'Bearer pk_test_anything',
        'idempotency-key': 'idem-1',
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('unauthorized');
  });

  it('response on auth-fail does NOT echo the request body (no PII leak)', async () => {
    const res = await POST(buildRequest(VALID_BODY, { authorization: 'Bearer pk_test_anything' }));
    const text = await res.text();
    // PII fields from the body MUST NOT appear anywhere in the response.
    expect(text).not.toContain('avery@example.com');
    expect(text).not.toContain('5125551234');
    expect(text).not.toContain('Avery');
  });

  it('auth check runs BEFORE body parse (malformed body still returns 401)', async () => {
    // Send invalid JSON — if auth ran after body parse we'd see a 422.
    const req = new NextRequest('http://localhost/api/v1/applications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
