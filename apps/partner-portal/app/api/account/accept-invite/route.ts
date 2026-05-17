/**
 * POST /api/account/accept-invite
 *
 * Teammate accepts a team-invite (from /v/<brand>/team), sets a
 * password, lands in the brand portal. Atomic-feeling flow:
 *   1. Verify the invite token (lives in team-invites-store).
 *   2. Reject if expired, accepted-already, or revoked.
 *   3. Create an invited account (idempotent on email+brand).
 *   4. Set the password → status='active'.
 *   5. Mark the invite as accepted.
 *   6. Mint a signed account-session cookie.
 *   7. Return the brand portal URL for redirect.
 *
 * Failures roll forward gracefully — duplicate invites for the same
 * email don't clobber an existing account; an expired invite returns
 * a clear error so the teammate can ask for a fresh one.
 *
 * Security posture identical to set-password: CSRF + edge rate-limit
 * + strict Zod + same password policy.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { enforceCsrf } from '../../../../lib/csrf.js';
import { enforce as enforceEdgeRateLimit } from '../../../../lib/edge-rate-limit.js';
import { acceptTeamInvite, getTeamInvite } from '../../../../lib/team-invites-store';
import { createInvitedAccount, setAccountPassword } from '../../../../lib/accounts-store';
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
    token: z.string().uuid(),
    displayName: z.string().trim().min(1).max(120),
    newPassword: PasswordSchema,
  })
  .strict();

function problem(status: number, code: string, detail?: string): NextResponse {
  return NextResponse.json(
    {
      type: 'about:blank',
      title:
        status === 400
          ? 'Bad Request'
          : status === 401
            ? 'Unauthorized'
            : status === 410
              ? 'Gone'
              : 'Forbidden',
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
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_accept_invite_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const invite = await getTeamInvite(parsed.data.token);
  if (!invite) return problem(404, 'invite_not_found');
  if (invite.status === 'expired') return problem(410, 'invite_expired');
  if (invite.status === 'accepted') return problem(409, 'invite_already_accepted');
  if (invite.status === 'revoked') return problem(403, 'invite_revoked');

  // Create the teammate account in invited state (idempotent on
  // email+brand) then set the password to activate it.
  const created = await createInvitedAccount({
    email: invite.recipientEmail,
    displayName: parsed.data.displayName,
    brand: invite.brand,
    partnerId: invite.partnerId,
    role: invite.role === 'Owner' ? 'Admin' : invite.role, // teammates can't be Owner via invite — degrade to Admin
  });
  const activated = await setAccountPassword({
    userId: created.userId,
    newPassword: parsed.data.newPassword,
  });
  if (!activated) return problem(500, 'account_activation_failed');

  await acceptTeamInvite(parsed.data.token);

  const session = await signAccountSession(
    {
      userId: activated.userId,
      brand: activated.brand,
      partnerId: activated.partnerId,
    },
    ACCOUNT_COOKIE.ttlSeconds,
  );

  const response = NextResponse.json({
    ok: true,
    brand: activated.brand,
    redirectTo: `/v/${activated.brand}`,
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
