/**
 * BFF route guards — single source of truth for "is this caller
 * allowed to hit this route?" decisions.
 *
 * Lives one layer above `lib/session.ts`. `getSessionContext` answers
 * "what kind of session is present?"; this module turns that into a
 * binary go/no-go for specific surface areas (admin vs. partner) and
 * returns a 401 ProblemDetail `NextResponse` when the answer is no.
 *
 * Why this exists (Task #41 / SEC-001): pre-fix, `middleware.ts`
 * exempted ALL `/api/*` paths from the auth fence
 * (`if (pathname.startsWith('/api/')) return true;`). A drive-by GET on
 * `/api/admin/audit` returned the entire platform audit log to an
 * anonymous attacker — including strings like "pending NDA execution"
 * against `ml_in_us_bank`. The middleware now ships a narrow allowlist
 * (health, webhooks, public consumer submit), and every admin /
 * partner-scoped route handler funnels through one of the guards in
 * this file. If the middleware allowlist regresses, the guards still
 * catch it; defense in depth is the point.
 *
 * Usage:
 *
 *   const guard = await requireAdmin(req);
 *   if (guard instanceof NextResponse) return guard;
 *   const { actor, role } = guard;
 *
 *   const guard = await requirePartnerSession(req);
 *   if (guard instanceof NextResponse) return guard;
 *   const { partnerId, brand } = guard;
 */

import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import type { BrandCode } from '@eazepay/shared-types';
import { getSessionContext } from './session';
import { getDb, hasDb, schema } from './db';
import { safeLog } from './safe-log';

export type AdminRole = 'admin' | 'master_admin';

export interface AdminContext {
  /** Stable id of the calling actor, suitable for audit-log `actor`. */
  actor: string;
  role: AdminRole;
}

export interface PartnerContext {
  partnerId: string;
  brand: BrandCode;
  /** True if the session is the master operator demo preset — used by
   *  ownership checks that want to allow admin override (e.g. polling
   *  any partner's provisioning run from the admin queue page). */
  isAdminOverride: boolean;
}

function unauthorized(code: 'not_signed_in' | 'forbidden', detail: string): NextResponse {
  // RFC 7807 problem-details — matches the format used by every other
  // 4xx in this codebase (see app/api/integrations/ez-check/connect).
  const status = code === 'not_signed_in' ? 401 : 403;
  return NextResponse.json(
    {
      type: 'about:blank',
      title: status === 401 ? 'Unauthorized' : 'Forbidden',
      status,
      code,
      detail,
    },
    { status },
  );
}

/**
 * Gate a route to platform admins only.
 *
 * Accepted sessions:
 *   - Demo `master` preset (mapped to `master_admin`). DEMO_MASTER_ENABLED
 *     gates the cookie mint; the verifier here trusts that gate.
 *   - Demo operator presets `admin` / `operator` (mapped to `admin`).
 *     `viewer` / `investor` / `all` are operator-scope but read-only-ish —
 *     we treat them as `admin` because they're already authenticated
 *     against the operator surface; route-level handlers can drop down
 *     to a finer check (e.g. ban POSTs from `viewer`) if they need it.
 *   - Real session (`eazepay_at`): TODO — until `/v1/me` returns the
 *     `master_admin` claim, a real session has no admin role. Fails
 *     closed (403) rather than granting blanket admin to any signed-in
 *     business owner.
 *
 * Account-cookie sessions are never admin: those are partner / teammate
 * sessions scoped to one merchant.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminContext | NextResponse> {
  const session = await getSessionContext(req);

  if (session.mode === 'none') {
    return unauthorized('not_signed_in', 'Sign in to access admin APIs.');
  }

  if (session.mode === 'demo' && session.isOperator) {
    const role: AdminRole = session.preset === 'master' ? 'master_admin' : 'admin';
    return { actor: `demo:${session.preset}`, role };
  }

  // Real-session admin role is deferred until BFF /v1/me ships
  // `{ role: 'master_admin' | 'admin' }`. Fail closed in the meantime —
  // a real session present without claims must NOT be treated as admin.
  return unauthorized('forbidden', 'Admin role required.');
}

/**
 * Gate a route to authenticated partner sessions (or admin override).
 *
 * Accepted sessions:
 *   - Account cookie (real partner / teammate) → returns that partner.
 *   - Demo operator preset → `isAdminOverride: true`, no partnerId.
 *     Caller MUST treat the absence of partnerId as "operator must
 *     specify which partner they're acting on via request body /
 *     query" — never use it as a wildcard.
 *   - Demo brand preset (medpay/tradepay/coachpay) → scoped to its
 *     brand; partnerId is the first roster partner for that brand.
 *     Demo flows have to pick *some* partner to act as, and we keep
 *     the demo experience aligned with the partner-scoped UX.
 *
 * Note: callers that need the demo brand preset to act on a specific
 * partner should fetch by `session.brand` and validate with
 * `assertPartnerOwnership` below.
 */
export async function requirePartnerSession(
  req: NextRequest,
): Promise<PartnerContext | NextResponse> {
  const session = await getSessionContext(req);

  if (session.mode === 'none') {
    return unauthorized('not_signed_in', 'Sign in to access partner APIs.');
  }

  if (session.mode === 'account') {
    return {
      partnerId: session.partnerId,
      brand: session.brand,
      isAdminOverride: false,
    };
  }

  if (session.mode === 'demo' && session.isOperator) {
    // Operator sessions don't carry a single partnerId. Callers either
    // accept "the partnerId in the body is gospel" (and gate via this
    // override flag) or perform a separate lookup. Brand defaults to
    // 'direct' as a sentinel — operator surfaces are cross-brand.
    return { partnerId: '', brand: 'direct', isAdminOverride: true };
  }

  if (session.mode === 'demo' && !session.isOperator && session.brand) {
    // Brand-scoped demo session — used by the brand-portal apply flows.
    // We don't have a single canonical partnerId for the brand; signal
    // brand-scope and let the caller resolve ownership with a lookup.
    // Returning an empty partnerId here would silently pass the equality
    // check below, so we mint a synthetic prefix that NO real partner_id
    // will ever match (slugs are alphanumeric, no leading underscore).
    return { partnerId: `_demo_${session.brand}`, brand: session.brand, isAdminOverride: false };
  }

  // Real session: deferred until BFF /v1/me returns merchantId + brand
  // claims. Until then a bearer-token session can't be scoped — fail
  // closed rather than silently widening visibility.
  return unauthorized(
    'forbidden',
    'Partner session required; real-session brand claims not yet wired.',
  );
}

/**
 * Convenience for the very common "does this partner-owned resource
 * belong to the caller?" check. Returns null on match, or a 403
 * `NextResponse` to return directly.
 *
 * Admin overrides pass through (operators can touch any partner's
 * data; that's the point of the operator demo presets).
 */
export function assertPartnerOwnership(
  ctx: PartnerContext,
  resourcePartnerId: string,
): NextResponse | null {
  if (ctx.isAdminOverride) return null;
  if (ctx.partnerId === resourcePartnerId) return null;
  return unauthorized('forbidden', 'Resource belongs to a different partner.');
}

/** Resource kinds the ownership lookup understands. Adding a new kind
 *  requires (1) a column on a partner-owned table that holds the
 *  partner_id and (2) a branch in `assertResourceOwnership`. */
export type ResourceKind = 'subaccount' | 'application' | 'mid' | 'provisioning_run';

/**
 * Look up the partner that owns a given resource and confirm the
 * caller's session matches. Replaces the SEC-001 stub.
 *
 * Contract:
 *   - On admin override → null (allow). Operators can act on any
 *     partner's resources.
 *   - On ownership match → null (allow).
 *   - On resource not found → 404 Problem Details. We do NOT 403 here
 *     because that would leak the existence of resource ids belonging
 *     to other partners — enumeration risk on UUIDs is low but non-zero
 *     for shorter slugs (e.g. `hs_*` sub-account ids).
 *   - On ownership mismatch → 404 (same payload). Same reasoning:
 *     "exists but not yours" is functionally equivalent to "doesn't
 *     exist" for the caller and avoids the side-channel.
 *   - On no-DB (local dev) → null. The session-gate upstream still
 *     prevents anonymous abuse; the prequal / decision-engine flows
 *     stay walkable in `next dev` without a Postgres service.
 *
 * Lookups are scoped to the partner-portal schema; routes that act on
 * resources owned by other services (e.g. the NestJS billing API) must
 * not use this helper.
 */
export async function assertResourceOwnership(
  ctx: PartnerContext,
  resourceId: string,
  resourceKind: ResourceKind,
): Promise<NextResponse | null> {
  if (ctx.isAdminOverride) return null;
  if (!hasDb()) {
    // Local dev without DATABASE_URL — degrade gracefully. The route
    // still ran requirePartnerSession upstream so the call is at least
    // authenticated. Production deploys always have DATABASE_URL set.
    safeLog.warn({
      event: 'server_guards.ownership.no_db_skip',
      resourceKind,
      resourceId,
      partnerId: ctx.partnerId,
    });
    return null;
  }

  let ownerPartnerId: string | null;
  try {
    ownerPartnerId = await lookupOwnerPartnerId(resourceId, resourceKind);
  } catch (err) {
    safeLog.error({
      event: 'server_guards.ownership.lookup_failed',
      resourceKind,
      resourceId,
      partnerId: ctx.partnerId,
      err: err instanceof Error ? err.message : 'unknown',
    });
    // DB unavailable mid-request — fail closed. 503 vs. 404 is a
    // tradeoff: 503 surfaces the outage to the operator dashboard,
    // 404 hides it from a caller probing for resource existence. We
    // pick 503 because the ownership lookup IS the security boundary
    // and silently 404'ing a real lookup failure would mask attacks.
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        code: 'ownership_lookup_failed',
        detail: 'Ownership lookup temporarily unavailable.',
      },
      { status: 503 },
    );
  }

  if (ownerPartnerId === null) {
    // Either the resource doesn't exist OR it exists but the lookup
    // resolved to a null FK (e.g. provisioning_runs.partner_id after a
    // partner deletion). Both cases collapse to 404 for the caller.
    return notFoundForKind(resourceKind);
  }

  if (ownerPartnerId !== ctx.partnerId) {
    // Cross-tenant — same 404 to avoid leaking existence. We DO emit a
    // structured warn so SOC2 audit can flag enumeration patterns.
    safeLog.warn({
      event: 'server_guards.ownership.mismatch',
      resourceKind,
      resourceId,
      callerPartnerId: ctx.partnerId,
      ownerPartnerId,
    });
    return notFoundForKind(resourceKind);
  }

  return null;
}

/**
 * Per-kind SELECT that returns the owning partner_id, or null if no
 * matching row exists. Kept private so the calling surface stays a
 * single `assertResourceOwnership` entry point.
 */
async function lookupOwnerPartnerId(
  resourceId: string,
  resourceKind: ResourceKind,
): Promise<string | null> {
  const db = getDb();
  switch (resourceKind) {
    case 'application': {
      const rows = await db
        .select({ partnerId: schema.applications.partnerId })
        .from(schema.applications)
        .where(eq(schema.applications.id, resourceId))
        .limit(1);
      return rows[0]?.partnerId ?? null;
    }
    case 'subaccount': {
      const rows = await db
        .select({ partnerId: schema.partnerHighsaleSubaccounts.partnerId })
        .from(schema.partnerHighsaleSubaccounts)
        .where(eq(schema.partnerHighsaleSubaccounts.subaccountId, resourceId))
        .limit(1);
      return rows[0]?.partnerId ?? null;
    }
    case 'mid': {
      const rows = await db
        .select({ partnerId: schema.mids.partnerId })
        .from(schema.mids)
        .where(eq(schema.mids.id, resourceId))
        .limit(1);
      return rows[0]?.partnerId ?? null;
    }
    case 'provisioning_run': {
      const rows = await db
        .select({ partnerId: schema.provisioningRuns.partnerId })
        .from(schema.provisioningRuns)
        .where(eq(schema.provisioningRuns.id, resourceId))
        .limit(1);
      return rows[0]?.partnerId ?? null;
    }
  }
}

/** Kind-specific 404 Problem Details. The `code` lets callers
 *  differentiate without leaking why the lookup failed. */
function notFoundForKind(resourceKind: ResourceKind): NextResponse {
  const code: Record<ResourceKind, string> = {
    application: 'application_not_found',
    subaccount: 'subaccount_not_found',
    mid: 'mid_not_found',
    provisioning_run: 'provision_run_not_found',
  };
  return NextResponse.json(
    {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: code[resourceKind],
    },
    { status: 404 },
  );
}
