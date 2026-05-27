import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * HTTP-bridge specs for the outbox-drain handler registry (W1.2).
 *
 * Scope: verifies that the `notification.send` and `webhook.outbound`
 * handlers in the production HANDLERS map POST to apps/api's
 * `/v1/_internal/outbox/dispatch` with the right headers, body shape,
 * and result translation.
 *
 * Out of scope (covered in `lib/outbox.spec.ts`):
 *   - Drain row claim / retry / dead lifecycle on its own.
 *   - enqueueOutbox (Drizzle side).
 *
 * Out of scope (covered in `libs/integrations-core/.../outbox-prisma.spec.ts`):
 *   - The Prisma-side enqueue helper.
 *
 * Posture: hermetic. The DB is mocked with the same chainable
 * approach as lib/outbox.spec.ts, fetch is replaced with a vi.fn,
 * and the production handler is driven via processOutboxBatch so we
 * exercise the REAL registry wiring rather than recreating it.
 */

interface DbRow {
  id: string;
  kind: string;
  payloadJson: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed' | 'dead';
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date;
  sentAt: Date | null;
}

const rows = new Map<string, DbRow>();
const hasDbMock = vi.fn(() => true);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbMock: any = {
  select: () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async (n: number) =>
            Array.from(rows.values())
              .filter((r) => r.status === 'pending' && r.nextAttemptAt <= new Date())
              .slice(0, n)
              .map((r) => ({
                id: r.id,
                kind: r.kind,
                payloadJson: r.payloadJson,
                attempts: r.attempts,
              })),
        }),
      }),
      groupBy: async () => [],
    }),
  }),
  update: () => ({
    set: (patch: Partial<DbRow>) => {
      // The drain runs two update shapes: claim (`{nextAttemptAt}` only)
      // and mark-* (status / attempts / lastError / sentAt). Same
      // heuristic as lib/outbox.spec.ts.
      const isClaim = Object.keys(patch).length === 1 && 'nextAttemptAt' in patch;
      return {
        where: () => {
          const applied: string[] = [];
          const now = new Date();
          for (const row of rows.values()) {
            if (isClaim) {
              if (row.status !== 'pending' || row.nextAttemptAt > now) continue;
            }
            Object.assign(row, patch);
            applied.push(row.id);
            if (isClaim) break;
          }
          return {
            returning: async () => applied.map((id) => ({ id })),
            then: (resolve: (v: unknown) => unknown) => resolve(undefined),
          };
        },
      };
    },
  }),
};

// Note: the type parameter to `vi.importActual` is the module shape;
// importing it as a type-only alias avoids the `typeof import(...)`
// inline annotation the @typescript-eslint/consistent-type-imports
// rule rejects.
import type * as DbModule from '../db';

vi.mock('../db', async () => {
  const real = await vi.importActual<typeof DbModule>('../db');
  return {
    ...real,
    hasDb: () => hasDbMock(),
    getDb: () => dbMock,
  };
});

vi.mock('../safe-log', () => ({
  safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;
const originalEnv: Record<string, string | undefined> = {
  INTERNAL_API_URL: process.env['INTERNAL_API_URL'],
  INTERNAL_OUTBOX_DISPATCH_SECRET: process.env['INTERNAL_OUTBOX_DISPATCH_SECRET'],
};

beforeEach(() => {
  rows.clear();
  hasDbMock.mockReturnValue(true);
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env['INTERNAL_API_URL'] = 'http://api.test.local:3000';
  process.env['INTERNAL_OUTBOX_DISPATCH_SECRET'] = 'x'.repeat(64);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

import { processOutboxBatch } from './outbox-drain';

describe('outbox-drain handler registry — notification.send', () => {
  it('POSTs to /v1/_internal/outbox/dispatch with the shared secret on a pending row', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    rows.set('o_n1', {
      id: 'o_n1',
      kind: 'notification.send',
      payloadJson: {
        kind: 'notification.send',
        userId: 'u_x',
        templateKey: 'payment.repayment.failed',
        payload: { amountCents: '12500', reasonCode: 'NSF' },
        subjectType: 'Repayment',
        subjectId: 'r_abc',
      },
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(0),
      sentAt: null,
    });

    const res = await processOutboxBatch();

    expect(res.sent).toBe(1);
    expect(res.retried).toBe(0);
    expect(res.dead).toBe(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test.local:3000/v1/_internal/outbox/dispatch');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['x-eazepay-internal-secret']).toBe('x'.repeat(64));
    const parsed = JSON.parse(init.body as string) as {
      kind: string;
      payload: Record<string, unknown>;
    };
    expect(parsed.kind).toBe('notification.send');
    expect(parsed.payload).toEqual({
      kind: 'notification.send',
      userId: 'u_x',
      templateKey: 'payment.repayment.failed',
      payload: { amountCents: '12500', reasonCode: 'NSF' },
      subjectType: 'Repayment',
      subjectId: 'r_abc',
    });

    const row = rows.get('o_n1');
    expect(row?.status).toBe('sent');
  });

  it('retries (status=pending, attempts++) when the bridge returns 5xx', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'transient' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );
    rows.set('o_n2', {
      id: 'o_n2',
      kind: 'notification.send',
      payloadJson: { kind: 'notification.send' },
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(0),
      sentAt: null,
    });

    const res = await processOutboxBatch();
    expect(res.retried).toBe(1);
    expect(res.sent).toBe(0);
    const row = rows.get('o_n2');
    expect(row?.status).toBe('pending');
    expect(row?.attempts).toBe(1);
    expect(row?.lastError).toMatch(/outbox\.bridge\.http_503/);
  });

  it('retries with structured error when the bridge returns 401 (bad secret)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'invalid_internal_secret' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );
    rows.set('o_n3', {
      id: 'o_n3',
      kind: 'notification.send',
      payloadJson: { kind: 'notification.send' },
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(0),
      sentAt: null,
    });

    const res = await processOutboxBatch();
    expect(res.retried).toBe(1);
    const row = rows.get('o_n3');
    expect(row?.status).toBe('pending');
    expect(row?.lastError).toBe('internal_bridge_401:invalid_internal_secret');
  });

  it('retries on network failure (e.g. apps/api unreachable)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    rows.set('o_n4', {
      id: 'o_n4',
      kind: 'notification.send',
      payloadJson: { kind: 'notification.send' },
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(0),
      sentAt: null,
    });

    const res = await processOutboxBatch();
    expect(res.retried).toBe(1);
    const row = rows.get('o_n4');
    expect(row?.status).toBe('pending');
    expect(row?.lastError).toMatch(/outbox\.bridge\.network:connect ECONNREFUSED/);
  });

  it('short-circuits with internal_bridge_unconfigured when env vars are missing', async () => {
    delete process.env['INTERNAL_API_URL'];
    delete process.env['INTERNAL_OUTBOX_DISPATCH_SECRET'];
    rows.set('o_n5', {
      id: 'o_n5',
      kind: 'notification.send',
      payloadJson: { kind: 'notification.send' },
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(0),
      sentAt: null,
    });

    const res = await processOutboxBatch();
    expect(res.retried).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(rows.get('o_n5')?.lastError).toBe('internal_bridge_unconfigured');
  });
});

describe('outbox-drain handler registry — webhook.outbound', () => {
  it('POSTs the webhook payload through the same bridge path', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const merchantId = '11111111-2222-3333-4444-555555555555';
    rows.set('o_w1', {
      id: 'o_w1',
      kind: 'webhook.outbound',
      payloadJson: {
        kind: 'webhook.outbound',
        eventType: 'loan.repayment.failed',
        eventId: 'loan.repayment.failed:r_abc:prov_ref_1',
        subjectType: 'Repayment',
        subjectId: 'r_abc',
        merchantId,
        payload: {
          loanId: 'loan_42',
          repaymentId: 'r_abc',
          amountCents: '12500',
          reasonCode: 'NSF',
        },
      },
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(0),
      sentAt: null,
    });

    const res = await processOutboxBatch();
    expect(res.sent).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = JSON.parse(init.body as string) as {
      kind: string;
      payload: Record<string, unknown>;
    };
    expect(parsed.kind).toBe('webhook.outbound');
    expect(parsed.payload.eventType).toBe('loan.repayment.failed');
    expect(parsed.payload.merchantId).toBe(merchantId);
    expect(rows.get('o_w1')?.status).toBe('sent');
  });

  it('propagates a structured bridge_failed error when ok:false comes back', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'invalid_webhook_payload:eventId' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    rows.set('o_w2', {
      id: 'o_w2',
      kind: 'webhook.outbound',
      payloadJson: { kind: 'webhook.outbound' },
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(0),
      sentAt: null,
    });

    const res = await processOutboxBatch();
    expect(res.retried).toBe(1);
    expect(rows.get('o_w2')?.lastError).toBe('invalid_webhook_payload:eventId');
  });
});
