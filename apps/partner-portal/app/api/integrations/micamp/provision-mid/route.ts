import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { provisionMid, type ProvisionMidRequest } from '@/lib/micamp/client';
import { assertPartnerOwnership, requirePartnerSession } from '@/lib/server-guards';

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

export async function POST(req: NextRequest) {
  // SEC-001: partner session required + partnerId ownership.
  const guard = await requirePartnerSession(req);
  if (guard instanceof NextResponse) return guard;

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
    const result = await provisionMid(parsed.data as ProvisionMidRequest);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        code: 'micamp_unreachable',
        detail: err instanceof Error ? err.message : 'MiCamp call failed',
      },
      { status: 502 },
    );
  }
}
