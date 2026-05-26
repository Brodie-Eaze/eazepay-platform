import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { signDemoPreset, _resetDemoCookieKeyCache } from './demo-cookie';
import { signAccountSession, _resetAccountCookieKeyCache } from './account-cookie';

/**
 * Server-guards tests (Task #41 / SEC-001 + Task #51 follow-up).
 *
 * Coverage:
 *   - requireAdmin: anonymous → 401, demo brand → 403, demo master/admin/operator → ok
 *   - requirePartnerSession: anonymous → 401, account → partnerId, operator → admin override
 *   - assertPartnerOwnership: match → null, mismatch → 403, admin override → null
 *   - assertResourceOwnership (new in Task #51 follow-up):
 *       application, subaccount, mid, provisioning_run kinds
 *       match → null, mismatch → 404, not-found → 404, admin override → null,
 *       no-DB → null, lookup error → 503
 */

// ---------------------------------------------------------------------------
// Module-level mocks. `vi.mock` is hoisted, so these must come before
// importing the module under test. The DB mock returns rows from
// per-table maps so each test can wire up its own ownership graph.
// ---------------------------------------------------------------------------

const hasDbMock = vi.fn(() => true);
const lookupRows = new Map<string, { partnerId: string }[]>();
const lookupErrors = new Map<string, Error>();

const dbMock = {
  select: (_columns: unknown) => ({
    from: (table: unknown) => {
      const tableName = inferTableName(table);
      const err = lookupErrors.get(tableName);
      return {
        where: () => ({
          limit: async () => {
            if (err) throw err;
            return lookupRows.get(tableName) ?? [];
          },
        }),
      };
    },
  }),
};

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

import {
  requireAdmin,
  requirePartnerSession,
  assertPartnerOwnership,
  assertResourceOwnership,
  type PartnerContext,
} from './server-guards';

function rawRequest(): NextRequest {
  return new NextRequest('http://localhost:3004/api/admin/audit');
}

async function adminDemoRequest(preset: 'master' | 'admin' | 'operator'): Promise<NextRequest> {
  const signed = await signDemoPreset(preset, 60);
  return new NextRequest('http://localhost:3004/api/admin/audit', {
    headers: { cookie: `eazepay_demo=${signed}` },
  });
}

async function brandDemoRequest(preset: 'medpay' | 'tradepay' | 'coachpay'): Promise<NextRequest> {
  const signed = await signDemoPreset(preset, 60);
  return new NextRequest('http://localhost:3004/api/admin/audit', {
    headers: { cookie: `eazepay_demo=${signed}` },
  });
}

async function accountRequest(
  partnerId: string,
  brand: 'medpay' | 'tradepay' | 'coachpay' = 'medpay',
): Promise<NextRequest> {
  const signed = await signAccountSession({ userId: 'u_1', brand, partnerId }, 60);
  return new NextRequest('http://localhost:3004/api/integrations/highsale/subaccount', {
    headers: { cookie: `eazepay_account=${signed}` },
  });
}

const partnerCtx: PartnerContext = {
  partnerId: 'partner_acme',
  brand: 'medpay',
  isAdminOverride: false,
};

const adminCtx: PartnerContext = {
  partnerId: '',
  brand: 'direct',
  isAdminOverride: true,
};

describe('server-guards', () => {
  beforeEach(() => {
    _resetDemoCookieKeyCache();
    _resetAccountCookieKeyCache();
    process.env.DEMO_COOKIE_SECRET = 'unit-test-secret-x'.padEnd(40, '_');
    process.env.ACCOUNT_COOKIE_SECRET = 'unit-test-account-x'.padEnd(40, '_');
    hasDbMock.mockReturnValue(true);
    lookupRows.clear();
    lookupErrors.clear();
  });

  describe('requireAdmin', () => {
    it('anonymous request returns 401 problem-details', async () => {
      const result = await requireAdmin(rawRequest());
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
        const body = await result.json();
        expect(body.code).toBe('not_signed_in');
      }
    });

    it('demo master preset → master_admin role', async () => {
      const result = await requireAdmin(await adminDemoRequest('master'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.role).toBe('master_admin');
        expect(result.actor).toBe('demo:master');
      }
    });

    it('demo admin preset → admin role', async () => {
      const result = await requireAdmin(await adminDemoRequest('admin'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.role).toBe('admin');
      }
    });

    it('demo brand preset (medpay) is NOT admin → 403', async () => {
      const result = await requireAdmin(await brandDemoRequest('medpay'));
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
        const body = await result.json();
        expect(body.code).toBe('forbidden');
      }
    });

    it('account session (real partner) is NOT admin → 403', async () => {
      const result = await requireAdmin(await accountRequest('partner_acme'));
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
      }
    });
  });

  describe('requirePartnerSession', () => {
    it('anonymous request returns 401', async () => {
      const result = await requirePartnerSession(rawRequest());
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(401);
      }
    });

    it('account session returns the embedded partnerId + brand', async () => {
      const result = await requirePartnerSession(await accountRequest('partner_acme', 'medpay'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.partnerId).toBe('partner_acme');
        expect(result.brand).toBe('medpay');
        expect(result.isAdminOverride).toBe(false);
      }
    });

    it('operator demo session is treated as admin override (no partnerId)', async () => {
      const result = await requirePartnerSession(await adminDemoRequest('master'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.isAdminOverride).toBe(true);
        expect(result.partnerId).toBe('');
      }
    });

    it('brand demo session gets a synthetic non-matching partnerId', async () => {
      const result = await requirePartnerSession(await brandDemoRequest('medpay'));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.brand).toBe('medpay');
        // Demo brand presets must NOT collide with any real partner id —
        // assertPartnerOwnership uses string-equality, so the synthetic
        // value has to start with a character no real slug uses.
        expect(result.partnerId.startsWith('_demo_')).toBe(true);
        expect(result.isAdminOverride).toBe(false);
      }
    });
  });

  describe('assertPartnerOwnership', () => {
    it('returns null on partnerId match', () => {
      expect(assertPartnerOwnership(partnerCtx, 'partner_acme')).toBeNull();
    });

    it('returns 403 NextResponse on partnerId mismatch (cross-tenant)', async () => {
      const res = assertPartnerOwnership(partnerCtx, 'partner_other');
      expect(res).toBeInstanceOf(NextResponse);
      if (res) {
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.code).toBe('forbidden');
      }
    });

    it('admin override bypasses ownership check', () => {
      expect(assertPartnerOwnership(adminCtx, 'partner_acme')).toBeNull();
      expect(assertPartnerOwnership(adminCtx, 'partner_zzz')).toBeNull();
    });

    it('synthetic demo brand partnerId fails ownership against real slug', async () => {
      // Adversarial: a demo brand-preset session sends a request whose
      // body claims partnerId='partner_acme'. The synthetic prefix MUST
      // not equal any real slug, so assertPartnerOwnership returns 403.
      const ctx: PartnerContext = {
        partnerId: '_demo_medpay',
        brand: 'medpay',
        isAdminOverride: false,
      };
      const res = assertPartnerOwnership(ctx, 'partner_acme');
      expect(res).toBeInstanceOf(NextResponse);
      if (res) expect(res.status).toBe(403);
    });
  });

  describe('assertResourceOwnership', () => {
    /**
     * Each kind covers four cases:
     *   ownership match     → null
     *   ownership mismatch  → 404 (NOT 403 — don't leak existence)
     *   not found           → 404 (same payload as mismatch)
     *   admin override      → null (operators bypass)
     * Plus the cross-cutting cases:
     *   no DB               → null (local dev gracefully degraded)
     *   lookup error        → 503 (fail-closed when the security
     *                              boundary itself is unhealthy)
     */
    describe('application', () => {
      it('returns null when partner owns the application', async () => {
        lookupRows.set('applications', [{ partnerId: 'partner_acme' }]);
        const res = await assertResourceOwnership(partnerCtx, 'app_uuid_1', 'application');
        expect(res).toBeNull();
      });

      it('returns 404 when application is owned by another partner', async () => {
        lookupRows.set('applications', [{ partnerId: 'partner_evil' }]);
        const res = await assertResourceOwnership(partnerCtx, 'app_uuid_2', 'application');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) {
          expect(res.status).toBe(404);
          const body = await res.json();
          expect(body.code).toBe('application_not_found');
        }
      });

      it('returns 404 when application does not exist', async () => {
        const res = await assertResourceOwnership(partnerCtx, 'app_missing', 'application');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) {
          expect(res.status).toBe(404);
          const body = await res.json();
          expect(body.code).toBe('application_not_found');
        }
      });

      it('admin override bypasses ownership check (no DB lookup at all)', async () => {
        // Deliberately leave lookupRows empty: an admin override should
        // not even hit the DB, so the 404-on-missing branch should not fire.
        const res = await assertResourceOwnership(adminCtx, 'app_anything', 'application');
        expect(res).toBeNull();
      });
    });

    describe('subaccount', () => {
      it('returns null when partner owns the sub-account', async () => {
        lookupRows.set('partner_highsale_subaccounts', [{ partnerId: 'partner_acme' }]);
        const res = await assertResourceOwnership(partnerCtx, 'hs_sub_1', 'subaccount');
        expect(res).toBeNull();
      });

      it('returns 404 when sub-account is owned by another partner', async () => {
        lookupRows.set('partner_highsale_subaccounts', [{ partnerId: 'partner_evil' }]);
        const res = await assertResourceOwnership(partnerCtx, 'hs_sub_2', 'subaccount');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) {
          expect(res.status).toBe(404);
          const body = await res.json();
          expect(body.code).toBe('subaccount_not_found');
        }
      });

      it('returns 404 when sub-account does not exist', async () => {
        const res = await assertResourceOwnership(partnerCtx, 'hs_sub_missing', 'subaccount');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) expect(res.status).toBe(404);
      });

      it('admin override allows any sub-account id', async () => {
        const res = await assertResourceOwnership(adminCtx, 'hs_sub_anything', 'subaccount');
        expect(res).toBeNull();
      });
    });

    describe('mid', () => {
      it('returns null when partner owns the MID', async () => {
        lookupRows.set('mids', [{ partnerId: 'partner_acme' }]);
        const res = await assertResourceOwnership(partnerCtx, 'mid_uuid_1', 'mid');
        expect(res).toBeNull();
      });

      it('returns 404 when MID is owned by another partner', async () => {
        lookupRows.set('mids', [{ partnerId: 'partner_evil' }]);
        const res = await assertResourceOwnership(partnerCtx, 'mid_uuid_2', 'mid');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) {
          expect(res.status).toBe(404);
          const body = await res.json();
          expect(body.code).toBe('mid_not_found');
        }
      });

      it('returns 404 when MID does not exist', async () => {
        const res = await assertResourceOwnership(partnerCtx, 'mid_missing', 'mid');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) expect(res.status).toBe(404);
      });

      it('admin override allows any midId', async () => {
        const res = await assertResourceOwnership(adminCtx, 'mid_anything', 'mid');
        expect(res).toBeNull();
      });
    });

    describe('provisioning_run', () => {
      it('returns null when partner owns the provisioning run', async () => {
        lookupRows.set('provisioning_runs', [{ partnerId: 'partner_acme' }]);
        const res = await assertResourceOwnership(partnerCtx, 'run_uuid_1', 'provisioning_run');
        expect(res).toBeNull();
      });

      it('returns 404 when provisioning run is owned by another partner', async () => {
        lookupRows.set('provisioning_runs', [{ partnerId: 'partner_evil' }]);
        const res = await assertResourceOwnership(partnerCtx, 'run_uuid_2', 'provisioning_run');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) {
          expect(res.status).toBe(404);
          const body = await res.json();
          expect(body.code).toBe('provision_run_not_found');
        }
      });

      it('returns 404 when provisioning run does not exist', async () => {
        const res = await assertResourceOwnership(partnerCtx, 'run_missing', 'provisioning_run');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) expect(res.status).toBe(404);
      });

      it('admin override allows any runId', async () => {
        const res = await assertResourceOwnership(adminCtx, 'run_anything', 'provisioning_run');
        expect(res).toBeNull();
      });
    });

    describe('cross-cutting concerns', () => {
      it('returns null (gracefully degrades) when DB is not configured', async () => {
        hasDbMock.mockReturnValue(false);
        // No rows wired — would normally 404. With no DB, the gate
        // skips the check (the upstream session is still enforced).
        const res = await assertResourceOwnership(partnerCtx, 'app_x', 'application');
        expect(res).toBeNull();
      });

      it('returns 503 when the DB lookup throws (fail-closed)', async () => {
        // Simulate a Postgres connection drop mid-request. We DO NOT
        // want a 404 here — that would mask a real failure of the
        // security boundary. 503 surfaces the outage to ops.
        lookupErrors.set('applications', new Error('pg pool exhausted'));
        const res = await assertResourceOwnership(partnerCtx, 'app_err', 'application');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) {
          expect(res.status).toBe(503);
          const body = await res.json();
          expect(body.code).toBe('ownership_lookup_failed');
        }
      });

      it('admin override bypasses even with no DB configured', async () => {
        hasDbMock.mockReturnValue(false);
        const res = await assertResourceOwnership(adminCtx, 'app_x', 'application');
        expect(res).toBeNull();
      });

      it('uses string-equality on partnerId — synthetic demo brand fails real ownership', async () => {
        // Adversarial: a demo brand-preset session calls a route whose
        // resource is owned by a real partner. The synthetic '_demo_*'
        // partnerId must not collide with any real slug.
        const ctx: PartnerContext = {
          partnerId: '_demo_medpay',
          brand: 'medpay',
          isAdminOverride: false,
        };
        lookupRows.set('applications', [{ partnerId: 'partner_acme' }]);
        const res = await assertResourceOwnership(ctx, 'app_real', 'application');
        expect(res).toBeInstanceOf(NextResponse);
        if (res) expect(res.status).toBe(404);
      });
    });
  });
});
