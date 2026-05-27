/**
 * SOC2 CC6.6 + CC7.2 — integration spec for the partner status-change
 * endpoint.
 *
 * Confirms that a successful POST writes BOTH:
 *   1. The new status onto the partners row (suspended_at set on
 *      'suspended', cleared on 'active').
 *   2. A matching `audit_log` row with the canonical action verb
 *      (partner.suspended / partner.reactivated) and a payload that
 *      records the from/to/reason/actor.
 *
 * We mock the Drizzle client at the lib/db boundary so the test runs
 * without a Postgres dependency; the assertions verify the .update()
 * and .insert() calls were dispatched with the right shape.
 *
 * The CSRF + origin gates are stubbed (no-op) so the spec focuses on
 * the compliance behaviour rather than re-testing the SEC middleware
 * which has its own coverage in lib/csrf.spec.ts + lib/origin-guard
 * tests.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

// --- mocks --------------------------------------------------------

vi.mock('../../../../../../lib/origin-guard', () => ({
  enforceOrigin: () => null,
}));

vi.mock('../../../../../../lib/csrf', () => ({
  enforceCsrf: () => null,
}));

vi.mock('../../../../../../lib/server-guards', () => ({
  requireAdmin: async () => ({ actor: 'demo:master', role: 'master_admin' }),
}));

// In-memory state captured by the mocked Drizzle client.
type RowState = {
  id: string;
  status: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  brand: string;
  legalName: string;
};
const dbState: { partner: RowState | null; auditInserts: unknown[] } = {
  partner: null,
  auditInserts: [],
};

function makeDbMock() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (dbState.partner ? [dbState.partner] : []),
        }),
      }),
    }),
    update: () => ({
      set: (patch: Partial<RowState>) => ({
        where: () => ({
          returning: async () => {
            if (!dbState.partner) return [];
            dbState.partner = { ...dbState.partner, ...patch } as RowState;
            return [dbState.partner];
          },
        }),
      }),
    }),
    insert: () => ({
      values: async (row: unknown) => {
        dbState.auditInserts.push(row);
        return undefined;
      },
    }),
  };
}

vi.mock('../../../../../../lib/db', () => ({
  hasDb: () => true,
  getDb: () => makeDbMock(),
  // SEC-RLS-2: the route now runs the SELECT + UPDATE + INSERT inside
  // `withTenantContext(...)`. The unit test substitutes a passthrough
  // that just invokes the callback with the same db mock — the GUC
  // binding is exercised in the dedicated RLS spec
  // (`lib/db/tenant-rls.spec.ts`) that runs against a real Postgres.
  withTenantContext: async (_session: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(makeDbMock()),
  schema: {},
}));

vi.mock('../../../../../../lib/session', () => ({
  getSessionContext: async () => ({
    mode: 'demo',
    preset: 'master',
    isOperator: true,
    brand: null,
  }),
}));

vi.mock('../../../../../../lib/db/schema', () => ({
  partners: { id: 'id-col' },
  auditLog: {},
}));

vi.mock('../../../../../../lib/safe-log', () => ({
  safeLog: { info: () => undefined, warn: () => undefined, error: () => undefined },
}));

// Drizzle's `eq` is referenced inside the route but only matters as a
// where-builder argument the mock ignores. Stub to a passthrough.
vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, val: unknown) => ({ _col, val }),
}));

// --- import AFTER mocks ------------------------------------------

import { POST } from './route';

function buildReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/partners/p_test/status', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'vitest',
    },
    body: JSON.stringify(body),
  });
}

function ctx(id = 'p_test') {
  return { params: { id } };
}

function seedPartner(overrides: Partial<RowState> = {}): void {
  dbState.partner = {
    id: 'p_test',
    status: 'active',
    suspendedAt: null,
    suspendedReason: null,
    brand: 'medpay',
    legalName: 'Test Partner LLC',
    ...overrides,
  };
}

describe('POST /api/admin/partners/[id]/status', () => {
  beforeEach(() => {
    dbState.partner = null;
    dbState.auditInserts = [];
  });

  it('suspend: updates row + writes partner.suspended audit entry', async () => {
    seedPartner({ status: 'active' });
    const res = (await POST(
      buildReq({ status: 'suspended', reason: 'AML review pending' }),
      ctx(),
    )) as NextResponse;
    expect(res.status).toBe(200);

    // partners row updated
    expect(dbState.partner?.status).toBe('suspended');
    expect(dbState.partner?.suspendedAt).toBeInstanceOf(Date);
    expect(dbState.partner?.suspendedReason).toBe('AML review pending');

    // audit_log insert happened with the canonical action verb +
    // structured payload capturing the transition.
    expect(dbState.auditInserts).toHaveLength(1);
    const entry = dbState.auditInserts[0] as {
      actor: string;
      action: string;
      targetType: string;
      targetId: string;
      payloadJson: string;
    };
    expect(entry.action).toBe('partner.suspended');
    expect(entry.targetType).toBe('partner');
    expect(entry.targetId).toBe('p_test');
    expect(entry.actor).toBe('demo:master');
    const payload = JSON.parse(entry.payloadJson) as {
      from: string;
      to: string;
      reason: string;
      by: string;
    };
    expect(payload.from).toBe('active');
    expect(payload.to).toBe('suspended');
    expect(payload.reason).toBe('AML review pending');
    expect(payload.by).toBe('demo:master');
  });

  it('reactivate: clears suspended_at and emits partner.reactivated', async () => {
    seedPartner({
      status: 'suspended',
      suspendedAt: new Date('2026-01-01T00:00:00Z'),
      suspendedReason: 'old reason',
    });
    const res = (await POST(
      buildReq({ status: 'active', reason: 'AML cleared' }),
      ctx(),
    )) as NextResponse;
    expect(res.status).toBe(200);

    expect(dbState.partner?.status).toBe('active');
    expect(dbState.partner?.suspendedAt).toBeNull();
    expect(dbState.partner?.suspendedReason).toBeNull();

    expect(dbState.auditInserts).toHaveLength(1);
    const entry = dbState.auditInserts[0] as { action: string };
    expect(entry.action).toBe('partner.reactivated');
  });

  it('404 — partner id not found', async () => {
    dbState.partner = null;
    const res = (await POST(
      buildReq({ status: 'suspended', reason: 'nope' }),
      ctx('p_missing'),
    )) as NextResponse;
    expect(res.status).toBe(404);
    expect(dbState.auditInserts).toHaveLength(0);
  });

  it('400 — invalid status enum is rejected before any DB write', async () => {
    seedPartner();
    const res = (await POST(
      buildReq({ status: 'paused', reason: 'why not' }),
      ctx(),
    )) as NextResponse;
    expect(res.status).toBe(400);
    // partner row not mutated
    expect(dbState.partner?.status).toBe('active');
    expect(dbState.auditInserts).toHaveLength(0);
  });

  it('400 — missing reason is rejected (audit needs the justification)', async () => {
    seedPartner();
    const res = (await POST(buildReq({ status: 'suspended' }), ctx())) as NextResponse;
    expect(res.status).toBe(400);
    expect(dbState.auditInserts).toHaveLength(0);
  });
});
