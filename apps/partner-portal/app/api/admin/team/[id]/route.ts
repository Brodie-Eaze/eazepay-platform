import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server-guards';

/**
 * Per-member update / remove. Proxies to backend.
 *
 * SEC-107: pre-fix, no-token PATCH/DELETE returned `{ok: true}` so
 * "optimistic UI sticks". That's a lie — and a dangerous one once a
 * cache/replay surface ever syncs the response. Now returns 401 unless
 * `ALLOW_OPTIMISTIC_BFF=true` (dev-only opt-in, defaults false).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

const PatchSchema = z
  .object({
    role: z
      .enum(['master_admin', 'admin', 'underwriter', 'compliance', 'support', 'read_only'])
      .optional(),
    status: z.enum(['active', 'invited', 'disabled']).optional(),
    displayName: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required.' });

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

function backendUnreachable(): NextResponse {
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // SEC-001: admin-only.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const token = req.cookies.get('eazepay_at')?.value;
  const raw = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_input',
        errors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  if (!token) {
    if (optimisticBffAllowed()) return NextResponse.json({ ok: true });
    return unauthorized();
  }
  try {
    const res = await fetch(`${API_URL}/v1/admin/team/${encodeURIComponent(params.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok)
      return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return backendUnreachable();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // SEC-001: admin-only.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const token = req.cookies.get('eazepay_at')?.value;
  if (!token) {
    if (optimisticBffAllowed()) return NextResponse.json({ ok: true });
    return unauthorized();
  }
  try {
    const res = await fetch(`${API_URL}/v1/admin/team/${encodeURIComponent(params.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok)
      return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    return NextResponse.json({ ok: true });
  } catch {
    return backendUnreachable();
  }
}
