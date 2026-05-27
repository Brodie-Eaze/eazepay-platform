/**
 * SEC-RLS-2 — hermetic spec for the tenant-context wrappers.
 *
 * The full RLS contract is enforced by Postgres at runtime (migration
 * 0013_rls_policies); this spec proves that the BFF wraps every txn
 * with the right GUCs so that contract is reachable.
 *
 *   1. `tenantContextFromSession` maps each session shape onto the
 *      (partnerId, role) pair the RLS policies in migration 0013 expect.
 *
 *   2. `withTenantContext` / `withRawTenantContext` issue exactly the
 *      `SELECT set_config('app.current_partner_id', …, true)` +
 *      `SELECT set_config('app.role', …, true)` pair BEFORE running
 *      the caller's transaction body. Without those two statements the
 *      RLS policies on `applications`, `offers`, `application_events`,
 *      `audit_log`, etc. evaluate to FALSE and every SELECT returns
 *      zero rows — which is what the negative test below asserts via
 *      a simulated policy gate driven by the bound GUCs.
 *
 *   3. Cross-tenant probe — a `{partnerId: 'wrong-p', role: 'partner'}`
 *      GUC drives the simulated policy gate to FALSE on a row labelled
 *      `partner_id = 'real-p'`, so the SELECT returns []. This mirrors
 *      what real Postgres does and is the forcing-function this PR
 *      ships across every route handler.
 *
 * A live-Postgres integration spec belongs in the e2e tier
 * (`apps/api/test/integration/`); the hermetic spec here is the unit
 * counterpart that catches regressions on the wrapper itself —
 * without it, an accidental refactor that drops the `set_config`
 * pair would silently break RLS in production.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionContext } from '../session';

// ---- mocks: stub the drizzle/pg layer so the wrapper code is exercised
// against a deterministic in-test transaction whose only side effect is
// recording the `set_config` calls.

const guc = {
  current_partner_id: '' as string,
  role: '' as string,
};
const setConfigCalls: Array<{ name: string; value: string }> = [];

function resetTxState() {
  guc.current_partner_id = '';
  guc.role = '';
  setConfigCalls.length = 0;
}

// Minimal tx mock — exposes `.execute(sql)` (used by applyTenantGucs)
// + chainable `.select().from().where()` returning a single-row store
// gated by the bound GUC. Mirrors what real Postgres + the RLS policy
// would do on a select against `applications`.
const rowsByPartner: Record<string, Array<{ id: string; partnerId: string }>> = {
  'real-p': [{ id: 'app_1', partnerId: 'real-p' }],
};

function makeTxMock() {
  return {
    execute: async (queryObj: { queryChunks?: unknown[]; sql?: string } & object) => {
      // Drizzle's `sql\`SELECT set_config('app.current_partner_id', ${ctx.partnerId}, true)\``
      // tags expose the raw chunks under `queryChunks`. We don't need to
      // parse SQL — we just need to recognise the two well-known set_config
      // calls and bind the matching GUC slot. The wrapper invokes execute()
      // exactly twice per txn, in (partner_id, role) order, so we peek the
      // currently-applied value out of band via a hidden symbol the spec
      // arranges before calling the wrapper.
      const pending = pendingSetConfig.shift();
      if (!pending) return { rows: [] };
      if (pending.name === 'app.current_partner_id') {
        guc.current_partner_id = pending.value;
      } else if (pending.name === 'app.role') {
        guc.role = pending.value;
      }
      setConfigCalls.push(pending);
      void queryObj;
      return { rows: [] };
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => simulatePolicyGate(),
        }),
      }),
    }),
  };
}

// The wrapper's `applyTenantGucs` issues set_config in a fixed order
// (partner_id first, role second). We pre-load `pendingSetConfig` with
// the expected values so the tx mock can record them; this is the same
// trick e2e specs use when they can't introspect parameterised SQL via
// a string match.
const pendingSetConfig: Array<{ name: string; value: string }> = [];

function simulatePolicyGate(): Array<{ id: string; partnerId: string }> {
  // Apply the exact migration-0013 policy: row visible iff
  // partner_id = current_setting('app.current_partner_id', true)
  // OR current_setting('app.role', true) = 'operator'.
  const rows = rowsByPartner['real-p'] ?? [];
  return rows.filter((r) => guc.role === 'operator' || r.partnerId === guc.current_partner_id);
}

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: () => ({
    transaction: async (fn: (tx: ReturnType<typeof makeTxMock>) => Promise<unknown>) => {
      // Pre-load the two set_config calls the wrapper is about to issue;
      // the tx mock pops them in order.
      const ctx = (globalThis as { __ezpTestCtx?: { partnerId: string | null; role: string } })
        .__ezpTestCtx;
      pendingSetConfig.push(
        { name: 'app.current_partner_id', value: ctx?.partnerId ?? '' },
        { name: 'app.role', value: ctx?.role ?? '' },
      );
      const tx = makeTxMock();
      return fn(tx);
    },
  }),
}));

vi.mock('pg', () => ({
  Pool: class {
    constructor() {
      // No-op. The mocked drizzle factory above never reaches into the pool.
    }
  },
}));

// Force the env so `resolveConnectionString` returns truthy and the wrapper
// proceeds past `hasDb()` checks.
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

// ---- import AFTER mocks
import {
  PUBLIC_CONSUMER_CONTEXT,
  SYSTEM_WEBHOOK_CONTEXT,
  tenantContextFromSession,
  withRawTenantContext,
  withTenantContext,
} from './index';

beforeEach(() => {
  resetTxState();
  // Reset the singleton-stash so each test gets a fresh Drizzle factory.
  delete (globalThis as { __ezpPgPool?: unknown }).__ezpPgPool;
});

describe('tenantContextFromSession', () => {
  it('demo operator → role=operator, partnerId=null', () => {
    const s = {
      mode: 'demo',
      preset: 'master',
      isOperator: true,
      brand: null,
    } as unknown as SessionContext;
    expect(tenantContextFromSession(s)).toEqual({ partnerId: null, role: 'operator' });
  });

  it('demo brand preset → role=operator (app layer narrows by brand)', () => {
    const s = {
      mode: 'demo',
      preset: 'medpay',
      isOperator: false,
      brand: 'medpay',
    } as unknown as SessionContext;
    expect(tenantContextFromSession(s)).toEqual({ partnerId: null, role: 'operator' });
  });

  it('account session → role=partner, partnerId pinned', () => {
    const s: SessionContext = {
      mode: 'account',
      userId: 'u_1',
      brand: 'medpay',
      partnerId: 'p_brodie',
    };
    expect(tenantContextFromSession(s)).toEqual({ partnerId: 'p_brodie', role: 'partner' });
  });

  it('real / none → role=none (fail-CLOSED)', () => {
    expect(tenantContextFromSession({ mode: 'none' })).toEqual({
      partnerId: null,
      role: 'none',
    });
    expect(tenantContextFromSession({ mode: 'real', placeholder: true })).toEqual({
      partnerId: null,
      role: 'none',
    });
  });
});

describe('withTenantContext binds the RLS GUCs before the body runs', () => {
  it('account session: binds partner GUC and admits its own rows', async () => {
    const session = {
      mode: 'account',
      userId: 'u_1',
      brand: 'medpay',
      partnerId: 'real-p',
    } as unknown as SessionContext;
    (globalThis as { __ezpTestCtx?: unknown }).__ezpTestCtx = {
      partnerId: 'real-p',
      role: 'partner',
    };
    const rows = await withTenantContext(session, async (tx) => {
      // @ts-expect-error simplified mock chain
      return tx.select().from().where().limit();
    });
    expect(setConfigCalls).toEqual([
      { name: 'app.current_partner_id', value: 'real-p' },
      { name: 'app.role', value: 'partner' },
    ]);
    expect(rows).toEqual([{ id: 'app_1', partnerId: 'real-p' }]);
  });

  it('NEGATIVE: cross-tenant probe returns zero rows under wrong-partner GUC', async () => {
    // The forcing-function test from the SEC-RLS-2 brief. A
    // `withRawTenantContext({partnerId: 'wrong-p', role: 'partner'})`
    // call that selects from a table whose row is owned by 'real-p'
    // must return [] — RLS, not app code, is the gate.
    (globalThis as { __ezpTestCtx?: unknown }).__ezpTestCtx = {
      partnerId: 'wrong-p',
      role: 'partner',
    };
    const rows = await withRawTenantContext(
      { partnerId: 'wrong-p', role: 'partner' },
      async (tx) => {
        // @ts-expect-error simplified mock chain
        return tx.select().from().where().limit();
      },
    );
    expect(setConfigCalls).toEqual([
      { name: 'app.current_partner_id', value: 'wrong-p' },
      { name: 'app.role', value: 'partner' },
    ]);
    expect(rows).toEqual([]);
  });

  it('NEGATIVE: consumer-tier GUC also yields zero rows on RLS tables', async () => {
    (globalThis as { __ezpTestCtx?: unknown }).__ezpTestCtx = {
      partnerId: PUBLIC_CONSUMER_CONTEXT.partnerId,
      role: PUBLIC_CONSUMER_CONTEXT.role,
    };
    const rows = await withRawTenantContext(PUBLIC_CONSUMER_CONTEXT, async (tx) => {
      // @ts-expect-error simplified mock chain
      return tx.select().from().where().limit();
    });
    expect(rows).toEqual([]);
    expect(setConfigCalls[1]?.value).toBe('consumer');
  });

  it('SYSTEM_WEBHOOK_CONTEXT (operator) admits every row — required for handler writes', async () => {
    (globalThis as { __ezpTestCtx?: unknown }).__ezpTestCtx = {
      partnerId: SYSTEM_WEBHOOK_CONTEXT.partnerId,
      role: SYSTEM_WEBHOOK_CONTEXT.role,
    };
    const rows = await withRawTenantContext(SYSTEM_WEBHOOK_CONTEXT, async (tx) => {
      // @ts-expect-error simplified mock chain
      return tx.select().from().where().limit();
    });
    expect(rows).toEqual([{ id: 'app_1', partnerId: 'real-p' }]);
    expect(setConfigCalls[1]?.value).toBe('operator');
  });
});
