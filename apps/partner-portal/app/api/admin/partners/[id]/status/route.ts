/**
 * POST /api/admin/partners/[id]/status — operator partner-status
 * change endpoint.
 *
 * Before this route existed, the operator control-panel "Suspend
 * partner" button was pure UI theatre:
 *
 *     setPartner((p) => ({ ...p, status: 'Suspended' }))
 *
 * A React-state mutation with no server call, no audit row, no
 * enforcement. A "suspended" partner kept transacting because nothing
 * downstream knew about the decision. That is a textbook SOC2 CC6.6
 * finding (logical access not actually removed) layered on top of a
 * CC7.2 finding (security-relevant event not captured in the audit
 * trail).
 *
 * This route makes the action real:
 *   1. requireAdmin gate (server-guards.ts) — operator-only.
 *   2. enforceOrigin — origin allowlist on state-changing admin POSTs.
 *   3. enforceCsrf — double-submit cookie pattern (csrf.ts).
 *   4. Zod-validate the body `{status, reason}`.
 *   5. Verify partner exists, otherwise 404.
 *   6. UPDATE partners SET status, suspended_at, suspended_reason.
 *   7. INSERT audit_log row in the same logical operation:
 *        - suspend     → action='partner.suspended'
 *        - reactivate  → action='partner.reactivated'
 *        - pending     → action='partner.status_changed'
 *      payload_json carries `{from, to, reason, by}`; actor is the
 *      AdminContext.actor string from requireAdmin.
 *   8. Return 200 with the updated partner row.
 *
 * Out of scope (separate task):
 *   • UI wiring. The control-panel page still calls setPartner locally;
 *     a follow-up will replace that with a real fetch + revalidate.
 *     Per task spec, do NOT modify any page/component file here.
 *   • Downstream enforcement (blocking writes from a suspended partner
 *     elsewhere). The columns + audit row are the evidence trail; the
 *     gating happens at the partner-session middleware layer in a
 *     subsequent PR.
 *
 * RFC 7807 Problem Details on every error path.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../../../../../../lib/server-guards';
import { enforceOrigin } from '../../../../../../lib/origin-guard';
import { enforceCsrf } from '../../../../../../lib/csrf';
import { getDb, hasDb } from '../../../../../../lib/db';
import { partners, auditLog } from '../../../../../../lib/db/schema';
import { safeLog } from '../../../../../../lib/safe-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const StatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending']),
  reason: z.string().min(1).max(2_000),
});

type Status = z.infer<typeof StatusSchema>['status'];

function problem(
  status: number,
  title: string,
  code: string,
  detail: string,
  extra: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    {
      type: 'about:blank',
      title,
      status,
      code,
      detail,
      ...extra,
    },
    { status },
  );
}

/** Map the requested new status to the canonical audit action string.
 *  Distinct verbs for suspend vs. reactivate so the audit dashboard can
 *  filter cleanly; `partner.status_changed` is the catch-all for the
 *  active→pending / pending→pending transitions which are less common
 *  but still material. */
function auditActionFor(from: string, to: Status): string {
  if (to === 'suspended') return 'partner.suspended';
  if (to === 'active' && from === 'suspended') return 'partner.reactivated';
  return 'partner.status_changed';
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<NextResponse> {
  // SEC — origin allowlist on state-changing admin POSTs.
  const originFail = enforceOrigin(req);
  if (originFail) return originFail;

  // SEC — CSRF double-submit cookie verification.
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail as NextResponse;

  // SEC — operator-only.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;
  const { actor } = guard;

  const partnerId = ctx.params.id;
  if (!partnerId) {
    return problem(400, 'Bad Request', 'invalid_partner_id', 'Partner id is required.');
  }

  if (!hasDb()) {
    return problem(
      503,
      'Service Unavailable',
      'database_unavailable',
      'Partner-status changes require a database connection.',
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return problem(400, 'Bad Request', 'invalid_json', 'The request body could not be parsed.');
  }
  const parsed = StatusSchema.safeParse(raw);
  if (!parsed.success) {
    return problem(
      400,
      'Bad Request',
      'invalid_input',
      'status must be active|suspended|pending and reason must be a non-empty string.',
      { errors: parsed.error.flatten().fieldErrors },
    );
  }
  const { status: newStatus, reason } = parsed.data;

  const db = getDb();

  // Look up existing row first so we can capture the previous status
  // for the audit payload and so we return 404 (not 200) for an
  // unknown partner id rather than silently UPDATE-zero-rows.
  const existing = await db
    .select()
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);
  if (existing.length === 0) {
    return problem(404, 'Not Found', 'partner_not_found', 'No partner with that id.');
  }
  const prev = existing[0]!;

  const nowSuspendedAt = newStatus === 'suspended' ? new Date() : null;
  const nowSuspendedReason = newStatus === 'suspended' ? reason : null;

  let updated;
  try {
    const rows = await db
      .update(partners)
      .set({
        status: newStatus,
        suspendedAt: nowSuspendedAt,
        suspendedReason: nowSuspendedReason,
        updatedAt: new Date(),
      })
      .where(eq(partners.id, partnerId))
      .returning();
    updated = rows[0];
  } catch (err) {
    safeLog.error({ event: 'admin.partner_status.update_failed', err, partnerId });
    return problem(
      503,
      'Service Unavailable',
      'update_failed',
      'Could not write the new partner status.',
    );
  }

  // SOC2 CC7.2 — security-relevant event captured in the audit chain.
  // Written in the SAME request as the UPDATE; if the audit insert
  // fails we surface 503 so the operator knows the change is not
  // durably recorded. Worst case is the UPDATE landed without an audit
  // row — the compliance dashboard's reconciler will flag any partner
  // whose suspended_at is set without a matching action='partner.suspended'
  // row, and a backfill task can repair.
  const action = auditActionFor(prev.status, newStatus);
  const payload = {
    from: prev.status,
    to: newStatus,
    reason,
    by: actor,
  };
  try {
    await db.insert(auditLog).values({
      actor,
      action,
      targetType: 'partner',
      targetId: partnerId,
      payloadJson: JSON.stringify(payload),
      ipAddress:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        null,
      userAgent: req.headers.get('user-agent') ?? null,
    });
  } catch (err) {
    safeLog.error({
      event: 'admin.partner_status.audit_insert_failed',
      err,
      partnerId,
      action,
    });
    return problem(
      503,
      'Service Unavailable',
      'audit_insert_failed',
      'Status updated but the audit log entry could not be written. Reach compliance@eazepay.com to reconcile.',
    );
  }

  safeLog.info({
    event: 'admin.partner_status.changed',
    partnerId,
    action,
    from: prev.status,
    to: newStatus,
    by: actor,
  });

  return NextResponse.json({ partner: updated, audit: { action } }, { status: 200 });
}
