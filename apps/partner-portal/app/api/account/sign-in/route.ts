/**
 * POST /api/account/sign-in
 *
 * Email + password auth for real (non-demo) account holders. Used by
 * the master `/sign-in` page when the user picks a brand and enters
 * credentials.
 *
 * Posture mirrors /api/auth/login + /api/account/set-password:
 *   - Same-origin only via the Origin allow-list (set-cookie auth).
 *   - Tight rate limit (5/min/IP) on the public-facing surface.
 *   - Strict Zod parse.
 *   - Constant-time auth (scrypt runs even on misses — see
 *     authenticate() in accounts-store.ts).
 *   - On success: mint signed account-session cookie; return
 *     { ok, brand, redirectTo }.
 *
 * Why not just reuse /api/auth/login: that route is wired to apps/api
 * for the original consumer/merchant model. The account flow lives in
 * the partner-portal until apps/api lands; this route is the
 * matching entrypoint.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { enforceCsrf } from '../../../../lib/csrf.js';
import { enforce as enforceEdgeRateLimit } from '../../../../lib/edge-rate-limit.js';
import { resolveClientIp } from '../../../../lib/client-ip.js';
import { authenticate } from '../../../../lib/accounts-store';
import { ACCOUNT_COOKIE, signAccountSession } from '../../../../lib/account-cookie';

const BodySchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(128),
    brand: z.enum(['medpay', 'tradepay', 'coachpay']),
  })
  .strict();

const ALLOW_ORIGINS: ReadonlySet<string> = new Set(
  [
    process.env.NEXT_PUBLIC_APP_ORIGIN,
    'http://localhost:3004',
    'http://localhost:3104',
    'http://127.0.0.1:3004',
    'http://127.0.0.1:3104',
  ].filter((s): s is string => Boolean(s)),
);

function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (!origin && !referer) return false;
  const inferred =
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
  if (!inferred) return false;
  return ALLOW_ORIGINS.has(inferred);
}

export async function POST(req: NextRequest) {
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;

  if (!originAllowed(req)) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'origin_not_allowed',
      },
      { status: 403 },
    );
  }

  // SEC-203: rightmost-trusted-hop instead of leftmost-XFF (spoofable).
  const clientIp = resolveClientIp(req);
  const rl = enforceEdgeRateLimit(clientIp);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'rate_limited',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString(),
        },
      },
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
        code: 'invalid_sign_in_payload',
      },
      { status: 400 },
    );
  }

  const account = await authenticate({
    email: parsed.data.email,
    password: parsed.data.password,
    brand: parsed.data.brand,
  });
  if (!account) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        code: 'invalid_credentials',
      },
      { status: 401 },
    );
  }

  const session = await signAccountSession(
    {
      userId: account.userId,
      brand: account.brand,
      partnerId: account.partnerId,
    },
    ACCOUNT_COOKIE.ttlSeconds,
  );
  const response = NextResponse.json({
    ok: true,
    brand: account.brand,
    redirectTo: `/v/${account.brand}`,
  });
  response.cookies.set(ACCOUNT_COOKIE.name, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ACCOUNT_COOKIE.ttlSeconds,
  });
  return response;
}
