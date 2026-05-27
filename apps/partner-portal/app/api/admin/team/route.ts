import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server-guards';
import { enforceOrigin } from '@/lib/origin-guard';
import { writeAuditLog } from '@/lib/audit-log';
import { safeLog } from '@/lib/safe-log';

/**
 * Internal-team list + invite. Proxies to backend `/v1/admin/team`
 * when an access token is present.
 *
 * SEC-107 hardening: pre-fix, the no-token path returned `{ok: true}`
 * ("optimistic UI in dev"). In production, that lied — a demo session
 * or unauthenticated caller could POST `{email:'x@y', role:'master_admin'}`
 * and receive a 200 even though no backend write happened. Once the
 * backend is wired and any cache/replay surface ever syncs that
 * response, the lie becomes truth.
 *
 * Policy:
 *   - Real session (`eazepay_at` cookie): proxy to backend as before.
 *   - No token: return 401 not_signed_in in production. The legacy
 *     optimistic behaviour is now gated on `ALLOW_OPTIMISTIC_BFF=true`
 *     for explicit dev opt-in (defaults false everywhere). The page can
 *     still render its seed data on a 401 — it doesn't depend on
 *     the route lying.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

const InviteSchema = z.object({
  displayName: z.string().optional().default(''),
  email: z.string().email(),
  role: z.enum(['master_admin', 'admin', 'underwriter', 'compliance', 'support', 'read_only']),
});

function optimisticBffAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_OPTIMISTIC_BFF === 'true';
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    {
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      code: 'not_signed_in',
    },
    { status: 401 },
  );
}

export async function GET(req: NextRequest) {
  // SEC-001: admin-only. The optimistic-BFF dev fallback below stays
  // for explicit `ALLOW_OPTIMISTIC_BFF=true` opt-in, but it now runs
  // only AFTER the admin gate — no anonymous reads of the team list.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const token = req.cookies.get('eazepay_at')?.value;
  if (!token) {
    if (optimisticBffAllowed()) return NextResponse.json({ members: [] });
    return unauthorized();
  }
  try {
    const res = await fetch(`${API_URL}/v1/admin/team`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // SILENT-FAIL FIX: previously returned empty members list without
      // a log — admin saw "no team members" with no signal that the
      // backend was misbehaving. Log + still return empty so the UI
      // degrades gracefully.
      safeLog.error({
        event: 'admin_team.proxy_non_ok',
        status: res.status,
      });
      return NextResponse.json({ members: [] });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    // SILENT-FAIL FIX: backend unreachable. Log so an operator can tell
    // an empty list is "API down" not "no members".
    safeLog.error({
      event: 'admin_team.proxy_failed',
      err,
    });
    return NextResponse.json({ members: [] });
  }
}

export async function POST(req: NextRequest) {
  // SEC-010: origin allowlist on state-changing admin POSTs.
  const originFail = enforceOrigin(req);
  if (originFail) return originFail;

  // SEC-001: admin-only.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const token = req.cookies.get('eazepay_at')?.value;
  const raw = await req.json().catch(() => null);
  const parsed = InviteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_input',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  if (!token) {
    if (optimisticBffAllowed()) return NextResponse.json({ ok: true });
    return unauthorized();
  }

  /* SOC2 CC8.1: every team-membership mutation MUST land in audit_log.
   * Payload includes the invitation target email + requested role so a
   * reviewer can reconstruct the change without joining other tables.
   * Email is the invitation target itself — redacting it would defeat
   * the audit's purpose — but it is not free-form user PII. */
  const auditBase = {
    actor: guard.actor,
    action: 'team.member.added' as const,
    targetType: 'team_member' as const,
    payload: {
      email: parsed.data.email,
      role: parsed.data.role,
      displayName: parsed.data.displayName,
    },
    req,
  };

  try {
    const res = await fetch(`${API_URL}/v1/admin/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      await writeAuditLog({
        ...auditBase,
        targetId: null,
        outcome: 'failed',
        payload: { ...auditBase.payload, status: res.status, error: body },
      });
      return NextResponse.json(body, { status: res.status });
    }
    const body = await res.json();
    const memberId = typeof body?.id === 'string' ? body.id : null;
    await writeAuditLog({
      ...auditBase,
      targetId: memberId,
      outcome: 'success',
      payload: { ...auditBase.payload, after: body },
    });
    return NextResponse.json(body);
  } catch (err) {
    await writeAuditLog({
      ...auditBase,
      targetId: null,
      outcome: 'failed',
      payload: {
        ...auditBase.payload,
        error: err instanceof Error ? err.message : 'unknown',
      },
    });
    // Backend unreachable. Don't lie: return 502 so the client doesn't
    // think the invite landed.
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Backend unreachable',
        status: 502,
        code: 'backend_unreachable',
      },
      { status: 502 },
    );
  }
}
