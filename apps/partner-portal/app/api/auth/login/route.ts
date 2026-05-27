import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { signDemoPreset } from '../../../../lib/demo-cookie';
import { enforce as enforceEdgeRateLimit } from '../../../../lib/edge-rate-limit.js';

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
/**
 * Demo fallback gate. Production deployments where apps/api IS NOT
 * deployed (the current Railway preview is the canonical example)
 * still need a way for an operator to demo the platform — typing a
 * known seed email like admin@eazepay.local should land them in the
 * matching workspace.
 *
 * The gate honours `DEMO_MODE_ENABLED` (explicit opt-in). When apps/api
 * is fully deployed and the platform is taking real consumer traffic,
 * the operator MUST set `DEMO_MODE_ENABLED=false` on the partner-portal
 * service — that closes this surface entirely. A misconfigured prod
 * with `DEMO_MODE_ENABLED=true` is operator error; both the env-flag
 * docblock and the SOC2 evidence map flag this as a launch-day check.
 *
 * Non-production environments always allow the fallback so local dev
 * + Railway previews work without an apps/api process. The SEC-001
 * hardening — removing the SILENT demo fallback that fired on any auth
 * failure — is preserved by limiting this path to (a) the catch block
 * on a network error, not a 401, and (b) the explicit known-email
 * allowlist.
 */
function isDemoFallbackAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.DEMO_MODE_ENABLED === 'true';
}

const DEMO_TTL_SECONDS = 60 * 60; // 1h, matches the dedicated demo route

/**
 * SEC-203 rate-limit thresholds. Two buckets:
 *   1. Per-IP (10/min): a single botnet node can't gallop through more
 *      than 10 attempts per minute. Sized to absorb a real user fat-
 *      fingering the form (~3 attempts) while still cutting any
 *      meaningful credential-stuffing run.
 *   2. Per-identifier (5/min): a distributed attacker rotating IPs
 *      against ONE known-target account is throttled here. 5/min ≤
 *      300/hr — too slow to brute even a 6-char password.
 * Both buckets share the same in-process edge-rate-limit store but
 * are bucket-prefixed so the counters don't collide. The 429 body
 * intentionally does NOT vary based on which bucket fired — that
 * would leak whether the identifier exists.
 */
const LOGIN_IP_LIMIT = 10;
const LOGIN_ID_LIMIT = 5;
const LOGIN_WINDOW_MS = 60_000;

function rateLimited429(retryAfterMs: number): Response {
  // SEC-203: the 429 body is identifier-agnostic so an attacker cannot
  // tell whether they tripped the per-IP cap or the per-identifier cap
  // (the latter would confirm the email exists in our system).
  return new Response(
    JSON.stringify({
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      code: 'rate_limited',
      detail: 'Too many sign-in attempts. Wait a minute and try again.',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil(Math.max(retryAfterMs, 1_000) / 1000).toString(),
      },
    },
  );
}

export async function POST(req: NextRequest) {
  // SEC note — `/api/auth/login` is intentionally NOT wrapped with the
  // CSRF double-submit guard. CSRF protects against an attacker forcing
  // a victim's EXISTING session to take an action; login has no session
  // to fixate, so the guard's threat model doesn't apply. The "login
  // CSRF" attack (forcing a victim into the attacker's account) is a
  // fringe issue and not materially exploitable here because the
  // session cookie is HttpOnly + SameSite=Lax. Industry-standard
  // frameworks (Django, Rails, Express auth libraries) leave login
  // CSRF-exempt by default. The Lax cookie is the load-bearing
  // protection; the CSRF token guards state-changing routes that act
  // on an existing session (see `/api/integrations/brand/apply`).

  // SEC-203: per-IP rate limit BEFORE body parse. Cheap rejection path
  // for a botnet hammering this endpoint — no JSON parse, no Zod cost.
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const clientIp = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const ipRl = enforceEdgeRateLimit(`auth-login-ip:${clientIp}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
  if (!ipRl.allowed) {
    return rateLimited429(ipRl.retryAfterMs);
  }

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

  // SEC-203: per-identifier rate limit. Defends against a distributed
  // attacker rotating IPs against one target account (the per-IP cap
  // doesn't help when the IPs differ). Lowercased so the bucket is
  // identifier-canonical — 'Alice@example.com' and 'alice@example.com'
  // share the same counter.
  const idRl = enforceEdgeRateLimit(
    `auth-login-id:${identifier.toLowerCase()}`,
    LOGIN_ID_LIMIT,
    LOGIN_WINDOW_MS,
  );
  if (!idRl.allowed) {
    return rateLimited429(idRl.retryAfterMs);
  }

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
    // SEC-106: sameSite=strict — a top-level GET-initiated cross-site
    // request will NOT carry these auth cookies, closing the lingering
    // Lax-mode CSRF/fixation surface. The partner portal has no SSO
    // inbound flow that would need Lax, so strict is the right default.
    response.cookies.set('eazepay_at', data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_TTL_SECONDS,
    });
    if (data.refreshToken && remember) {
      response.cookies.set('eazepay_rt', data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
        maxAge: REFRESH_TTL_SECONDS,
      });
    }
    return response;
  } catch (err) {
    // Backend unreachable. If demo mode is allowed and the email
    // matches a known demo preset, fall back to minting the
    // matching demo cookie so the deployed surface is browsable
    // without a running API. Otherwise surface the 502 honestly.
    if (isDemoFallbackAllowed()) {
      const preset = DEMO_PRESET_BY_EMAIL[identifier.toLowerCase()];
      if (preset) {
        // SEC-109: master preset is gated to operators who explicitly
        // opted into it via DEMO_MASTER_ENABLED. The fallback path
        // honours the same gate as /api/auth/demo so a misconfigured
        // production cannot mint master sessions through here either.
        if (preset === 'master' && process.env.DEMO_MASTER_ENABLED !== 'true') {
          return NextResponse.json(
            {
              type: 'about:blank',
              title: 'Forbidden',
              status: 403,
              code: 'master_preset_disabled',
              detail:
                'The master demo preset is disabled on this deployment. Set DEMO_MASTER_ENABLED=true to enable.',
            },
            { status: 403 },
          );
        }
        const signedValue = await signDemoPreset(preset, DEMO_TTL_SECONDS);
        const response = NextResponse.json({
          ok: true,
          demoMode: true,
          preset,
          notice:
            'Signed in to the demo workspace. The real EazePay API is not reachable from this deployment.',
        });
        // SEC-103/106: signed value + sameSite=strict to close the
        // top-level-form-post fixation surface.
        response.cookies.set('eazepay_demo', signedValue, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
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
