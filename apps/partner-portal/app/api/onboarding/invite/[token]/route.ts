import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getInvite, redeemInvite } from '../../../../../lib/invites-store';
import { enforceCsrf } from '../../../../../lib/csrf.js';
import { getSessionContext } from '../../../../../lib/session';

/**
 * Onboarding invite — token lookup + redeem.
 *
 * GET    `/api/onboarding/invite/[token]`
 *   Returns the invite (brand, prefill, status). Used by each brand
 *   landing page to decide whether to show the "invited" banner +
 *   pre-fill the wizard. Public — the token IS the credential.
 *
 * PATCH  `/api/onboarding/invite/[token]`
 *   Body: { applicationId? }
 *   Marks the invite redeemed. Called server-side from the
 *   `/api/integrations/brand/apply` BFF after a successful application.
 *
 * SEC-111: PATCH now requires an authenticated session AND a CSRF
 * token. Pre-fix, any unauthenticated caller could mark any invite
 * redeemed with an attacker-supplied applicationId, breaking the
 * legitimate redemption flow ("already redeemed" guard) and
 * polluting the operator pipeline with phantom redemptions.
 *
 * SEC-112: when applicationId is absent or unparseable, fall back to
 * `randomUUID()` instead of the previous Date.now() concatenation —
 * the timestamp form collided across simultaneous redemptions and was
 * guessable enough to enable adjacent-tab attacks against the consent
 * receipt lookup (SEC-104).
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInvite(token);
  if (!invite) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'invite_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ invite });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;

  // SEC-111: require an authenticated session. The redeem action is
  // an operator-side mutation (the apply BFF calls this as the
  // signed-in operator); an unauthenticated caller has no business
  // marking invites consumed.
  const session = await getSessionContext(req);
  if (session.mode === 'none') {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        code: 'not_signed_in',
      },
      { status: 401 },
    );
  }

  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as { applicationId?: string };
  // SEC-112: collision-free UUID, not Date.now().toString(36).
  const applicationId = body?.applicationId ?? `app_unknown_${randomUUID()}`;
  const invite = await redeemInvite(token, applicationId);
  if (!invite) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'invite_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ invite });
}
