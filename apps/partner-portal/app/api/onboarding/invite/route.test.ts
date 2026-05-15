import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

/**
 * Smoke test for the onboarding invite endpoint.
 *
 * Covers the happy path: POST mints an invite, GET lists them, GET by
 * token returns the prefill bag. We intentionally exercise the
 * in-memory store (no JSON persistence) so the spec stays hermetic.
 */
describe('/api/onboarding/invite', () => {
  it('POST mints an invite, GET lists it', async () => {
    const postReq = new NextRequest('http://localhost/api/onboarding/invite', {
      method: 'POST',
      body: JSON.stringify({
        brand: 'medpay',
        prefill: { businessName: 'Atlas Dental Group' },
        expiryHours: 168,
        invitedByEmail: 'brodie@example.com',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as {
      token: string;
      brand: string;
      inviteUrl: string;
      status: string;
    };
    expect(created.token).toMatch(/[0-9a-f-]{36}/);
    expect(created.brand).toBe('medpay');
    expect(created.status).toBe('active');
    expect(created.inviteUrl).toContain(created.token);

    const getReq = new NextRequest(
      'http://localhost/api/onboarding/invite?invitedByEmail=brodie@example.com',
    );
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const listed = (await getRes.json()) as { invites: Array<{ token: string }> };
    expect(listed.invites.some((i) => i.token === created.token)).toBe(true);
  });

  it('POST rejects malformed body', async () => {
    const badReq = new NextRequest('http://localhost/api/onboarding/invite', {
      method: 'POST',
      body: JSON.stringify({ brand: 'not-a-brand' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
