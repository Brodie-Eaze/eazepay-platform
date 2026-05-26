import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { runPrequal, type PrequalRequest } from '@/lib/highsale/client';

/**
 * POST /api/integrations/highsale/prequal
 *
 * Run a soft-pull pre-qualification through the partner's HighSale
 * sub-account. Called by the consumer apply flow after the customer
 * submits the intake form. The response feeds the decision engine:
 *
 *   intake form → [this route] → HighSale snapshot
 *                                       ↓
 *                              decision engine (filter + propensity)
 *                                       ↓
 *                              offers landing page
 *
 * Idempotency: `requestId` is the client-minted dedupe key. Replay
 * of the same requestId returns the same pullId without consuming
 * a second wholesale pull.
 *
 * Compliance: FCRA soft-pull consent must be captured BEFORE this
 * route is called. The consumer apply flow handles that explicitly.
 */

const BodySchema = z.object({
  subAccountId: z.string().min(1),
  consumer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(7),
    ssnLast4: z.string().regex(/^\d{4}$/),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    address: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().length(2),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/),
    }),
    annualIncomeCents: z.number().int().nonnegative(),
    employmentType: z.enum(['w2', 'self_employed', '1099', 'retired', 'unemployed', 'other']),
  }),
  requestedAmountCents: z.number().int().positive(),
  requestId: z.string().min(8),
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
        code: 'invalid_prequal_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await runPrequal(parsed.data as PrequalRequest);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        code: 'highsale_prequal_failed',
        detail: err instanceof Error ? err.message : 'HighSale pre-qual failed',
      },
      { status: 502 },
    );
  }
}
