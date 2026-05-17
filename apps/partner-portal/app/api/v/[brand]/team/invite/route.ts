/**
 * Per-brand team-invite mint + list.
 *
 *   POST  /api/v/<brand>/team/invite
 *   GET   /api/v/<brand>/team/invite
 *
 * Behaviour:
 *   - Session is resolved via lib/session.getSessionContext (signed
 *     demo cookie or — eventually — JWT).
 *   - partnerId is FORCED from the session's allowed-partner set for
 *     this brand. Caller cannot specify a different partnerId; that
 *     would defeat the wall-up.
 *   - On POST: mints invite in team-invites-store + dispatches branded
 *     email via lib/server-email.sendTeamInviteEmail (mock when
 *     RESEND_API_KEY unset).
 *   - GET returns invites visible to the session's partner.
 *
 * SEC-108 / SEC-117: CSRF wrap + strict Zod parse on the body.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { BrandCode } from '@eazepay/shared-types';
import { enforceCsrf } from '../../../../../../lib/csrf.js';
import { allowedPartnerIdsForBrand, getSessionContext } from '../../../../../../lib/session';
import {
  createTeamInvite,
  listTeamInvites,
  type TeamInviteBrand,
} from '../../../../../../lib/team-invites-store';
import { sendTeamInviteEmail } from '../../../../../../lib/server-email';
import { partners as MASTER_PARTNERS } from '../../../../../../lib/master-data';

const BrandEnum = z.enum(['medpay', 'tradepay', 'coachpay']);
const RoleEnum = z.enum(['Owner', 'Admin', 'Operator', 'Viewer', 'Compliance']);

const BodySchema = z
  .object({
    recipientEmail: z.string().trim().email(),
    role: RoleEnum,
    inviterEmail: z.string().trim().email(),
    inviterName: z.string().trim().min(1).max(120),
    inviterNote: z.string().trim().max(500).optional(),
  })
  .strict();

function problem(status: number, code: string, detail?: string): NextResponse {
  return NextResponse.json(
    {
      type: 'about:blank',
      title: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Bad Request',
      status,
      code,
      ...(detail ? { detail } : {}),
    },
    { status },
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ brand: string }> }) {
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;

  const { brand: brandParam } = await params;
  const brandParsed = BrandEnum.safeParse(brandParam);
  if (!brandParsed.success) return problem(400, 'unknown_brand');
  const brand = brandParsed.data as Exclude<BrandCode, 'direct'>;

  const session = await getSessionContext(req);
  if (session.mode === 'none') return problem(401, 'not_signed_in');

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_team_invite_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // SEC-102 carry-forward: confine the partner the invite belongs to
  // to the session's allowed set. Brand-scoped demo sessions invite
  // teammates to their OWN account; operator sessions get the brand's
  // first partner as the demo target.
  const allowedIds = allowedPartnerIdsForBrand(session, brand);
  const partnerId = allowedIds[0];
  if (!partnerId) {
    return problem(403, 'no_partner_in_session');
  }

  const invite = await createTeamInvite({
    brand: brandParsed.data as TeamInviteBrand,
    partnerId,
    inviterEmail: parsed.data.inviterEmail,
    inviterName: parsed.data.inviterName,
    recipientEmail: parsed.data.recipientEmail,
    role: parsed.data.role,
    inviterNote: parsed.data.inviterNote,
  });

  // Build the absolute accept URL using the same Origin the page
  // came from — same-origin so the recipient lands inside the
  // brand portal.
  const origin = req.headers.get('origin') ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const acceptUrl = `${origin}${invite.acceptUrl}`;

  // Dispatch the branded email. Failures don't roll back the invite —
  // the operator can resend from the UI.
  try {
    await sendTeamInviteEmail({
      brand: brand,
      to: parsed.data.recipientEmail,
      idempotencyKey: `team-invite-${invite.token}`,
      vars: {
        recipientName: MASTER_PARTNERS.find((p) => p.id === partnerId)?.legalName ?? 'there',
        inviterName: parsed.data.inviterName,
        roleLabel: parsed.data.role,
        acceptUrl,
        inviterNote: parsed.data.inviterNote,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'team_invite.email_failed',
        token: invite.token,
        msg: (err as Error).message,
      }),
    );
  }

  return NextResponse.json(
    {
      ok: true,
      token: invite.token,
      acceptUrl: invite.acceptUrl,
      role: invite.role,
      recipientEmail: invite.recipientEmail,
      expiresAt: invite.expiresAt,
      status: invite.status,
    },
    { status: 201 },
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ brand: string }> }) {
  const { brand: brandParam } = await params;
  const brandParsed = BrandEnum.safeParse(brandParam);
  if (!brandParsed.success) return problem(400, 'unknown_brand');
  const brand = brandParsed.data as Exclude<BrandCode, 'direct'>;

  const session = await getSessionContext(req);
  if (session.mode === 'none') return problem(401, 'not_signed_in');

  const allowedIds = new Set(allowedPartnerIdsForBrand(session, brand));
  const all = await listTeamInvites({ brand: brand as TeamInviteBrand });
  const visible = all.filter((inv) => allowedIds.has(inv.partnerId));
  return NextResponse.json({ invites: visible });
}
