/**
 * Partner-scoped consumer invite endpoints.
 *
 *   POST  /api/v/<brand>/consumer-invites
 *   GET   /api/v/<brand>/consumer-invites?salespersonEmail=...
 *
 * The brand path segment is the canonical InviteBrand short code
 * ('medpay' | 'tradepay' | 'coachpay') — same as `/apply/<brand>` and
 * `/v/<brand>` use. The salesperson making the call is identified by
 * `salespersonEmail` until Clerk auth is wired; this is the same MVP
 * pattern the operator-side `/api/onboarding/invite` uses.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  createConsumerInvite,
  listConsumerInvites,
  type ConsumerInviteBrand,
} from '../../../../../lib/consumer-invites-store';

const BrandEnum = z.enum(['medpay', 'tradepay', 'coachpay']);

const ExpiryEnum = z.union([
  z.literal(1),
  z.literal(24),
  z.literal(168),
  z.literal(720),
]);

const ConsumerSchema = z
  .object({
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .email()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    phone: z.string().trim().optional(),
  })
  .optional()
  .default({});

const BodySchema = z.object({
  partnerId: z.string().min(1),
  salespersonEmail: z.string().email(),
  consumer: ConsumerSchema,
  loanAmountCents: z.number().int().positive().optional(),
  purpose: z.string().trim().optional(),
  expiryHours: ExpiryEnum,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ brand: string }> },
) {
  const { brand: brandParam } = await params;
  const brandParsed = BrandEnum.safeParse(brandParam);
  if (!brandParsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'unknown_brand',
        detail: `Unknown brand "${brandParam}".`,
      },
      { status: 400 },
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
        code: 'invalid_consumer_invite_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const invite = await createConsumerInvite({
    partnerId: parsed.data.partnerId,
    brand: brandParsed.data as ConsumerInviteBrand,
    salespersonEmail: parsed.data.salespersonEmail,
    consumer: parsed.data.consumer,
    loanAmountCents: parsed.data.loanAmountCents,
    purpose: parsed.data.purpose,
    expiryHours: parsed.data.expiryHours,
  });

  return NextResponse.json(
    {
      inviteUrl: invite.inviteUrl,
      token: invite.token,
      brand: invite.brand,
      expiresAt: invite.expiresAt,
      status: invite.status,
      partnerId: invite.partnerId,
      salespersonEmail: invite.salespersonEmail,
    },
    { status: 201 },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brand: string }> },
) {
  const { brand: brandParam } = await params;
  const brandParsed = BrandEnum.safeParse(brandParam);
  if (!brandParsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'unknown_brand',
        detail: `Unknown brand "${brandParam}".`,
      },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const salespersonEmail =
    url.searchParams.get('salespersonEmail') ?? undefined;
  const partnerId = url.searchParams.get('partnerId') ?? undefined;

  const invites = await listConsumerInvites({
    brand: brandParsed.data as ConsumerInviteBrand,
    salespersonEmail,
    partnerId,
  });
  return NextResponse.json({ invites });
}
