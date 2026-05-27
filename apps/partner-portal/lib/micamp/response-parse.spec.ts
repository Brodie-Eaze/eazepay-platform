import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Integration response parse — Zod replaces the previous `as` cast on
 * every MiCamp client method that hits live HTTP. A malformed 200 body
 * must throw IntegrationErrorException({ kind: 'MalformedResponse' })
 * rather than silently corrupting downstream state.
 */

async function freshImport(): Promise<typeof import('./client')> {
  process.env.MICAMP_API_URL = 'https://example.test';
  process.env.MICAMP_API_KEY = 'test-key';
  process.env.MICAMP_WEBHOOK_SECRET = 'unit-test-secret-padding________________';
  (process.env as Record<string, string>).NODE_ENV = 'test';
  vi.resetModules();
  return await import('./client');
}

describe('MiCamp client — Zod parse of integration responses', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('provisionMid — mock-bad-response throws MalformedResponse with provider attribution', async () => {
    const badBody = { ok: true /* missing midId, rateCard, steps... */ };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(badBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const { provisionMid } = await freshImport();
    await expect(
      provisionMid({
        partnerId: 'p',
        legalName: 'L',
        dba: null,
        ein: '00-0000000',
        contactName: 'c',
        contactEmail: 'e@e.com',
        contactPhone: '+1',
        estimatedVolumeCents: 0,
        estimatedTicketCents: 0,
        mccCode: '0000',
        funnelUrls: [],
      }),
    ).rejects.toMatchObject({
      name: 'IntegrationErrorException',
      detail: {
        provider: 'micamp',
        endpoint: 'provisionMid',
        kind: 'MalformedResponse',
      },
    });
  });

  it('charge — mock-bad-response throws MalformedResponse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ status: 'magical' /* not in enum */ }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const { charge } = await freshImport();
    await expect(
      charge({
        midId: 'm',
        amountCents: 100,
        currency: 'USD',
        consumerToken: 't',
        applicationId: 'a',
        idempotencyKey: 'k',
      }),
    ).rejects.toMatchObject({
      detail: { provider: 'micamp', endpoint: 'charge', kind: 'MalformedResponse' },
    });
  });
});
