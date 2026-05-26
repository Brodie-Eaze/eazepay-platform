import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { charge, type ChargeRequest } from '@/lib/micamp/client';
import { assertResourceOwnershipStub, requirePartnerSession } from '@/lib/server-guards';

/**
 * POST /api/integrations/micamp/payments
 *
 * Run a charge through a partner's MID. Called by the MedPay consumer
 * checkout flow after a customer accepts a lender offer + signs the
 * loan documents. The lender disburses to the merchant via this MID;
 * we earn 50% of the net processing margin per the rev share.
 *
 * This route is a thin BFF wrapper around `lib/micamp/client.ts`.
 * The real underwriting / risk + retry logic lives on the MiCamp
 * side once we go live; for now the client returns deterministic
 * synthetic responses so the rest of the platform can be developed
 * against a stable contract.
 */

const BodySchema = z.object({
  midId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.literal('USD'),
  consumerToken: z.string().min(1),
  applicationId: z.string().uuid(),
  metadata: z.record(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  // SEC-001: partner session required. Pre-fix any anonymous caller
  // could trigger a MID charge against any midId + applicationId.
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
        code: 'invalid_charge_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // applicationId → partner ownership is stubbed (see helper docs).
  // The session-gate above blocks anonymous abuse in the meantime.
  const ownership = assertResourceOwnershipStub(guard, parsed.data.applicationId, 'application');
  if (ownership) return ownership;

  try {
    const result = await charge(parsed.data as ChargeRequest);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        code: 'micamp_charge_failed',
        detail: err instanceof Error ? err.message : 'MiCamp charge failed',
      },
      { status: 502 },
    );
  }
}
