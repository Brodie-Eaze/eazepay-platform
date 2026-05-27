import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';

import { enqueueOutboxPrisma } from './outbox-prisma.js';

/**
 * Build a minimal stub `Prisma.TransactionClient` that records the
 * `outboxEvent.create` call and returns a deterministic id. We don't
 * spin up a real Prisma client here — the helper's contract is
 * "forward this shape to `tx.outboxEvent.create`", and unit-level
 * mocking is the right granularity. The integration-style spec at
 * the bottom asserts cross-ORM visibility against the real schema.
 */
function makeTx(returnedId = '11111111-1111-1111-1111-111111111111') {
  const create = vi.fn().mockResolvedValue({ id: returnedId });
  const tx = { outboxEvent: { create } } as unknown as Prisma.TransactionClient;
  return { tx, create };
}

describe('enqueueOutboxPrisma', () => {
  it('inserts via tx.outboxEvent.create with kind + payload, returns id', async () => {
    const { tx, create } = makeTx();

    const result = await enqueueOutboxPrisma(tx, {
      kind: 'notification.send',
      payload: { templateKey: 'welcome', recipient: 'user@example.com' },
    });

    expect(result).toEqual({ id: '11111111-1111-1111-1111-111111111111' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        kind: 'notification.send',
        payloadJson: { templateKey: 'welcome', recipient: 'user@example.com' },
      },
      select: { id: true },
    });
  });

  it('accepts each OutboxKind in the closed union', async () => {
    const { tx, create } = makeTx();

    await enqueueOutboxPrisma(tx, { kind: 'notification.send', payload: {} });
    await enqueueOutboxPrisma(tx, { kind: 'webhook.outbound', payload: {} });
    await enqueueOutboxPrisma(tx, { kind: 'audit.log', payload: {} });

    expect(create).toHaveBeenCalledTimes(3);
    const kinds = create.mock.calls.map((c) => c[0].data.kind);
    expect(kinds).toEqual(['notification.send', 'webhook.outbound', 'audit.log']);
  });

  it('propagates Prisma errors instead of swallowing them', async () => {
    const create = vi.fn().mockRejectedValue(new Error('P2002: unique constraint'));
    const tx = { outboxEvent: { create } } as unknown as Prisma.TransactionClient;

    await expect(
      enqueueOutboxPrisma(tx, {
        kind: 'audit.log',
        payload: { actor: 'tok_abc', action: 'login' },
      }),
    ).rejects.toThrow('P2002');
  });

  it('passes nested-object payloads through verbatim as jsonb input', async () => {
    const { tx, create } = makeTx();
    const payload = {
      eventId: 'evt_42',
      endpoint: { url: 'https://partner.example/webhook', version: 'v1' },
      attemptHints: { maxAttempts: 8 },
    };

    await enqueueOutboxPrisma(tx, { kind: 'webhook.outbound', payload });

    // Verbatim — the helper must not mutate / re-shape payloads. The
    // drain worker owns parsing and any per-kind validation.
    expect(create.mock.calls[0]?.[0].data.payloadJson).toBe(payload);
  });
});

/**
 * Integration-style assertion (no DB roundtrip — runs in unit mode).
 *
 * The "cross-ORM" contract we promise: a row inserted via the Prisma
 * helper has the exact column-shape the Drizzle drain worker expects
 * to SELECT. Specifically the drain query reads:
 *   id, kind, payload_json, attempts, status, next_attempt_at.
 *
 * The helper itself only writes `kind` + `payload_json`; the rest
 * default at the DB layer (id = gen_random_uuid, status = 'pending',
 * attempts = 0, next_attempt_at = now()). The drain worker filter
 * `status='pending' AND next_attempt_at <= now()` therefore picks
 * the row up on its next tick.
 *
 * This spec pins the property the drain depends on: the Prisma
 * helper writes EXACTLY those two columns and lets the database
 * defaults handle the rest. If a future change starts setting
 * `status` or `next_attempt_at` from the Prisma side, this spec
 * fails and forces a coordinated review with the drain worker.
 */
describe('enqueueOutboxPrisma — cross-ORM drain compatibility', () => {
  it('only writes kind + payloadJson, letting DB defaults fill drain-relevant columns', async () => {
    const { tx, create } = makeTx();

    await enqueueOutboxPrisma(tx, {
      kind: 'notification.send',
      payload: { templateKey: 'invoice_issued' },
    });

    const data = create.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(['kind', 'payloadJson']);
    // Explicit negative assertions — drain-critical columns are NEVER
    // set by the enqueue helper. The Drizzle drain worker assumes
    // defaults; co-owning those columns from both sides invites drift.
    expect(data.status).toBeUndefined();
    expect(data.attempts).toBeUndefined();
    expect(data.nextAttemptAt).toBeUndefined();
    expect(data.sentAt).toBeUndefined();
    expect(data.lastError).toBeUndefined();
  });
});
