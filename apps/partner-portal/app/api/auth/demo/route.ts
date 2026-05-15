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
 * **Production gate:** Demo mode is a sales / onboarding surface, not
 * a production sign-in path. In production we refuse to mint the
 * cookie unless `DEMO_MODE_ENABLED=true` is set explicitly. This
 * prevents an attacker who guesses the cookie name from minting
 * themselves a free read-only session on a live deployment.
 *
 * The preset acts as a brand filter: the topbar brand switcher
 * remembers the choice, the data layer filters to that brand, and
 * write actions are disabled.
 */

/**
 * Whether demo mode is allowed at all. In dev + preview environments
 * we default to allowed; in production the operator must opt-in by
 * setting `DEMO_MODE_ENABLED=true`. This is read at request time (not
 * cached at module init) so a Railway env flip takes effect on the
 * next request without redeploy.
 */
function isDemoModeAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.DEMO_MODE_ENABLED === 'true';
}

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
  // SEC note — `/api/auth/demo` is intentionally NOT CSRF-protected.
  // Like `/api/auth/login`, it's a session-establishing route (no
  // existing session to fixate). The double-submit pattern would
  // require the sign-in page (a public surface that doesn't run
  // session-bound JS) to echo the cookie value as a header, which
  // it doesn't. The actual protection here: `isDemoModeAllowed()`
  // refuses to mint the cookie unless `DEMO_MODE_ENABLED=true` in
  // production, AND the SameSite=Lax flag on the resulting cookie
  // prevents cross-site auto-submission of demo logins from
  // attacker-controlled origins.
  if (!isDemoModeAllowed()) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'demo_mode_disabled',
        detail: 'Demo workspaces are not enabled on this deployment.',
      },
      { status: 403 },
    );
  }

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
