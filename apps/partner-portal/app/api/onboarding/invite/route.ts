import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  createInvite,
  invitedIdFromEmail,
  listInvites,
  type InviteBrand,
} from '../../../../lib/invites-store';

/**
 * Onboarding invite — mint + list.
 *
 * POST  `/api/onboarding/invite`
 *   Body: { brand, prefill?, expiryHours, invitedByEmail }
 *   Returns: { inviteUrl, token, expiresAt }
 *
 * GET  `/api/onboarding/invite?invitedByEmail=...`
 *   Returns: { invites: InviteWithStatus[] }
 *   When invitedByEmail is omitted, returns the full list (operator
 *   surfaces filter by their own id in the pipeline UI).
 */

const ExpiryEnum = z.union([z.literal(24), z.literal(168), z.literal(720)]);

const PrefillSchema = z
  .object({
    businessName: z.string().trim().optional(),
    contactEmail: z.string().trim().email().optional().or(z.literal('').transform(() => undefined)),
    contactPhone: z.string().trim().optional(),
  })
  .optional()
  .default({});

const BodySchema = z.object({
  brand: z.enum(['medpay', 'tradepay', 'coachpay']),
  prefill: PrefillSchema,
  expiryHours: ExpiryEnum,
  invitedByEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_invite_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { brand, prefill, expiryHours, invitedByEmail } = parsed.data;

  const invite = await createInvite({
    brand: brand as InviteBrand,
    prefill: {
      businessName: prefill?.businessName?.trim() || undefined,
      contactEmail: prefill?.contactEmail || undefined,
      contactPhone: prefill?.contactPhone?.trim() || undefined,
    },
    expiryHours,
    invitedByEmail,
  });

  return NextResponse.json(
    {
      inviteUrl: invite.inviteUrl,
      token: invite.token,
      brand: invite.brand,
      expiresAt: invite.expiresAt,
      status: invite.status,
      invitedById: invite.invitedById,
    },
    { status: 201 },
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const email = url.searchParams.get('invitedByEmail') ?? undefined;
  const invitedById = email ? invitedIdFromEmail(email) : undefined;
  const invites = await listInvites({ invitedById });
  return NextResponse.json({ invites });
}
