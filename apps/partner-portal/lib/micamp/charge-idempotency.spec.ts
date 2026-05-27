import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * MiCamp `charge()` MUST send `Idempotency-Key` to the upstream API.
 * A partner retry on a 5xx without this header would double-charge the
 * consumer.
 *
 * Live mode is gated on MICAMP_API_URL + MICAMP_API_KEY so we set both,
 * stub global fetch, and assert the header lands on the outbound
 * request. The synthetic / non-live branch does not call out so this
 * test pins the only path where the header matters.
 */

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.MICAMP_API_URL = 'https://micamp.test';
  process.env.MICAMP_API_KEY = 'k_test_only';
  process.env.MICAMP_WEBHOOK_SECRET = 'unit-test-secret-padding-padding-pad';
  (process.env as Record<string, string>).NODE_ENV = 'test';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('lib/micamp/client — charge() idempotency header', () => {
  it('forwards the supplied Idempotency-Key as a request header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        transactionId: 'tx_test',
        status: 'captured',
        declineReason: null,
        feeBreakdown: {
          interchangeCents: 0,
          processorCents: 0,
          perTransactionCents: 0,
          netCents: 0,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.resetModules();
    const { charge } = await import('./client');

    await charge({
      midId: 'mid_x',
      amountCents: 12345,
      currency: 'USD',
      consumerToken: 'ct_x',
      applicationId: '11111111-1111-4111-8111-111111111111',
      idempotencyKey: 'idem_unit_test_key',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // noUncheckedIndexedAccess: assertion above guarantees calls[0] exists.
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers['Idempotency-Key']).toBe('idem_unit_test_key');
  });

  it('deriveChargeIdempotencyKey is deterministic on (applicationId, amountCents)', async () => {
    vi.resetModules();
    const { deriveChargeIdempotencyKey } = await import('./client');
    const a = deriveChargeIdempotencyKey({
      applicationId: '11111111-1111-4111-8111-111111111111',
      amountCents: 9900,
    });
    const b = deriveChargeIdempotencyKey({
      applicationId: '11111111-1111-4111-8111-111111111111',
      amountCents: 9900,
    });
    const c = deriveChargeIdempotencyKey({
      applicationId: '11111111-1111-4111-8111-111111111111',
      amountCents: 10000,
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(32);
  });
});
