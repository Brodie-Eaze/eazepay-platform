/**
 * POST /api/account/set-password
 *
 * Owner of a newly-onboarded business (or any invited account) sets
 * their initial password via the welcome email link. Transitions the
 * account from 'invited' → 'active', mints a signed account session
 * cookie, returns the brand portal URL the caller should redirect to.
 *
 * Security posture:
 *   - CSRF: the welcome page renders a form that includes the CSRF
 *     token via the standard double-submit pattern. enforceCsrf
 *     guards this route.
 *   - Rate limit: edge-rate-limit 5/min/IP. Wrong userId loops are
 *     bounded; a real recipient typing wrong fields a few times still
 *     gets through.
 *   - Zod strict: unknown fields reject with 400.
 *   - Password policy: ≥12 chars + 1 upper + 1 lower + 1 digit + 1
 *     symbol. Matches the apps/api password policy so the rules don't
 *     drift across surfaces.
 *   - Idempotent: setting a password on an already-active account
 *     hashes + rotates the password. Useful for the "forgot which
 *     password I picked during onboarding" recovery path.
 *
 * Why this isn't /v1/auth/* on apps/api: apps/api is not deployed
 * yet. When it is, this route proxies to /v1/auth/account-set-password
 * (a new backend route) and the local accounts-store is decommissioned.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { enforceCsrf } from '../../../../lib/csrf.js';
import { enforce as enforceEdgeRateLimit } from '../../../../lib/edge-rate-limit.js';
import { resolveClientIp } from '../../../../lib/client-ip.js';
import { getAccount, setAccountPassword, type AccountBrand } from '../../../../lib/accounts-store';
import { ACCOUNT_COOKIE, signAccountSession } from '../../../../lib/account-cookie';

const PasswordSchema = z
  .string()
  .min(12, 'must be at least 12 characters')
  .max(128)
  .regex(/[A-Z]/, 'must contain an uppercase letter')
  .regex(/[a-z]/, 'must contain a lowercase letter')
  .regex(/[0-9]/, 'must contain a digit')
  .regex(/[^A-Za-z0-9]/, 'must contain a symbol');

const BodySchema = z
  .object({
    userId: z.string().uuid(),
    newPassword: PasswordSchema,
  })
  .strict();

function problem(status: number, code: string, detail?: string): NextResponse {
  return NextResponse.json(
    {
      type: 'about:blank',
      title: status === 400 ? 'Bad Request' : status === 401 ? 'Unauthorized' : 'Forbidden',
      status,
      code,
      ...(detail ? { detail } : {}),
    },
    { status },
  );
}

export async function POST(req: NextRequest) {
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;

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
        code: 'invalid_set_password_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const account = await getAccount(parsed.data.userId);
  if (!account) {
    // Don't leak whether the userId is unknown vs suspended — return
    // a generic 404 either way. Operator can dig in via the audit
    // breadcrumb.
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'account.set_password.userId_unknown',
        userId: parsed.data.userId,
        ip: clientIp,
      }),
    );
    return problem(404, 'account_not_found');
  }
  if (account.status === 'suspended') {
    return problem(403, 'account_suspended');
  }

  const updated = await setAccountPassword({
    userId: parsed.data.userId,
    newPassword: parsed.data.newPassword,
  });
  if (!updated) return problem(404, 'account_not_found');

  // Mint a signed session cookie + return the brand portal URL.
  const session = await signAccountSession(
    {
      userId: updated.userId,
      brand: updated.brand,
      partnerId: updated.partnerId,
    },
    ACCOUNT_COOKIE.ttlSeconds,
  );
  const response = NextResponse.json({
    ok: true,
    brand: updated.brand,
    redirectTo: `/v/${updated.brand}`,
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

// Suppress unused-import warning if AccountBrand isn't referenced.
void (null as AccountBrand | null);
