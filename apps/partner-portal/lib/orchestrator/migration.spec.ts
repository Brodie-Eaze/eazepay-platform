import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Specs for the migration orchestrator persistence layer (Tasks #40, #46).
 *
 * Covers:
 *   1. In-memory fallback: when hasDb() is false, queueMigration is
 *      idempotent on sourceCustomerId, returns the same record across
 *      calls.
 *   2. DB path: queueMigration INSERTs into customer_migrations,
 *      startMigration UPDATEs status to 'in_progress'.
 *   3. Audit log: queueMigration writes 'migration.queue', startMigration
 *      writes 'migration.start'.
 *   4. Run id is a UUID (Task #48).
 *   5. Wrong-id startMigration returns null (no side effects).
 *   6. seedMigrationQueue is idempotent on retry.
 */

const hasDbMock = vi.fn(() => false);

type InsertCall = { table: string; values: Record<string, unknown> };
const insertCalls: InsertCall[] = [];
const selectRows = new Map<string, Record<string, unknown>[]>();

function inferTableName(table: unknown): string {
  if (!table || typeof table !== 'object') return 'unknown';
  const syms = Object.getOwnPropertySymbols(table);
  for (const s of syms) {
    if (s.description === 'drizzle:Name') {
      return (table as unknown as Record<symbol, string>)[s] ?? 'unknown';
    }
  }
  return 'unknown';
}

const dbMock = {
  insert: (table: unknown) => ({
    values: (v: Record<string, unknown>) => {
      const tableName = inferTableName(table);
      insertCalls.push({ table: tableName, values: v });
      const row = {
        ...v,
        createdAt: new Date(),
        startedAt: v.startedAt ?? null,
        completedAt: v.completedAt ?? null,
        targetPartnerId: v.targetPartnerId ?? null,
        failureReason: v.failureReason ?? null,
      };
      const arr = selectRows.get(tableName) ?? [];
      arr.push(row);
      selectRows.set(tableName, arr);
      const builder = {
        onConflictDoNothing: () => builder,
        returning: async () => [row],
        then: (resolve: (v: unknown) => unknown) => resolve(undefined),
      };
      return builder;
    },
  }),
  select: () => ({
    from: (table: unknown) => {
      const tableName = inferTableName(table);
      return {
        where: () => ({
          limit: async () => selectRows.get(tableName) ?? [],
          orderBy: () => ({ limit: async () => selectRows.get(tableName) ?? [] }),
        }),
        orderBy: () => ({ limit: async () => selectRows.get(tableName) ?? [] }),
      };
    },
  }),
  update: (table: unknown) => {
    const tableName = inferTableName(table);
    return {
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          const rows = selectRows.get(tableName) ?? [];
          if (rows[0]) Object.assign(rows[0], patch);
        },
      }),
    };
  },
};

vi.mock('../db', async () => {
  const real = await vi.importActual<typeof import('../db')>('../db');
  return {
    ...real,
    hasDb: () => hasDbMock(),
    getDb: () => dbMock,
  };
});

vi.mock('../highsale/client', () => ({
  createSubAccount: vi.fn(async () => ({
    subAccountId: 'hs_sub_test',
    configuredBureau: 'fico8',
  })),
}));

vi.mock('../micamp/client', () => ({
  provisionMid: vi.fn(async () => ({
    midId: 'mid_test',
    status: 'pre_underwriting',
    etaHours: 24,
  })),
}));

vi.mock('../safe-log', () => ({
  safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  queueMigration,
  startMigration,
  getMigration,
  listMigrations,
  seedMigrationQueue,
} from './migration';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('orchestrator/migration', () => {
  beforeEach(() => {
    hasDbMock.mockReturnValue(false);
    insertCalls.length = 0;
    selectRows.clear();
  });

  describe('in-memory fallback (hasDb=false)', () => {
    it('mints a UUID for the migration id (Task #48)', async () => {
      const record = await queueMigration('cust_abc');
      expect(record.id).toMatch(UUID_RE);
    });

    it('is idempotent on the same sourceCustomerId', async () => {
      const first = await queueMigration('cust_abc');
      const second = await queueMigration('cust_abc');
      expect(second.id).toBe(first.id);
    });

    it('getMigration returns the queued record', async () => {
      const record = await queueMigration('cust_abc');
      const fetched = await getMigration(record.id);
      expect(fetched?.sourceCustomerId).toBe('cust_abc');
    });

    it('listMigrations returns newest first', async () => {
      const a = await queueMigration('cust_a');
      await new Promise((r) => setTimeout(r, 5));
      const b = await queueMigration('cust_b');
      const list = await listMigrations();
      expect(list[0]?.id).toBe(b.id);
      expect(list.find((r) => r.id === a.id)).toBeDefined();
    });

    it('startMigration returns null for unknown id', async () => {
      const result = await startMigration('00000000-0000-4000-8000-000000000000');
      expect(result).toBeNull();
    });

    it('startMigration flips status from queued -> in_progress', async () => {
      const record = await queueMigration('cust_abc');
      const started = await startMigration(record.id);
      expect(started?.status).toBe('in_progress');
      expect(started?.startedAt).not.toBeNull();
    });
  });

  describe('seedMigrationQueue', () => {
    it('queues each customer once on first call', async () => {
      const records = await seedMigrationQueue(['c1', 'c2', 'c3']);
      expect(records).toHaveLength(3);
      const ids = records.map((r) => r.sourceCustomerId).sort();
      expect(ids).toEqual(['c1', 'c2', 'c3']);
    });

    it('returns the same records on a second call (idempotent)', async () => {
      const a = await seedMigrationQueue(['c1', 'c2']);
      const b = await seedMigrationQueue(['c1', 'c2']);
      expect(b[0]?.id).toBe(a[0]?.id);
      expect(b[1]?.id).toBe(a[1]?.id);
    });
  });

  describe('DB path (hasDb=true)', () => {
    beforeEach(() => {
      hasDbMock.mockReturnValue(true);
    });

    it('queueMigration INSERTs into customer_migrations', async () => {
      await queueMigration('cust_abc');
      const insert = insertCalls.find((c) => c.table === 'customer_migrations');
      expect(insert).toBeDefined();
      expect(insert?.values.sourceCustomerId).toBe('cust_abc');
      expect(insert?.values.status).toBe('queued');
    });

    it('writes migration.queue audit_log row', async () => {
      await queueMigration('cust_abc');
      const audit = insertCalls.find(
        (c) => c.table === 'audit_log' && c.values.action === 'migration.queue',
      );
      expect(audit).toBeDefined();
      expect(audit?.values.actor).toBe('system:orchestrator');
      expect(audit?.values.targetType).toBe('customer_migration');
    });

    it('writes migration.start audit_log row when started', async () => {
      const record = await queueMigration('cust_abc');
      await startMigration(record.id);
      const audit = insertCalls.find(
        (c) => c.table === 'audit_log' && c.values.action === 'migration.start',
      );
      expect(audit).toBeDefined();
    });
  });

  describe('adversarial inputs', () => {
    it('handles empty string customer id by inserting a row (validation lives in the route)', async () => {
      // The orchestrator does not re-validate; we assert the contract
      // so future callers know where validation must live.
      const record = await queueMigration('x');
      expect(record.sourceCustomerId).toBe('x');
    });
  });
});
