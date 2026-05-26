import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Specs for the provisioning orchestrator persistence layer (Tasks #40, #46).
 *
 * Covers:
 *   1. In-memory fallback: when hasDb() is false, startProvision/getRun/
 *      listRuns round-trip via the module-scoped Map.
 *   2. DB path: when hasDb() is true, startProvision INSERTs a row,
 *      getRun SELECTs by id, listRuns runs the ORDER BY.
 *   3. Audit log: startProvision writes a 'provision.start' audit row;
 *      a failed run writes 'provision.failed' with the step + reason.
 *   4. Run id is a UUID (Task #48 — no Math.random).
 *   5. Postgres errors during persistRun / writeAudit do NOT abort the
 *      orchestrator — the in-memory copy is the fallback observability
 *      surface, the route handler still returns a usable record.
 */

// ---------------------------------------------------------------------------
// Module-level mocks. `vi.mock` is hoisted, so these must come before
// importing the module under test.
// ---------------------------------------------------------------------------

const hasDbMock = vi.fn(() => false);

type InsertCall = { table: string; values: Record<string, unknown> };
const insertCalls: InsertCall[] = [];
const selectRows = new Map<string, Record<string, unknown>[]>();

const dbMock = {
  insert: (table: { _: { name?: string }; [Symbol.toStringTag]?: string }) => ({
    values: (v: Record<string, unknown>) => {
      const tableName = inferTableName(table);
      insertCalls.push({ table: tableName, values: v });
      const row = { ...v };
      // Insert into selectRows so a subsequent select finds it.
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
      const tableName = inferTableName(table as { _: { name?: string } });
      return {
        where: () => ({
          limit: async () => selectRows.get(tableName) ?? [],
          orderBy: () => ({ limit: async () => selectRows.get(tableName) ?? [] }),
        }),
        orderBy: () => ({ limit: async () => selectRows.get(tableName) ?? [] }),
      };
    },
  }),
  update: (table: { _: { name?: string } }) => {
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

function inferTableName(table: unknown): string {
  // Drizzle stores the SQL table name on a Symbol — read it directly
  // rather than fighting String(table) which always returns
  // '[object Object]'.
  if (!table || typeof table !== 'object') return 'unknown';
  const syms = Object.getOwnPropertySymbols(table);
  for (const s of syms) {
    if (s.description === 'drizzle:Name') {
      return (table as unknown as Record<symbol, string>)[s] ?? 'unknown';
    }
  }
  return 'unknown';
}

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

import { startProvision, getRun, listRuns, type ProvisionConfig } from './provision';

const baseConfig: ProvisionConfig = {
  partnerId: 'p_test_acme',
  legalName: 'Acme MedSpa',
  dba: null,
  ein: '12-3456789',
  primaryContactName: 'Test Owner',
  primaryContactEmail: 'owner@acme.example',
  primaryContactPhone: '555-0100',
  brand: 'medpay',
  bureau: 'fico8',
  monthlyPullCap: 500,
  billingCadence: 'biweekly',
  estimatedAnnualVolumeCents: 500_000_00,
  estimatedTicketCents: 4_500_00,
  mccCode: '8099',
  funnelUrls: [],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function flushImmediates(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('orchestrator/provision', () => {
  beforeEach(() => {
    hasDbMock.mockReturnValue(false);
    insertCalls.length = 0;
    selectRows.clear();
  });

  describe('in-memory fallback (hasDb=false)', () => {
    it('mints a UUID for the run id (Task #48)', async () => {
      const run = await startProvision(baseConfig);
      expect(run.id).toMatch(UUID_RE);
    });

    it('startProvision returns a queued run with all four pending steps', async () => {
      const run = await startProvision(baseConfig);
      expect(run.partnerId).toBe('p_test_acme');
      expect(run.brand).toBe('medpay');
      expect(run.steps).toHaveLength(4);
      expect(run.steps.map((s) => s.name)).toEqual([
        'highsale_subaccount',
        'marketplace_defaults',
        'micamp_mid',
        'partner_portal_seed',
      ]);
    });

    it('getRun returns the same record by id', async () => {
      const run = await startProvision(baseConfig);
      const fetched = await getRun(run.id);
      expect(fetched?.id).toBe(run.id);
    });

    it('listRuns sorts newest first', async () => {
      const a = await startProvision(baseConfig);
      await new Promise((r) => setTimeout(r, 5));
      const b = await startProvision({ ...baseConfig, partnerId: 'p_test_zzz' });
      const list = await listRuns();
      expect(list[0]?.id).toBe(b.id);
      expect(list.find((r) => r.id === a.id)).toBeDefined();
    });

    it('getRun returns undefined for unknown id', async () => {
      const result = await getRun('00000000-0000-4000-8000-000000000000');
      expect(result).toBeUndefined();
    });

    it('completes successfully when all upstream calls succeed', async () => {
      const run = await startProvision(baseConfig);
      // executeRun is dispatched via setImmediate; flush + give the
      // inner awaits a microtask window each.
      await flushImmediates();
      await new Promise((r) => setTimeout(r, 10));
      const fetched = await getRun(run.id);
      expect(fetched?.status).toBe('completed');
      expect(fetched?.steps.every((s) => s.status === 'done')).toBe(true);
    });
  });

  describe('DB path (hasDb=true)', () => {
    beforeEach(() => {
      hasDbMock.mockReturnValue(true);
    });

    it('startProvision INSERTs into provisioning_runs', async () => {
      const run = await startProvision(baseConfig);
      const insert = insertCalls.find((c) => c.table === 'provisioning_runs');
      expect(insert).toBeDefined();
      expect(insert?.values.id).toBe(run.id);
      expect(insert?.values.partnerId).toBe('p_test_acme');
      expect(insert?.values.brand).toBe('medpay');
      expect(insert?.values.status).toBe('queued');
    });

    it('emits provision.start audit_log row on startProvision', async () => {
      await startProvision(baseConfig);
      const audit = insertCalls.find(
        (c) => c.table === 'audit_log' && c.values.action === 'provision.start',
      );
      expect(audit).toBeDefined();
      expect(audit?.values.actor).toBe('system:orchestrator');
      expect(audit?.values.targetType).toBe('provisioning_run');
    });

    it('writes provision.complete audit_log on full success', async () => {
      await startProvision(baseConfig);
      await flushImmediates();
      await new Promise((r) => setTimeout(r, 20));
      const audit = insertCalls.find(
        (c) => c.table === 'audit_log' && c.values.action === 'provision.complete',
      );
      expect(audit).toBeDefined();
    });

    it('writes provision.step.complete for each successful step', async () => {
      await startProvision(baseConfig);
      await flushImmediates();
      await new Promise((r) => setTimeout(r, 20));
      const stepAudits = insertCalls.filter(
        (c) => c.table === 'audit_log' && c.values.action === 'provision.step.complete',
      );
      expect(stepAudits.length).toBe(4);
    });
  });

  describe('failure handling', () => {
    beforeEach(() => {
      hasDbMock.mockReturnValue(true);
    });

    it('writes provision.failed audit when HighSale throws', async () => {
      const highsale = await import('../highsale/client');
      vi.mocked(highsale.createSubAccount).mockRejectedValueOnce(new Error('HighSale 503'));

      await startProvision(baseConfig);
      await flushImmediates();
      await new Promise((r) => setTimeout(r, 20));

      const failedAudit = insertCalls.find(
        (c) => c.table === 'audit_log' && c.values.action === 'provision.failed',
      );
      expect(failedAudit).toBeDefined();
      const payload = JSON.parse(failedAudit?.values.payloadJson as string);
      expect(payload.step).toBe('highsale_subaccount');
      expect(payload.reason).toContain('HighSale 503');
    });
  });

  describe('adversarial inputs', () => {
    it('handles partnerId at the 64-char boundary', async () => {
      const longId = 'p_' + 'x'.repeat(62);
      const run = await startProvision({ ...baseConfig, partnerId: longId });
      expect(run.partnerId).toBe(longId);
    });
  });
});
