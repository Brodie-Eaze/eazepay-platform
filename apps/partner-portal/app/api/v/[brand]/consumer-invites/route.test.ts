import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

/**
 * Smoke test for the partner-scoped consumer invite endpoint.
 *
 * Covers the happy path: POST mints a consumer invite for a given
 * brand. The brand path segment is injected via the second-arg
 * params Promise (App Router convention).
 */
describe('/api/v/[brand]/consumer-invites', () => {
  it('POST mints a consumer invite for the given brand', async () => {
    const req = new NextRequest(
      'http://localhost/api/v/medpay/consumer-invites',
      {
        method: 'POST',
        body: JSON.stringify({
          partnerId: 'p_helio',
          salespersonEmail: 'rep@helio.example',
          consumer: { firstName: 'Casey', lastName: 'Lin' },
          loanAmountCents: 2500_00,
          purpose: 'Veneers',
          expiryHours: 168,
        }),
        headers: { 'content-type': 'application/json' },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ brand: 'medpay' }) });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      token: string;
      brand: string;
      inviteUrl: string;
      partnerId: string;
    };
    expect(body.brand).toBe('medpay');
    expect(body.partnerId).toBe('p_helio');
    expect(body.token).toMatch(/[0-9a-f-]{36}/);
  });
});
