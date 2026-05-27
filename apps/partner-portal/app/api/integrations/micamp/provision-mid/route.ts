import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { type ProvisionMidRequest } from '@/lib/micamp/client';
import { getMerchantProcessor } from '@/lib/integrations/registry';
import { assertPartnerOwnership, requirePartnerSession } from '@/lib/server-guards';
import { safeErrorResponse } from '@/lib/safe-error';
import { enforceOrigin } from '@/lib/origin-guard';
import { enforce as enforceEdgeRateLimit } from '@/lib/edge-rate-limit';

/**
 * POST /api/integrations/micamp/provision-mid
 *
 * Kicks off MID auto-provisioning for a partner. Called by the
 * onboarding orchestrator as the third leg of the one-config flow
 * (after HighSale sub-account + Lender Marketplace defaults land).
 *
 * Pre-underwriting completes synchronously and returns an MID record
 * in the `underwriting_pre` state. Post-underwriting is volume-gated
 * and handled by the orchestrator's volume tracker, not this route.
 */

const BodySchema = z.object({
  partnerId: z.string().min(1),
  legalName: z.string().min(1),
  dba: z.string().nullable(),
  ein: z.string().regex(/^\d{2}-?\d{7}$/, 'EIN must be ##-#######'),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7),
  estimatedVolumeCents: z.number().int().nonnegative(),
  estimatedTicketCents: z.number().int().nonnegative(),
  mccCode: z.string().min(4).max(4),
  funnelUrls: z.array(z.string()).default([]),
});

/**
 * Per-IP edge rate limit for MID provisioning. Each MID issuance
 * triggers upstream underwriting + a billing schedule write on the
 * MiCamp side. 10/hour/IP keeps an attacker (or a buggy retry loop)
 * from spamming pre-underwriting requests across hundreds of fake
 * EINs in a few minutes.
 */
const PROVISION_RATE_LIMIT = 10;
const PROVISION_RATE_WINDOW_MS = 60 * 60 * 1000;

function pickClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  return xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  // SEC-010: origin allowlist on state-changing partner POSTs.
  const originFail = enforceOrigin(req);
  if (originFail) return originFail;

  // SEC-001: partner session required + partnerId ownership.
  const guard = await requirePartnerSession(req);
  if (guard instanceof NextResponse) return guard;

  // SEC-006 follow-up: bound MID issuance rate per IP.
  const rl = enforceEdgeRateLimit(
    pickClientIp(req),
    PROVISION_RATE_LIMIT,
    PROVISION_RATE_WINDOW_MS,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'rate_limited',
        detail: 'Too many MID provisioning requests from this network. Retry shortly.',
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
        code: 'invalid_provision_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const ownership = assertPartnerOwnership(guard, parsed.data.partnerId);
  if (ownership) return ownership;

  try {
    const processor = getMerchantProcessor(parsed.data.partnerId);
    const result = await processor.provisionMid(parsed.data as ProvisionMidRequest);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    // SEC-007: never echo `err.message` — MiCamp error bodies include
    // internal endpoint paths and sometimes auth-state hints.
    return safeErrorResponse(
      err,
      'micamp_unreachable',
      502,
      '/api/integrations/micamp/provision-mid',
    );
  }
}
