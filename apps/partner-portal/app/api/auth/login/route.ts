import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { enforceCsrf } from '../../../../lib/csrf.js';

/**
 * Sign-in proxy. The browser never talks to the backend directly so we
 * can hold the JWT pair as HttpOnly cookies, which is the only safe
 * place to keep them.
 *
 * Flow:
 *  1. Parse + validate the body.
 *  2. POST to the backend's `/v1/auth/login` with the user-supplied
 *     credentials.
 *  3. On success, write two HttpOnly cookies:
 *       - `eazepay_at`  access token, short TTL
 *       - `eazepay_rt`  refresh token, long TTL (only if `remember` was set)
 *  4. Return `{ ok: true }`. The client decides where to redirect.
 *
 * On failure we surface the backend's RFC 7807 problem body 1:1 so
 * the form can show a specific message (e.g. invalid_credentials,
 * account_locked, mfa_required, …).
 */

const BodySchema = z.object({
  identifier: z.string().email().or(z.string().min(3)),
  password: z.string().min(1),
  remember: z.boolean().optional().default(false),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';
const ACCESS_TTL_SECONDS = 60 * 60; // 1h
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30d

/**
 * Demo fallback is non-production-only by hard guard, not by env flag,
 * so a misconfigured production deploy cannot accidentally enable it.
 *
 * SEC-001 hardening (final): previously the fallback was gated on
 * `DEMO_MODE_ENABLED=true`, which meant a single env-var typo in a
 * Railway dashboard could flip a production deployment into a state
 * where any password against `admin@eazepay.local` would mint an
 * `eazepay_demo` cookie bypassing real authentication. Hardening the
 * gate to `process.env.NODE_ENV !== 'production'` — read at the top of
 * the file and short-circuited inside the catch — removes the
 * env-flag override entirely from the production code path. The
 * dedicated /api/auth/demo endpoint retains its `DEMO_MODE_ENABLED`
 * gate because that surface is an explicit operator opt-in, not an
 * unattended fallback.
 *
 * Demo presets remain wired in case the `next dev` and CI surfaces
 * want them; the constant table stays in this file so test fixtures
 * can keep referencing it.
 */
const DEMO_PRESET_BY_EMAIL: Record<string, string> = {
  'admin@eazepay.local': 'admin',
  'admin@eazepay.com': 'admin',
  'operator@eazepay.local': 'operator',
  'master@eazepay.local': 'master',
  'master@eazepay.com': 'master',
  'medpay@eazepay.local': 'medpay',
  'tradepay@eazepay.local': 'tradepay',
  'coachpay@eazepay.local': 'coachpay',
};

/**
 * Hard build-time guard. `IS_PRODUCTION` is captured once at module
 * load time — the value reflects the deployment's NODE_ENV and cannot
 * be flipped at request time by an env-var change in the dashboard.
 * Any future code path that wants to use the demo fallback must call
 * `isDemoFallbackAllowed()` AFTER this guard, so the production exit
 * dominates regardless of caller order.
 */
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function isDemoFallbackAllowed(): boolean {
  // Production deployments NEVER take the demo fallback. The
  // DEMO_MODE_ENABLED env flag is intentionally NOT consulted here —
  // see SEC-001 hardening note above.
  if (IS_PRODUCTION) return false;
  return true;
}

const DEMO_TTL_SECONDS = 60 * 60; // 1h, matches the dedicated demo route

export async function POST(req: NextRequest) {
  // SEC — CSRF double-submit guard. Even though the login form has no
  // authenticated session yet, the sign-in page is a HTML GET that
  // mints the cookie via middleware, so a legitimate browser-side
  // form always carries the matching header. A cross-site attacker
  // who tries to mint a session by forging a POST cannot read the
  // Secure + SameSite=Strict cookie to echo it, so the guard fires.
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_input',
        detail: 'Email and password are required.',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { identifier, password, remember } = parsed.data;
  const forwarded = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;

  try {
    const res = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(forwarded ? { 'X-Forwarded-For': forwarded } : {}),
        ...(userAgent ? { 'User-Agent': userAgent } : {}),
      },
      body: JSON.stringify({ identifier, password, deviceId: 'partner-portal-web' }),
    });

    if (!res.ok) {
      // Pass through the problem-details envelope so the form can
      // localise. Strip headers that shouldn't leak.
      const body = await res.json().catch(() => ({
        type: 'about:blank',
        title: 'Sign-in failed',
        status: res.status,
        code: 'sign_in_failed',
      }));
      return NextResponse.json(body, { status: res.status });
    }

    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
      mfaRequired?: boolean;
      challenge?: { challengeId: string };
    };

    // If MFA is required, surface the challenge id so the client can
    // redirect to /verify-otp. We don't set tokens yet.
    if (data.mfaRequired && data.challenge) {
      return NextResponse.json({
        ok: true,
        mfaRequired: true,
        challengeId: data.challenge.challengeId,
      });
    }

    if (!data.accessToken) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Server error',
          status: 502,
          code: 'malformed_backend_response',
          detail: 'Backend did not return an access token.',
        },
        { status: 502 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set('eazepay_at', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TTL_SECONDS,
    });
    if (data.refreshToken && remember) {
      response.cookies.set('eazepay_rt', data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: REFRESH_TTL_SECONDS,
      });
    }
    return response;
  } catch (err) {
    // SEC-001 hardening — line below is the load-bearing guard. The
    // production short-circuit dominates `isDemoFallbackAllowed()`
    // even if some future change weakens that function, because the
    // hard-return below leaves no syntactic path through to the
    // fallback cookie issue.
    if (IS_PRODUCTION) {
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Backend unreachable',
          status: 502,
          code: 'backend_unreachable',
          detail: 'Could not reach the EazePay API.',
        },
        { status: 502 },
      );
    }

    // Backend unreachable. Non-prod only: if demo mode is allowed and
    // the email matches a known demo preset, fall back to minting the
    // matching demo cookie so the deployed surface is browsable
    // without a running API. Otherwise surface the 502 honestly.
    if (isDemoFallbackAllowed()) {
      const preset = DEMO_PRESET_BY_EMAIL[identifier.toLowerCase()];
      if (preset) {
        const response = NextResponse.json({
          ok: true,
          demoMode: true,
          preset,
          notice:
            'Signed in to the demo workspace. The real EazePay API is not reachable from this deployment.',
        });
        response.cookies.set('eazepay_demo', preset, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: DEMO_TTL_SECONDS,
        });
        return response;
      }
    }

    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Backend unreachable',
        status: 502,
        code: 'backend_unreachable',
        detail:
          'Could not reach the EazePay API. Try a demo preset instead, or use one of the known demo emails (admin@eazepay.local, master@eazepay.local).',
      },
      { status: 502 },
    );
  }
}
