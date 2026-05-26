import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { evaluateDecision } from '@/lib/decision-engine';
import type { Brand } from '@/lib/api-v1/shared';

/**
 * POST /api/v1/decision-engine
 *
 * Public decision-engine endpoint. Takes an application id + HighSale
 * pre-qual snapshot, returns the propensity-ranked lender list.
 *
 * Persists the decision to the `decisions` table when DATABASE_URL is
 * set — that record is what powers the offer page, audit replay, and
 * Reg B adverse-action reason codes.
 *
 * Engine selection:
 *   • Default: env-driven (Trutopia cloud if configured, else internal)
 *   • Override via `engine` field in body for A/B testing or canary runs
 */

const BodySchema = z.object({
  applicationId: z.string().uuid(),
  engine: z.enum(['trutopia', 'internal', 'fallback']).optional(),
  prequal: z.object({
    tier: z.enum(['A', 'B', 'C', 'D']),
    ficoBand: z.number().int().nullable(),
    dti: z.number().nullable(),
    openTradelines: z.number().int().nullable(),
    amountCents: z.number().int().positive(),
    annualIncomeCents: z.number().int().nonnegative(),
    state: z.string().length(2),
    brand: z.enum(['medpay', 'tradepay', 'coachpay', 'direct']),
  }),
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
        code: 'invalid_decision_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await evaluateDecision({
    applicationId: parsed.data.applicationId,
    engine: parsed.data.engine,
    prequal: {
      ...parsed.data.prequal,
      brand: parsed.data.prequal.brand as Brand,
    },
  });

  return NextResponse.json(result);
}
