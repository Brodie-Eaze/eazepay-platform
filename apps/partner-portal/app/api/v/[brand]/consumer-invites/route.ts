/**
 * Partner-scoped consumer invite endpoints.
 *
 *   POST  /api/v/<brand>/consumer-invites
 *   GET   /api/v/<brand>/consumer-invites?salespersonEmail=...
 *
 * The brand path segment is the canonical InviteBrand short code
 * ('medpay' | 'tradepay' | 'coachpay') — same as `/apply/<brand>` and
 * `/v/<brand>` use.
 *
 * SEC-102 hardening: the route now resolves the caller via
 * `lib/session.ts` and constrains `partnerId` to the session's
 * `allowedPartnerIdsForBrand(...)` set. Pre-fix, a `partnerId` from the
 * request body or query string was trusted blindly — a MedPay user
 * could POST `{partnerId: 'p_orion'}` against `/api/v/tradepay/...`
 * and create invites under a TradePay partner's name, and an
 * unauthenticated `GET ?salespersonEmail=...` enumerated consumer PII.
 *
 * Enforcement contract:
 *   - No session → 401 not_signed_in.
 *   - POST partnerId must be inside the session's allowed set for this
 *     brand. Reject with 403 cross_partner_write otherwise.
 *   - GET partnerId query is intersected with the allowed set; if the
 *     caller asked for a partner they can't see, return an empty list
 *     (don't leak existence). salespersonEmail is honoured as a filter
 *     but never expands scope — the partner constraint is the outer
 *     fence.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { BrandCode } from '@eazepay/shared-types';
import {
  createConsumerInvite,
  listConsumerInvites,
  type ConsumerInviteBrand,
} from '../../../../../lib/consumer-invites-store';
import { allowedPartnerIdsForBrand, getSessionContext } from '../../../../../lib/session';
import { enforceCsrf } from '../../../../../lib/csrf.js';

const BrandEnum = z.enum(['medpay', 'tradepay', 'coachpay']);

const ExpiryEnum = z.union([z.literal(1), z.literal(24), z.literal(168), z.literal(720)]);

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

function problem(
  status: number,
  code: string,
  detail?: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    {
      type: 'about:blank',
      title: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Bad Request',
      status,
      code,
      ...(detail ? { detail } : {}),
      ...(extra ?? {}),
    },
    { status },
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ brand: string }> }) {
  // SEC-108: state-changing endpoint requires CSRF token.
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;

  const { brand: brandParam } = await params;
  const brandParsed = BrandEnum.safeParse(brandParam);
  if (!brandParsed.success) {
    return problem(400, 'unknown_brand', `Unknown brand "${brandParam}".`);
  }
  const brand = brandParsed.data as Exclude<BrandCode, 'direct'>;

  const session = await getSessionContext(req);
  if (session.mode === 'none') {
    return problem(401, 'not_signed_in');
  }

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return problem(400, 'invalid_consumer_invite_payload', undefined, {
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  // SEC-102: confine the writeable partner set to what the session
  // owns. Brand-scoped demo sessions can only act on their own brand;
  // operators get the full roster for the URL brand.
  const allowedIds = new Set(allowedPartnerIdsForBrand(session, brand));
  if (!allowedIds.has(parsed.data.partnerId)) {
    return problem(
      403,
      'cross_partner_write',
      `Session is not authorised to mint invites for partner "${parsed.data.partnerId}" on brand "${brand}".`,
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ brand: string }> }) {
  const { brand: brandParam } = await params;
  const brandParsed = BrandEnum.safeParse(brandParam);
  if (!brandParsed.success) {
    return problem(400, 'unknown_brand', `Unknown brand "${brandParam}".`);
  }
  const brand = brandParsed.data as Exclude<BrandCode, 'direct'>;

  const session = await getSessionContext(req);
  if (session.mode === 'none') {
    return problem(401, 'not_signed_in');
  }

  const url = new URL(req.url);
  const salespersonEmail = url.searchParams.get('salespersonEmail') ?? undefined;
  const requestedPartnerId = url.searchParams.get('partnerId') ?? undefined;

  // SEC-102: intersect requested partner with the session's allowed set.
  // If the caller asks for a partnerId they can't see, return an empty
  // list rather than 403 — that way the response shape is uniform and
  // can't be used to confirm a partnerId's existence.
  const allowedIds = new Set(allowedPartnerIdsForBrand(session, brand));
  if (requestedPartnerId && !allowedIds.has(requestedPartnerId)) {
    return NextResponse.json({ invites: [] });
  }

  // Resolve the effective partner filter: caller's explicit choice
  // (already validated above) or null = "any partner in the allowed set."
  // The store filters by a single partnerId; for the multi-partner case
  // we pull each and concatenate.
  const partnerFilters = requestedPartnerId ? [requestedPartnerId] : Array.from(allowedIds);

  const results = await Promise.all(
    partnerFilters.map((pid) =>
      listConsumerInvites({
        brand: brandParsed.data as ConsumerInviteBrand,
        salespersonEmail,
        partnerId: pid,
      }),
    ),
  );

  // Flatten + dedupe by token in case the store ever returns the same
  // invite from multiple partner queries (shouldn't, but defensive).
  const seen = new Set<string>();
  const invites = results.flat().filter((inv) => {
    if (seen.has(inv.token)) return false;
    seen.add(inv.token);
    return true;
  });

  return NextResponse.json({ invites });
}
