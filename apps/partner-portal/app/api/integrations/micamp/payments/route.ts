import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { deriveChargeIdempotencyKey, type ChargeRequest } from '@/lib/micamp/client';
import { getMerchantProcessor } from '@/lib/integrations/registry';
import { assertResourceOwnership, requirePartnerSession } from '@/lib/server-guards';
import { safeErrorResponse } from '@/lib/safe-error';
import { enforceOrigin } from '@/lib/origin-guard';

/**
 * POST /api/integrations/micamp/payments
 *
 * Run a charge through a partner's MID. Called by the MedPay consumer
 * checkout flow after a customer accepts a lender offer + signs the
 * loan documents. The lender disburses to the merchant via this MID;
 * we earn 50% of the net processing margin per the rev share.
 *
 * Idempotency: caller MAY supply `Idempotency-Key` header for explicit
 * control; otherwise we derive a deterministic key from
 * `(applicationId, amountCents)` because that pair uniquely identifies
 * "charge this application this amount exactly once". Either way the
 * key is forwarded to MiCamp so partner-side retries collapse to one
 * consumer charge.
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
  // SEC-010: origin allowlist on state-changing partner POSTs.
  const originFail = enforceOrigin(req);
  if (originFail) return originFail;

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

  // SEC-001 follow-up: real applicationId → partner ownership check.
  // 404 on mismatch / not-found so callers can't enumerate UUIDs.
  const ownership = await assertResourceOwnership(guard, parsed.data.applicationId, 'application');
  if (ownership) return ownership;

  // Honour caller-supplied Idempotency-Key when present; otherwise
  // derive deterministically. Same `(applicationId, amountCents)` always
  // yields the same key, so MiCamp dedupes a partner retry on its side.
  const callerKey = req.headers.get('idempotency-key');
  const idempotencyKey =
    callerKey ??
    deriveChargeIdempotencyKey({
      applicationId: parsed.data.applicationId,
      amountCents: parsed.data.amountCents,
    });

  const chargeReq: ChargeRequest = {
    midId: parsed.data.midId,
    amountCents: parsed.data.amountCents,
    currency: parsed.data.currency,
    consumerToken: parsed.data.consumerToken,
    applicationId: parsed.data.applicationId,
    idempotencyKey,
    metadata: parsed.data.metadata,
  };

  try {
    // Route through the merchant-processor registry so partner-scoped
    // routing (sandbox/live, alt processors) stays centralised, but pass
    // the request shape that carries the idempotency key Builder C added.
    const processor = getMerchantProcessor(guard.partnerId);
    const result = await processor.charge(chargeReq);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    // SEC-007: never echo upstream error text — MiCamp's 5xx bodies
    // can carry internal stack info + processing identifiers.
    return safeErrorResponse(err, 'micamp_charge_failed', 502, '/api/integrations/micamp/payments');
  }
}
