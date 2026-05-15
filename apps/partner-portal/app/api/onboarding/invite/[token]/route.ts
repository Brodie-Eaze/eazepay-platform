import { NextResponse, type NextRequest } from 'next/server';
import { getInvite, redeemInvite } from '../../../../../lib/invites-store';

/**
 * Onboarding invite — token lookup + redeem.
 *
 * GET    `/api/onboarding/invite/[token]`
 *   Returns the invite (brand, prefill, status). Used by each brand
 *   landing page to decide whether to show the "invited" banner +
 *   pre-fill the wizard.
 *
 * PATCH  `/api/onboarding/invite/[token]`
 *   Body: { applicationId }
 *   Marks the invite redeemed. Called server-side from the
 *   `/api/integrations/brand/apply` BFF after a successful application.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    applicationId?: string;
  };
  const applicationId = body?.applicationId ?? `app_unknown_${Date.now().toString(36)}`;
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
