/**
 * POST /api/account/set-password
 *
 * Owner of a newly-onboarded business (or any invited account) sets
 * their initial password via the welcome email link. Transitions the
 * account from 'invited' → 'active', mints a signed account session
 * cookie, returns the brand portal URL the caller should redirect to.
 *
 * Security posture:
 *   - SEC-201: callers MUST send a single-use welcome token; we no
 *     longer accept a raw `userId`. The token is minted at welcome-
 *     email send (see /api/integrations/brand/apply) and consumed
 *     atomically here — a second POST of the same token fails with
 *     410 Gone, so a stolen welcome URL can be used at most once
 *     and (after the user clicks the legit email) zero times. The
 *     legacy `{userId, newPassword}` body is rejected with 400 +
 *     `token_required`; the rejection bumps the
 *     `welcome.legacy_userid_attempt` counter so we can spot stale
 *     callers (and active probing) on the observability dashboard.
 *   - CSRF: the welcome page renders a form that includes the CSRF
 *     token via the standard double-submit pattern. enforceCsrf
 *     guards this route.
 *   - Rate limit: edge-rate-limit 5/min/IP. Wrong token loops are
 *     bounded; a real recipient typing wrong fields a few times still
 *     gets through.
 *   - Zod strict: unknown fields reject with 400.
 *   - Password policy: ≥12 chars + 1 upper + 1 lower + 1 digit + 1
 *     symbol. Matches the apps/api password policy so the rules don't
 *     drift across surfaces.
 *
 * Why this isn't /v1/auth/* on apps/api: apps/api is not deployed
 * yet. When it is, this route proxies to /v1/auth/account-set-password
 * (a new backend route) and the local accounts-store is decommissioned.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { enforceCsrf } from '../../../../lib/csrf.js';
import { enforce as enforceEdgeRateLimit } from '../../../../lib/edge-rate-limit.js';
import { getAccount, setAccountPassword, type AccountBrand } from '../../../../lib/accounts-store';
import { ACCOUNT_COOKIE, signAccountSession } from '../../../../lib/account-cookie';
import { consumeWelcomeToken } from '../../../../lib/welcome-tokens';
import { incrementMetric } from '../../../../lib/observability/metrics';

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
    /** 32-byte hex welcome token (64 chars). */
    token: z.string().regex(/^[0-9a-f]{64}$/, 'must be a 64-char hex token'),
    newPassword: PasswordSchema,
  })
  .strict();

/**
 * Detect the pre-fix `{userId, newPassword}` shape so we can return a
 * specific error code (rather than the generic Zod failure) and bump
 * the legacy-call counter. We do NOT process this body — that's the
 * whole point of the SEC-201 fix.
 */
function isLegacyUserIdShape(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'userId' in (raw as Record<string, unknown>) &&
    !('token' in (raw as Record<string, unknown>))
  );
}

function problem(status: number, code: string, detail?: string): NextResponse {
  const title =
    status === 400
      ? 'Bad Request'
      : status === 401
        ? 'Unauthorized'
        : status === 410
          ? 'Gone'
          : 'Forbidden';
  return NextResponse.json(
    {
      type: 'about:blank',
      title,
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

  const xff = req.headers.get('x-forwarded-for') ?? '';
  const clientIp = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
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

  // SEC-201: reject the legacy {userId, newPassword} shape explicitly
  // BEFORE the Zod parse so the caller gets a meaningful code and
  // the dashboard counter ticks. Strict Zod would otherwise fold this
  // into a generic invalid_payload.
  if (isLegacyUserIdShape(raw)) {
    incrementMetric('welcome.legacy_userid_attempt');
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'account.set_password.legacy_userid_attempt',
        ip: clientIp,
      }),
    );
    return problem(
      400,
      'token_required',
      'This endpoint now requires a single-use welcome token. Request a fresh welcome email.',
    );
  }

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

  // SEC-201: atomic single-use consume. A null return covers all three
  // failure modes — unknown / consumed / expired — and we deliberately
  // collapse them into one response so the caller cannot distinguish
  // "expired" from "already used" (that distinction would let an
  // attacker probe for which tokens have been redeemed).
  const consumed = await consumeWelcomeToken(parsed.data.token);
  if (!consumed) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'account.set_password.token_invalid',
        ip: clientIp,
      }),
    );
    return problem(
      410,
      'token_invalid',
      'This welcome link has expired or already been used. Request a fresh welcome email.',
    );
  }

  const account = await getAccount(consumed.userId);
  if (!account) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'account.set_password.userId_unknown',
        userId: consumed.userId,
        ip: clientIp,
      }),
    );
    // The token resolved but the account is gone — treat the same as
    // "token invalid" to the caller; the operator sees the breadcrumb.
    return problem(410, 'token_invalid');
  }
  if (account.status === 'suspended') {
    return problem(403, 'account_suspended');
  }

  const updated = await setAccountPassword({
    userId: consumed.userId,
    newPassword: parsed.data.newPassword,
  });
  if (!updated) return problem(410, 'token_invalid');

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
