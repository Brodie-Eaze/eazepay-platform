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
          // Return the lone matching row, if any. The webhook-processor
          // calls .select({...}).from(...).where(eq(id, x)).limit(1).
          const arr = Array.from(rowsStore.values());
          void cols;
          return arr;
        },
      }),
    }),
  }),
  update: () => ({
    set: (patch: Record<string, unknown>) => {
      // Build a thenable + returnable chain. drizzle's `.where(...)`
      // returns a promise (no .returning() needed) OR a thenable that
      // exposes .returning(). The webhook-processor's claimRow uses
      // .returning(), and markDone/markFailed don't.
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
    // Must not throw.
    await processInboxRow('any-id');
    // Nothing was touched.
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
    // Status was already 'done' and remains 'done' — no change.
    expect((rowsStore.get('row-done') as { processingStatus: string }).processingStatus).toBe(
      'done',
    );
  });

  it('claims a pending row, dispatches, and marks done on success', async () => {
    rowsStore.set('row-pending', {
      id: 'row-pending',
      provider: 'micamp',
      eventId: 'evt_pending',
      eventType: 'mid.underwriting.approved',
      rawBody: JSON.stringify({ id: 'evt_pending', type: 'mid.underwriting.approved' }),
      attempts: 0,
      processingStatus: 'pending',
    });
    await processInboxRow('row-pending');
    const status = (rowsStore.get('row-pending') as { processingStatus: string }).processingStatus;
    expect(status).toBe('done');
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
});
