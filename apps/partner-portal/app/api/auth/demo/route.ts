import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

/**
 * Demo workspace bootstrap. Sets a single `eazepay_demo` cookie that
 * carries the chosen preset (tradepay / medpay / coachpay / all /
 * master). Middleware treats this cookie as proof of a read-only
 * demo session — distinct from a real signed-in session, surfaced
 * with a banner so demo users can never mistake the workspace for
 * production.
 *
 * The preset acts as a brand filter: the topbar brand switcher
 * remembers the choice, the data layer filters to that brand, and
 * write actions are disabled.
 */

/**
 * Two preset families:
 *  - Role-based (admin/operator/viewer/investor) — the "EazePay
 *    Intelligence" quick-switch grid on the sign-in page.
 *  - Brand-based (tradepay/medpay/coachpay) — retained so the demo
 *    routes that still pre-filter by vertical keep working.
 *  - all / master — legacy aliases for the master command centre.
 */
const BodySchema = z.object({
  preset: z.enum([
    'admin',
    'operator',
    'viewer',
    'investor',
    'tradepay',
    'medpay',
    'coachpay',
    'all',
    'master',
  ]),
});

const DEMO_TTL_SECONDS = 60 * 60; // 1h

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_preset',
        detail: 'Unknown demo preset.',
      },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true, preset: parsed.data.preset });
  response.cookies.set('eazepay_demo', parsed.data.preset, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_TTL_SECONDS,
  });
  return response;
}
