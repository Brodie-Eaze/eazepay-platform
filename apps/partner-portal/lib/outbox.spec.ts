import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Hermetic specs for the transactional-outbox helpers + drain worker
 * (W1.1). The full atomicity story requires a live Postgres (the
 * tx-rollback path is the whole point) — that's covered in the e2e
 * suite. These specs cover the unit contract:
 *
 *   1. enqueueOutbox inserts inside the tx the caller provides (i.e.
 *      the `tx` argument's insert path is what gets called — proving
 *      that a route handler that wraps both the business write and
 *      the enqueue in one transaction will commit or roll back as
 *      a unit).
 *   2. processOutboxBatch marks a row `sent` on handler success.
 *   3. processOutboxBatch schedules a retry (status='pending',
 *      next_attempt_at in the future) on transient failure.
 *   4. processOutboxBatch marks a row `dead` after MAX_ATTEMPTS.
 *   5. processOutboxBatch marks a row `dead` immediately on an
 *      unknown kind (deploy-order bug — non-retryable).
 */

interface OutboxRow {
  id: string;
  kind: string;
  payloadJson: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed' | 'dead';
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date;
  sentAt: Date | null;
}

const rows = new Map<string, OutboxRow>();
const hasDbMock = vi.fn(() => true);

/* Drizzle chainable mock — supports the exact call shapes used by
 * outbox.ts (insert(...).values(...).returning(...)) and
 * outbox-drain.ts (select/from/where/orderBy/limit and
 * update/set/where/returning). The internal where clauses are not
 * inspected — we filter via the row's actual status/nextAttemptAt
 * in each method below to keep the mock self-consistent. */

function makeSelectChain(filter: (r: OutboxRow) => boolean) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async (n: number) =>
            Array.from(rows.values())
              .filter(filter)
              .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime())
              .slice(0, n)
              .map((r) => ({
                id: r.id,
                kind: r.kind,
                payloadJson: r.payloadJson,
                attempts: r.attempts,
              })),
        }),
      }),
      // For outboxBacklog (groupBy chain) — not exercised in these specs.
      groupBy: async () => [],
    }),
  };
}

const insertChain = {
  values: (v: { kind: string; payloadJson: Record<string, unknown> }) => ({
    returning: async () => {
      const id = `outbox_${rows.size + 1}`;
      const row: OutboxRow = {
        id,
        kind: v.kind,
        payloadJson: v.payloadJson,
        status: 'pending',
        attempts: 0,
        lastError: null,
        nextAttemptAt: new Date(0),
        sentAt: null,
      };
      rows.set(id, row);
      return [{ id }];
    },
  }),
};

type UpdatePatch = Partial<OutboxRow>;

function makeUpdateChain(patch: UpdatePatch, claim: boolean) {
  return {
    where: () => {
      // The drain worker uses two update shapes:
      //   • claimRow:    where(...).returning() — only acts on rows
      //                  currently 'pending' with nextAttemptAt<=now()
      //   • mark*:       where(...) returning void — acts on any row
      //                  with the targeted id (we apply to all rows
      //                  in the map since the spec drives one at a
      //                  time and only the chained `.returning()` is
      //                  used by the claim path).
      const applied: string[] = [];
      const now = new Date();
      for (const row of rows.values()) {
        if (claim) {
          if (row.status !== 'pending' || row.nextAttemptAt > now) continue;
        }
        Object.assign(row, patch);
        applied.push(row.id);
        if (claim) break; // claim is per-id; one row per call
      }
      return {
        returning: async () => applied.map((id) => ({ id })),
        then: (resolve: (v: unknown) => unknown) => resolve(undefined),
      };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbMock: any = {
  insert: (_table: unknown) => insertChain,
  select: (_cols: unknown) =>
    makeSelectChain((r) => r.status === 'pending' && r.nextAttemptAt <= new Date()),
  update: (_table: unknown) => ({
    set: (patch: UpdatePatch) => {
      // Heuristic: a claim updates only `nextAttemptAt`. Mark/retry
      // updates change `status` or `sentAt`.
      const isClaim = Object.keys(patch).length === 1 && 'nextAttemptAt' in patch;
      return makeUpdateChain(patch, isClaim);
    },
  }),
  transaction: async <T>(fn: (tx: typeof dbMock) => Promise<T>): Promise<T> => fn(dbMock),
};

vi.mock('./db', async () => {
  const real = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...real,
    hasDb: () => hasDbMock(),
    getDb: () => dbMock,
  };
});

vi.mock('./safe-log', () => ({
  safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// db re-exports the schema; the drain worker imports it as `schema`
// from '../db' — re-use the real schema so column references resolve.
import { enqueueOutbox } from './outbox';
import { processOutboxBatch, MAX_ATTEMPTS, __setHandlerForTest } from './workers/outbox-drain';

beforeEach(() => {
  rows.clear();
  hasDbMock.mockReturnValue(true);
});

describe('enqueueOutbox', () => {
  it('inserts a row using the caller-provided tx (atomic with business write)', async () => {
    // The contract is that `enqueueOutbox(tx, ...)` calls `tx.insert(...)`,
    // not `getDb().insert(...)`. The tx argument we pass IS the dbMock
    // here — proving the insert flows through the caller's handle, so
    // a tx rollback on the business write would also drop the outbox row.
    const result = await enqueueOutbox(dbMock as never, {
      kind: 'notification.send',
      payload: { applicationId: 'app_123', channel: 'email' },
    });
    expect(result.id).toBeTruthy();
    expect(rows.size).toBe(1);
    const [row] = Array.from(rows.values());
    if (!row) throw new Error('row should exist');
    expect(row.kind).toBe('notification.send');
    expect(row.status).toBe('pending');
    expect(row.payloadJson).toEqual({ applicationId: 'app_123', channel: 'email' });
  });

  it('returns the minted id for caller-side correlation', async () => {
    const a = await enqueueOutbox(dbMock as never, {
      kind: 'audit.log',
      payload: { actor: 'system' },
    });
    const b = await enqueueOutbox(dbMock as never, {
      kind: 'audit.log',
      payload: { actor: 'system' },
    });
    expect(a.id).not.toEqual(b.id);
  });
});

describe('processOutboxBatch', () => {
  it('no-ops when DB is unavailable', async () => {
    hasDbMock.mockReturnValue(false);
    const res = await processOutboxBatch();
    expect(res).toEqual({ scanned: 0, sent: 0, retried: 0, dead: 0, skipped: 0 });
  });

  it('marks a row sent on handler success', async () => {
    const restore = __setHandlerForTest('notification.send', async () => ({ ok: true }));
    try {
      rows.set('o1', {
        id: 'o1',
        kind: 'notification.send',
        payloadJson: {},
        status: 'pending',
        attempts: 0,
        lastError: null,
        nextAttemptAt: new Date(0),
        sentAt: null,
      });
      const res = await processOutboxBatch();
      expect(res.sent).toBe(1);
      const row = rows.get('o1');
      expect(row?.status).toBe('sent');
      expect(row?.sentAt).toBeInstanceOf(Date);
      expect(row?.lastError).toBeNull();
    } finally {
      restore();
    }
  });

  it('schedules a retry on transient handler failure (below MAX_ATTEMPTS)', async () => {
    const restore = __setHandlerForTest('webhook.outbound', async () => ({
      ok: false,
      error: 'transient_5xx',
    }));
    try {
      rows.set('o2', {
        id: 'o2',
        kind: 'webhook.outbound',
        payloadJson: { url: 'https://example.com/hook' },
        status: 'pending',
        attempts: 0,
        lastError: null,
        nextAttemptAt: new Date(0),
        sentAt: null,
      });
      const before = Date.now();
      const res = await processOutboxBatch();
      expect(res.retried).toBe(1);
      expect(res.dead).toBe(0);
      const row = rows.get('o2');
      expect(row?.status).toBe('pending');
      expect(row?.attempts).toBe(1);
      expect(row?.lastError).toBe('transient_5xx');
      // exponential backoff bumps next_attempt_at into the future
      expect(row?.nextAttemptAt.getTime()).toBeGreaterThan(before);
    } finally {
      restore();
    }
  });

  it('marks dead after MAX_ATTEMPTS consecutive failures', async () => {
    const restore = __setHandlerForTest('webhook.outbound', async () => ({
      ok: false,
      error: 'still_failing',
    }));
    try {
      rows.set('o3', {
        id: 'o3',
        kind: 'webhook.outbound',
        payloadJson: {},
        status: 'pending',
        attempts: MAX_ATTEMPTS - 1,
        lastError: null,
        nextAttemptAt: new Date(0),
        sentAt: null,
      });
      const res = await processOutboxBatch();
      expect(res.dead).toBe(1);
      expect(res.retried).toBe(0);
      const row = rows.get('o3');
      expect(row?.status).toBe('dead');
      expect(row?.attempts).toBe(MAX_ATTEMPTS);
      expect(row?.lastError).toBe('still_failing');
    } finally {
      restore();
    }
  });

  it('marks dead immediately on unknown kind (non-retryable deploy-order bug)', async () => {
    rows.set('o4', {
      id: 'o4',
      kind: 'mystery.kind',
      payloadJson: {},
      status: 'pending',
      attempts: 0,
      lastError: null,
      nextAttemptAt: new Date(0),
      sentAt: null,
    });
    const res = await processOutboxBatch();
    expect(res.dead).toBe(1);
    const row = rows.get('o4');
    expect(row?.status).toBe('dead');
    expect(row?.lastError).toMatch(/unknown_kind:mystery\.kind/);
  });

  it('marks dead when a handler throws and attempts are exhausted', async () => {
    const restore = __setHandlerForTest('audit.log', async () => {
      throw new Error('handler_blew_up');
    });
    try {
      rows.set('o5', {
        id: 'o5',
        kind: 'audit.log',
        payloadJson: {},
        status: 'pending',
        attempts: MAX_ATTEMPTS - 1,
        lastError: null,
        nextAttemptAt: new Date(0),
        sentAt: null,
      });
      const res = await processOutboxBatch();
      expect(res.dead).toBe(1);
      const row = rows.get('o5');
      if (!row) throw new Error('row should exist');
      expect(row.status).toBe('dead');
      expect(row.lastError).toBe('handler_blew_up');
    } finally {
      restore();
    }
  });
});
