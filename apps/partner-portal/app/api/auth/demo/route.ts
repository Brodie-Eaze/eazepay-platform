import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { signDemoPreset } from '../../../../lib/demo-cookie';

/**
 * Demo workspace bootstrap.
 *
 * SEC-103 + SEC-109 hardening (this file's threat model):
 *
 *   1. **Same-origin only.** Pre-fix, this route accepted POSTs from
 *      any origin. Combined with `SameSite=Lax` on the resulting
 *      cookie, a phishing page could `<form action="/api/auth/demo"
 *      method="POST">` and fix `eazepay_demo=master` in the victim's
 *      browser. The victim's next legitimate visit would then resolve
 *      as a master admin. Fixed by an `Origin` / `Referer` allow-list
 *      check.
 *
 *   2. **Signed cookie value.** The cookie value is now an HMAC-signed
 *      payload (`signDemoPreset`). A forged value — set by a malicious
 *      browser extension or rogue subdomain — fails verification and
 *      the session reader treats the cookie as absent.
 *
 *   3. **Master preset opt-in.** The `master` preset unlocks
 *      `isAdmin:true` (per /api/auth/session/route.ts). It is now
 *      gated behind `DEMO_MASTER_ENABLED=true`, defaulting to disabled
 *      in every environment. An operator who wants to demo the master
 *      OS must explicitly flip the env. The other operator-tier presets
 *      (`admin`, `operator`, `viewer`, `investor`, `all`) remain
 *      available — they don't carry `isAdmin:true`.
 *
 *   4. **CSRF.** This route is still NOT wrapped in `enforceCsrf`
 *      (no prior session to fixate); the Origin check is the
 *      load-bearing protection. See the per-call rationale below.
 *
 * The preset acts as a brand filter: the topbar brand switcher
 * remembers the choice, the data layer filters to that brand, and
 * write actions are disabled.
 */

function isDemoModeAllowed(): boolean {
  return process.env.DEMO_MODE_ENABLED !== 'false';
}

/** Default-deny gate for the `master` preset (SEC-109). */
function isMasterPresetAllowed(): boolean {
  return process.env.DEMO_MASTER_ENABLED === 'true';
}

/**
 * Allow-list of origins that may POST to this route. Includes the
 * deployed domain(s) read from `NEXT_PUBLIC_APP_ORIGIN`, plus localhost
 * (any port) in non-production. The check runs against `Origin` first
 * and falls back to the host portion of `Referer` for clients that
 * strip Origin (rare; mostly older Safari with stricter referer policy).
 */
function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const allowed = buildAllowList();
  const inferredOrigin =
    origin ??
    (() => {
      if (!referer) return null;
      try {
        const u = new URL(referer);
        return `${u.protocol}//${u.host}`;
      } catch {
        return null;
      }
    })();
  if (!inferredOrigin) return false;
  return allowed.has(inferredOrigin);
}

function buildAllowList(): Set<string> {
  const set = new Set<string>();
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (configured) set.add(configured.replace(/\/$/, ''));
  // Always allow the request's own host in non-production so local
  // dev (localhost:3104, etc.) keeps working without an env value.
  if (process.env.NODE_ENV !== 'production') {
    set.add('http://localhost:3000');
    set.add('http://localhost:3004');
    set.add('http://localhost:3104');
    set.add('http://127.0.0.1:3000');
    set.add('http://127.0.0.1:3004');
    set.add('http://127.0.0.1:3104');
  }
  return set;
}

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

  // SEC-103: reject cross-origin POSTs before doing anything else. This
  // is the load-bearing CSRF protection for this route. Lives in front
  // of body parsing so an unauthorised origin gets a uniform deny.
  if (!isAllowedOrigin(req)) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'origin_not_allowed',
        detail: 'Cross-origin requests are not permitted on /api/auth/demo.',
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

  // SEC-109: master preset requires explicit env opt-in. Defaults to
  // disabled so a misconfigured or default deployment cannot mint a
  // master-admin demo session.
  if (parsed.data.preset === 'master' && !isMasterPresetAllowed()) {
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

  const signedValue = await signDemoPreset(parsed.data.preset, DEMO_TTL_SECONDS);
  const response = NextResponse.json({ ok: true, preset: parsed.data.preset });
  response.cookies.set('eazepay_demo', signedValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // SEC-106: SameSite=strict — a top-level GET-initiated cross-site
    // request will NOT carry this cookie, closing the lingering Lax-mode
    // session-fixation surface. Strict is safe here because the demo
    // cookie is never the target of an SSO inbound link.
    sameSite: 'strict',
    path: '/',
    maxAge: DEMO_TTL_SECONDS,
  });
  return response;
}
