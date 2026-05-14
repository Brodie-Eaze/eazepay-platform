import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

/**
 * Internal-team list + invite. Proxies to backend `/v1/admin/team`
 * when an access token is present; otherwise returns an empty list so
 * the page renders from its seed data in development.
 *
 * The endpoint is master-admin-only on the backend; this proxy adds
 * no authz of its own — the backend is the source of truth.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

const InviteSchema = z.object({
  displayName: z.string().optional().default(''),
  email: z.string().email(),
  role: z.enum(['master_admin', 'admin', 'underwriter', 'compliance', 'support', 'read_only']),
});

export async function GET(req: NextRequest) {
  const token = req.cookies.get('eazepay_at')?.value;
  if (!token) return NextResponse.json({ members: [] });
  try {
    const res = await fetch(`${API_URL}/v1/admin/team`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return NextResponse.json({ members: [] });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ members: [] });
  }
}

export async function POST(req: NextRequest) {
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
    // No-op success so optimistic UI is consistent in dev.
    return NextResponse.json({ ok: true });
  }
  try {
    const res = await fetch(`${API_URL}/v1/admin/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ ok: true });
  }
}
