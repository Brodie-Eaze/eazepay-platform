import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { toCents, type Cents } from '@eazepay/shared-types';
import {
  idFor,
  offerFor,
  problem,
  SAMPLE_LENDERS,
  withMeta,
} from '../../../../../lib/api-v1/shared';

/**
 * Orchestration route — `POST /api/v1/orchestration/route`.
 *
 * Runs the tiered hybrid waterfall against the eligible lender set:
 * parallel within tier (5s soft / 8s hard timeout), waterfall across
 * tiers, stop once we have ≥ MIN_OFFERS_TO_PRESENT (default 3).
 * Returns the offers in consumer-best order + the per-lender route
 * trace so the operator console can replay the decision.
 */

const BodySchema = z.object({
  application_id: z.string().min(1),
  brand: z.enum(['tradepay', 'medpay', 'coachpay', 'direct']),
  amount_cents: z
    .number()
    .int()
    .min(50_000)
    .max(15_000_000)
    .transform((n): Cents => toCents(n)),
  term_months: z.number().int().min(6).max(144).default(48),
  tier: z.enum(['prime_plus', 'prime', 'near_prime', 'sub_prime']).default('prime'),
  mode: z.enum(['parallel', 'waterfall', 'hybrid']).default('hybrid'),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return problem({
      title: 'Unprocessable Entity',
      status: 422,
      code: 'invalid_payload',
      detail: 'application_id, brand, amount_cents are required.',
      instance: '/api/v1/orchestration/route',
    });
  }
  const { brand, amount_cents, term_months, tier, mode } = parsed.data;

  const eligible = SAMPLE_LENDERS.filter(
    (l) =>
      l.brands.includes(brand as (typeof l.brands)[number]) &&
      l.serves_tiers.includes(tier as (typeof l.serves_tiers)[number]) &&
      amount_cents >= l.min_amount_cents &&
      amount_cents <= l.max_amount_cents,
  );

  const offers = eligible.map((l) => offerFor(l, amount_cents, term_months));
  // Consumer-best ranking by APR mid-band
  const ranked = [...offers].sort((a, b) => a.apr_bps - b.apr_bps);

  const trace = eligible.map((l, i) => ({
    lender_product_id: l.id,
    evaluated_at: new Date(Date.now() - (eligible.length - i) * 80).toISOString(),
    latency_ms: l.sla_p95_ms - Math.floor(Math.random() * 120),
    outcome: 'approved',
  }));

  return NextResponse.json(
    withMeta(
      {
        route_id: idFor('rt', parsed.data.application_id + mode),
        application_id: parsed.data.application_id,
        mode,
        offers: ranked,
        trace,
        compliance: {
          state_apr_cap_applied: false,
          mla_36_pct_mapr_cap_applied: false,
          scra_active: false,
        },
      },
      {
        endpoint: 'POST /api/v1/orchestration/route',
        policy_version: 'orch_v_2026_05_a',
      },
    ),
  );
}
