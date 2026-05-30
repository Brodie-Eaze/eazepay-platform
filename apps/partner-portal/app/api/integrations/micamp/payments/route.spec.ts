import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { PartnerContext, ResourceKind } from '@/lib/server-guards';
import type { ChargeRequest } from '@/lib/micamp/client';
import type { WriteAuditLogInput } from '@/lib/audit-log';

/**
 * SOC2-C001 (P0) — MID-charge cross-tenant IDOR.
 *
 * Pre-fix, POST /api/integrations/micamp/payments verified the caller
 * owned the `applicationId` but NEVER verified ownership of the `midId`
 * the charge lands in. A signed-in tenant-A session could pass one of
 * A's own applicationIds plus tenant B's midId and run a real card
 * charge through B's merchant account. RLS can't catch it because the
 * midId is an opaque string forwarded to MiCamp, not a tenant-scoped
 * SELECT.
 *
 * These specs drive the route handler directly (App Router handlers are
 * plain async fns callable with a NextRequest under vitest — see the
 * partner-portal vitest config). The route's four collaborators are
 * mocked at the `@/lib/...` boundary so we control:
 *   - the session (a REAL account session, isAdminOverride:false, so the
 *     ownership check actually fires — admin-override would bypass it),
 *   - per-resource ownership outcomes (application owned; mid owned or
 *     cross-tenant),
 *   - the merchant processor (asserts whether `charge` was ever called),
 *   - the audit-log writer (asserts a denial row is written).
 *
 * The cross-tenant denial returns 404 — mirroring the sibling settlement
 * route's `assertResourceOwnership(..., 'mid')` contract, which 404s on
 * mismatch to avoid leaking the existence of another partner's MID uuid.
 * "Authenticated but the MID isn't yours" is surfaced as not-found by
 * design; the security property under test is "denied + no charge +
 * audited", which holds regardless of 403-vs-404.
 */

const CALLER_PARTNER = 'partner_acme';
const OWN_APPLICATION_ID = '11111111-1111-4111-8111-111111111111';
const OWN_MID_ID = 'mid_owned_by_acme';
const FOREIGN_MID_ID = 'mid_owned_by_globex';

// --- session: always a real account session for partner_acme ---------
vi.mock('@/lib/origin-guard', () => ({
  enforceOrigin: () => null,
}));

const partnerCtx: PartnerContext = {
  partnerId: CALLER_PARTNER,
  brand: 'medpay',
  isAdminOverride: false,
};

// --- ownership: application always owned; mid owned UNLESS foreign ----
const ownershipMock =
  vi.fn<(ctx: PartnerContext, id: string, kind: ResourceKind) => Promise<NextResponse | null>>();

vi.mock('@/lib/server-guards', () => ({
  requirePartnerSession: vi.fn(async () => partnerCtx),
  assertResourceOwnership: (ctx: PartnerContext, id: string, kind: ResourceKind) =>
    ownershipMock(ctx, id, kind),
}));

// --- processor: spy on charge so we can assert it is NEVER called -----
const chargeMock = vi.fn<(req: ChargeRequest) => Promise<unknown>>(async () => ({
  ok: true,
  transactionId: 'txn_test_1',
  status: 'captured',
  declineReason: null,
  feeBreakdown: {
    interchangeCents: 100,
    processorCents: 50,
    perTransactionCents: 10,
    netCents: 160,
  },
}));

vi.mock('@/lib/integrations/registry', () => ({
  getMerchantProcessor: () => ({ charge: chargeMock }),
}));

// --- audit log: capture every row written ----------------------------
const auditRows: WriteAuditLogInput[] = [];
vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: async (input: WriteAuditLogInput) => {
    auditRows.push(input);
  },
}));

import { POST } from './route';

/** A not-found Problem Details response — what assertResourceOwnership
 *  returns for a cross-tenant mid. */
function notFoundMid(): NextResponse {
  return NextResponse.json(
    { type: 'about:blank', title: 'Not Found', status: 404, code: 'mid_not_found' },
    { status: 404 },
  );
}

function buildRequest(midId: string): NextRequest {
  return new NextRequest('http://localhost/api/integrations/micamp/payments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      midId,
      amountCents: 250_00,
      currency: 'USD',
      consumerToken: 'ctok_test_consumer',
      applicationId: OWN_APPLICATION_ID,
    }),
  });
}

describe('POST /api/integrations/micamp/payments — SOC2-C001 MID ownership', () => {
  beforeEach(() => {
    chargeMock.mockClear();
    auditRows.length = 0;
    ownershipMock.mockReset();
    // Default: the application is owned (null = allow). The mid branch is
    // overridden per-test.
    ownershipMock.mockImplementation(async (_ctx, id, kind) => {
      if (kind === 'application' && id === OWN_APPLICATION_ID) return null;
      if (kind === 'mid' && id === OWN_MID_ID) return null;
      if (kind === 'mid' && id === FOREIGN_MID_ID) return notFoundMid();
      // Anything unexpected → fail closed.
      return notFoundMid();
    });
  });

  it('(a) owner can charge through their OWN mid — 201, charge attempted, no denial audit', async () => {
    const res = await POST(buildRequest(OWN_MID_ID));

    expect(res.status).toBe(201);
    // The MID-ownership assertion ran for the caller's own mid...
    expect(ownershipMock).toHaveBeenCalledWith(partnerCtx, OWN_MID_ID, 'mid');
    // ...and the charge actually went to the processor with that mid.
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(chargeMock.mock.calls[0]![0].midId).toBe(OWN_MID_ID);
    // Happy path writes no cross-tenant denial row.
    expect(auditRows).toHaveLength(0);
  });

  it('(b) cross-tenant midId is DENIED — no charge attempted + audit row written', async () => {
    const res = await POST(buildRequest(FOREIGN_MID_ID));

    // Denied (not a 2xx). 404 mirrors the settlement route's anti-
    // enumeration contract for a mid that isn't the caller's.
    expect(res.status).toBe(404);
    expect(res.status).not.toBeLessThan(400);

    // CRITICAL: the processor was never touched. No card was charged
    // through tenant B's MID.
    expect(chargeMock).not.toHaveBeenCalled();

    // The MID-ownership assertion did run for the foreign mid.
    expect(ownershipMock).toHaveBeenCalledWith(partnerCtx, FOREIGN_MID_ID, 'mid');

    // Exactly one durable audit row, capturing the denied cross-tenant
    // charge attempt with the disputed identifiers and no PAN/token.
    expect(auditRows).toHaveLength(1);
    const row = auditRows[0]!;
    expect(row.action).toBe('micamp.charge.denied_cross_tenant_mid');
    expect(row.targetType).toBe('mid');
    expect(row.targetId).toBe(FOREIGN_MID_ID);
    expect(row.actor).toBe(`partner:${CALLER_PARTNER}`);
    expect(row.outcome).toBe('failed');
    expect(row.payload?.applicationId).toBe(OWN_APPLICATION_ID);
    expect(row.payload?.reason).toBe('mid_not_owned_by_caller');
    // Defense-in-depth: the audit payload must not leak the consumer
    // token / PAN proxy.
    expect(JSON.stringify(row.payload)).not.toContain('ctok_test_consumer');
  });

  it('boundary — application owned but mid foreign still denies (app-ownership alone is insufficient)', async () => {
    // Reasserts the exact pre-fix gap: the applicationId check passes
    // (the loan IS the caller's) yet the charge must still be refused
    // because the MONEY would land in another tenant's MID.
    const res = await POST(buildRequest(FOREIGN_MID_ID));
    expect(res.status).toBe(404);
    expect(chargeMock).not.toHaveBeenCalled();
    // Ownership was checked for BOTH the application and the mid.
    expect(ownershipMock).toHaveBeenCalledWith(partnerCtx, OWN_APPLICATION_ID, 'application');
    expect(ownershipMock).toHaveBeenCalledWith(partnerCtx, FOREIGN_MID_ID, 'mid');
  });
});
