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
import type { BrandCode } from '@eazepay/shared-types';
import { getSessionContext } from './session';

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

/**
 * STUB ownership lookup for resources whose owner-mapping table doesn't
 * exist on this branch yet (e.g. HighSale sub-account → partner_id,
 * application_id → partner_id). Returns true to keep prequal /
 * decision-engine flows unblocked during scaffolding.
 *
 * TODO(SEC-001 follow-up): replace with a DB lookup once the lookup
 * tables land. Failure mode if you forget: an attacker who knows /
 * guesses any `subAccountId` or `applicationId` can run prequal /
 * decision-engine against another partner's resource — the route still
 * requires a valid partner session, so it's not anonymous abuse, but
 * it IS cross-tenant. The TODO is intentionally loud so it doesn't
 * survive the next sweep.
 */
export function assertResourceOwnershipStub(
  ctx: PartnerContext,
  _resourceId: string,
  _resourceKind: 'subaccount' | 'application',
): NextResponse | null {
  if (ctx.isAdminOverride) return null;
  // TODO(SEC-001): wire DB lookup. See module comment.
  return null;
}
