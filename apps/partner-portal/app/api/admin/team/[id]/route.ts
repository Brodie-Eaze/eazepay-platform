import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

/**
 * Per-member update / remove. Proxies to backend; in dev (no token)
 * returns success so optimistic UI sticks.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

const PatchSchema = z
  .object({
    role: z.enum(['master_admin', 'admin', 'underwriter', 'compliance', 'support', 'read_only']).optional(),
    status: z.enum(['active', 'invited', 'disabled']).optional(),
    displayName: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required.' });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  if (!token) return NextResponse.json({ ok: true });
  try {
    const res = await fetch(`${API_URL}/v1/admin/team/${encodeURIComponent(params.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ ok: true });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get('eazepay_at')?.value;
  if (!token) return NextResponse.json({ ok: true });
  try {
    const res = await fetch(`${API_URL}/v1/admin/team/${encodeURIComponent(params.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
