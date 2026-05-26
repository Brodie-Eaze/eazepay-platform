import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listRuns, startProvision, type ProvisionConfig } from '@/lib/orchestrator/provision';
import { requireAdmin } from '@/lib/server-guards';

/**
 * POST /api/onboarding/provision
 *
 * Kick off the one-config provisioning workflow for a new partner.
 * Returns immediately (202) with the run id; status polls go to
 * `GET /api/onboarding/provision/[id]`.
 *
 * Steps (executed in sequence in the background):
 *   1. HighSale sub-account
 *   2. Lender marketplace defaults (inherit brand allowlist)
 *   3. MiCamp MID (pre-underwriting)
 *   4. Partner-portal seed (branding + owner invite)
 *
 * GET /api/onboarding/provision  — list recent runs (for the admin
 *                                  provisioning queue page).
 */

const BodySchema = z.object({
  partnerId: z.string().min(1),
  legalName: z.string().min(1),
  dba: z.string().nullable().optional(),
  ein: z.string().regex(/^\d{2}-?\d{7}$/),
  primaryContactName: z.string().min(1),
  primaryContactEmail: z.string().email(),
  primaryContactPhone: z.string().min(7),
  brand: z.enum(['medpay', 'tradepay', 'coachpay', 'ai_funding']),
  bureau: z.enum(['fico8', 'vantage']),
  monthlyPullCap: z.number().int().positive().nullable().optional(),
  billingCadence: z.enum(['weekly', 'biweekly', 'monthly']),
  estimatedAnnualVolumeCents: z.number().int().nonnegative(),
  estimatedTicketCents: z.number().int().nonnegative(),
  mccCode: z.string().length(4),
  funnelUrls: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  // SEC-001: admin-only. Provisioning kicks off real upstream calls
  // (HighSale sub-account, MiCamp MID); anonymous access was the bug.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_provision_config',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const config: ProvisionConfig = {
    partnerId: parsed.data.partnerId,
    legalName: parsed.data.legalName,
    dba: parsed.data.dba ?? null,
    ein: parsed.data.ein,
    primaryContactName: parsed.data.primaryContactName,
    primaryContactEmail: parsed.data.primaryContactEmail,
    primaryContactPhone: parsed.data.primaryContactPhone,
    brand: parsed.data.brand,
    bureau: parsed.data.bureau,
    monthlyPullCap: parsed.data.monthlyPullCap ?? null,
    billingCadence: parsed.data.billingCadence,
    estimatedAnnualVolumeCents: parsed.data.estimatedAnnualVolumeCents,
    estimatedTicketCents: parsed.data.estimatedTicketCents,
    mccCode: parsed.data.mccCode,
    funnelUrls: parsed.data.funnelUrls,
  };

  const run = await startProvision(config);
  return NextResponse.json(run, { status: 202 });
}

export async function GET(req: NextRequest) {
  // SEC-001: admin-only. The list contains partner contact info +
  // step output, which leaks the active onboarding pipeline.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;
  return NextResponse.json({ runs: await listRuns() });
}
