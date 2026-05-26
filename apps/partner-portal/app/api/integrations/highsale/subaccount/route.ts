import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSubAccount, type CreateSubAccountRequest } from '@/lib/highsale/client';
import { assertPartnerOwnership, requirePartnerSession } from '@/lib/server-guards';
import { safeErrorResponse } from '@/lib/safe-error';
import { enforceOrigin } from '@/lib/origin-guard';
import { enforce as enforceEdgeRateLimit } from '@/lib/edge-rate-limit';

/**
 * POST /api/integrations/highsale/subaccount
 *
 * Create a HighSale sub-account under the EazePay agency. Called by
 * the onboarding orchestrator as the first leg of the one-config
 * provisioning flow.
 *
 * Per-client we configure:
 *   • Bureau (FICO8 vs Vantage) — set at create time, immutable after
 *   • Monthly pull cap — protects the collective wholesale tier
 *   • Milly billing cadence — weekly during 90-day probation, then
 *     flips to bi-weekly or monthly based on the client's plan
 *
 * Returns the Pixie embed URL the client uses to drop the smart form
 * into their own funnel.
 */

const BodySchema = z.object({
  partnerId: z.string().min(1),
  legalName: z.string().min(1),
  primaryContactEmail: z.string().email(),
  bureau: z.enum(['fico8', 'vantage']),
  monthlyPullCap: z.number().int().positive().nullable(),
  billingCadence: z.enum(['weekly', 'biweekly', 'monthly']),
  brand: z.enum(['medpay', 'tradepay', 'coachpay', 'ai_funding']),
});

/**
 * Per-IP edge rate limit for sub-account creation. Sub-accounts are
 * expensive: each one allocates a HighSale tenant + Milly billing
 * schedule. 10/hour/IP keeps an attacker (or a buggy retry loop) from
 * burning through the wholesale agency quota.
 */
const SUBACCOUNT_RATE_LIMIT = 10;
const SUBACCOUNT_RATE_WINDOW_MS = 60 * 60 * 1000;

function pickClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  return xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  // SEC-010: origin allowlist — defence-in-depth on top of SameSite=Lax
  // and the partner session cookie. Webhooks are exempt (this is not
  // one); this is a partner-session POST and MUST come from our origin.
  const originFail = enforceOrigin(req);
  if (originFail) return originFail;

  // SEC-001: partner session required. The body carries `partnerId`,
  // which pre-fix the route trusted unconditionally — letting any
  // caller mint a HighSale sub-account under any partner id.
  const guard = await requirePartnerSession(req);
  if (guard instanceof NextResponse) return guard;

  // SEC-006 follow-up: bound sub-account creation per IP. Sub-account
  // mint is expensive (allocates a HighSale tenant + Milly schedule);
  // a misconfigured loop or attacker with a valid session can otherwise
  // exhaust the agency's wholesale quota.
  const rl = enforceEdgeRateLimit(
    pickClientIp(req),
    SUBACCOUNT_RATE_LIMIT,
    SUBACCOUNT_RATE_WINDOW_MS,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'rate_limited',
        detail: 'Too many sub-account creations from this network. Retry shortly.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rl.retryAfterMs ?? 60_000) / 1000).toString(),
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
        code: 'invalid_subaccount_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Caller can only create a sub-account under their own partnerId.
  // Admin override (operator preset) bypasses the check — that's the
  // path the provisioning orchestrator demo uses.
  const ownership = assertPartnerOwnership(guard, parsed.data.partnerId);
  if (ownership) return ownership;

  try {
    const result = await createSubAccount(parsed.data as CreateSubAccountRequest);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    // SEC-007: never echo `err.message` to the wire — upstream API errors
    // embed internal identifiers + sometimes stack info.
    return safeErrorResponse(
      err,
      'highsale_subaccount_failed',
      502,
      '/api/integrations/highsale/subaccount',
    );
  }
}
