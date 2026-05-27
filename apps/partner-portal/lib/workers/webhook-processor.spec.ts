import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Hermetic specs for the webhook processor's pure helpers + the
 * processInboxRow contract (Task #50). The inbox dispatch path itself
 * needs a live Postgres for the full integration story — that's in
 * the e2e suite.
 */

const hasDbMock = vi.fn(() => false);
const rowsStore = new Map<string, Record<string, unknown>>();

const dbMock = {
  select: (cols: unknown) => ({
    from: () => ({
      where: () => ({
        limit: async () => {
          const arr = Array.from(rowsStore.values());
          void cols;
          return arr;
        },
      }),
    }),
  }),
  update: () => ({
    set: (patch: Record<string, unknown>) => {
      const apply = () => {
        for (const row of rowsStore.values()) Object.assign(row, patch);
      };
      const whereResult = {
        then: (resolve: (v: unknown) => unknown) => {
          apply();
          return resolve(undefined);
        },
        returning: async () => {
          apply();
          const row = Array.from(rowsStore.values())[0];
          return row ? [{ id: row.id }] : [];
        },
      };
      return {
        where: () => whereResult,
      };
    },
  }),
};

vi.mock('../db', async () => {
  const real = await vi.importActual<typeof import('../db')>('../db');
  return {
    ...real,
    hasDb: () => hasDbMock(),
    getDb: () => dbMock,
  };
});

vi.mock('../safe-log', () => ({
  safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { extractProviderEventId, processInboxRow } from './webhook-processor';

describe('extractProviderEventId', () => {
  it('returns null when neither id nor event_id is present', () => {
    expect(extractProviderEventId({})).toBeNull();
    expect(extractProviderEventId({ type: 'mid.underwriting.approved' })).toBeNull();
  });

  it('prefers `id` over `event_id` (MiCamp convention)', () => {
    expect(extractProviderEventId({ id: 'evt_micamp_abc', event_id: 'evt_other' })).toBe(
      'evt_micamp_abc',
    );
  });

  it('falls back to `event_id` when `id` is absent (HighSale convention)', () => {
    expect(extractProviderEventId({ event_id: 'evt_highsale_xyz' })).toBe('evt_highsale_xyz');
  });

  it('falls back to camelCase `eventId` for providers that use it', () => {
    expect(extractProviderEventId({ eventId: 'evt_camel_001' })).toBe('evt_camel_001');
  });

  it('coerces numeric ids to strings', () => {
    expect(extractProviderEventId({ id: 42 })).toBe('42');
  });

  it('rejects empty-string ids', () => {
    expect(extractProviderEventId({ id: '' })).toBeNull();
  });

  it('rejects boolean / object / array values at the id key', () => {
    expect(extractProviderEventId({ id: true })).toBeNull();
    expect(extractProviderEventId({ id: { nested: 'x' } })).toBeNull();
    expect(extractProviderEventId({ id: ['x'] })).toBeNull();
  });

  it('rejects NaN / Infinity numeric ids', () => {
    expect(extractProviderEventId({ id: Number.NaN })).toBeNull();
    expect(extractProviderEventId({ id: Number.POSITIVE_INFINITY })).toBeNull();
  });
});

describe('processInboxRow (Task #50 worker entry)', () => {
  beforeEach(() => {
    hasDbMock.mockReturnValue(true);
    rowsStore.clear();
  });

  it('no-ops when hasDb() is false (no Postgres available)', async () => {
    hasDbMock.mockReturnValue(false);
    await processInboxRow('any-id');
    expect(rowsStore.size).toBe(0);
  });

  it('no-ops when the inbox row is not found', async () => {
    rowsStore.clear();
    await processInboxRow('unknown');
    expect(rowsStore.size).toBe(0);
  });

  it('no-ops when the row is already marked done', async () => {
    rowsStore.set('row-done', {
      id: 'row-done',
      provider: 'micamp',
      eventId: 'evt_x',
      eventType: 'mid.underwriting.approved',
      rawBody: JSON.stringify({ id: 'evt_x', type: 'mid.underwriting.approved' }),
      attempts: 0,
      processingStatus: 'done',
    });
    await processInboxRow('row-done');
    expect((rowsStore.get('row-done') as { processingStatus: string }).processingStatus).toBe(
      'done',
    );
  });

  it('claims a pending row, dispatches stub, and marks failed (NotImplementedError) — fail-loud posture', async () => {
    // Stubs throw NotImplementedError until the orchestrator wiring
    // lands. The processor must mark the row `failed` (NOT `done`) so
    // ops sees the gap in the DLQ surface.
    // See fix/p0-webhook-stubs-fail-loud.
    rowsStore.set('row-pending', {
      id: 'row-pending',
      provider: 'micamp',
      eventId: 'evt_pending',
      eventType: 'mid.underwriting.approved',
      rawBody: JSON.stringify({ id: 'evt_pending', type: 'mid.underwriting.approved' }),
      attempts: 0,
      processingStatus: 'pending',
    });
    await expect(processInboxRow('row-pending')).rejects.toThrow(/handler_not_implemented/);
    const row = rowsStore.get('row-pending') as {
      processingStatus: string;
      failureReason: string;
    };
    expect(row.processingStatus).toBe('failed');
    expect(row.failureReason).toMatch(/handler_not_implemented:micamp:mid\.underwriting\.approved/);
  });

  it('throws on a handler failure so BullMQ retries', async () => {
    rowsStore.set('row-bad', {
      id: 'row-bad',
      provider: 'micamp',
      eventId: 'evt_bad',
      eventType: 'mid.unknown_event_for_test',
      rawBody: JSON.stringify({ id: 'evt_bad', type: 'mid.unknown_event_for_test' }),
      attempts: 0,
      processingStatus: 'pending',
    });
    await expect(processInboxRow('row-bad')).rejects.toThrow(/unknown_event_type/);
  });

  it('NotImplementedError → terminal failed immediately (no backoff/retry budget)', async () => {
    // attempts starts at 0 but the row should land in `failed`, not
    // `pending` (which is what the standard catch path would do until
    // MAX_ATTEMPTS=5). NotImplementedError is non-retryable by design.
    rowsStore.set('row-trutopia', {
      id: 'row-trutopia',
      provider: 'trutopia',
      eventId: 'evt_tru',
      eventType: 'decision.returned',
      rawBody: JSON.stringify({ id: 'evt_tru', type: 'decision.returned' }),
      attempts: 0,
      processingStatus: 'pending',
    });
    await expect(processInboxRow('row-trutopia')).rejects.toThrow(/handler_not_implemented/);
    const row = rowsStore.get('row-trutopia') as {
      processingStatus: string;
      attempts: number;
      failureReason: string;
    };
    expect(row.processingStatus).toBe('failed');
    expect(row.attempts).toBe(1);
    expect(row.failureReason).toMatch(/handler_not_implemented:trutopia:decision\.returned/);
  });
});
