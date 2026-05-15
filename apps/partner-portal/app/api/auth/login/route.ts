import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

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
 * Demo-mode email→preset map. When `DEMO_MODE_ENABLED=true` (e.g. on
 * the Railway preview where `apps/api` is not yet deployed) and the
 * backend is unreachable, the login proxy falls back to minting the
 * matching demo preset cookie so the deployed surface is browsable
 * without a running API. Real production deployments leave
 * `DEMO_MODE_ENABLED=false` so this path is never reachable and the
 * 502 surfaces honestly.
 *
 * Any password is accepted in demo mode — the cookie carries no JWT,
 * it is a read-only navigation marker (see /app/api/auth/demo/route.ts
 * for the SEC-001 hardening that gates this on DEMO_MODE_ENABLED).
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

function isDemoFallbackAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.DEMO_MODE_ENABLED === 'true';
}

const DEMO_TTL_SECONDS = 60 * 60; // 1h, matches the dedicated demo route

export async function POST(req: NextRequest) {
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
    // Backend unreachable. If demo mode is on and the email matches a
    // known demo preset, fall back to minting the matching demo cookie
    // so the deployed surface is browsable without a running API.
    // Otherwise surface the 502 honestly so the operator knows the
    // API isn't reachable.
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
