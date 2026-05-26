import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSubAccount, type CreateSubAccountRequest } from '@/lib/highsale/client';

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

export async function POST(req: NextRequest) {
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

  try {
    const result = await createSubAccount(parsed.data as CreateSubAccountRequest);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        code: 'highsale_subaccount_failed',
        detail: err instanceof Error ? err.message : 'HighSale sub-account create failed',
      },
      { status: 502 },
    );
  }
}
