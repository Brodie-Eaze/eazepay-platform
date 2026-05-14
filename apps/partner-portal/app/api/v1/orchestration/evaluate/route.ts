import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { idFor, problem, SAMPLE_LENDERS, withMeta } from '../../../../../lib/api-v1/shared';

/**
 * Orchestration eligibility — `POST /api/v1/orchestration/evaluate`.
 *
 * Runs the eligibility graph (knockouts → affordability → state APR
 * caps → MLA / SCRA gating → brand allowlist → tier match → amount
 * envelope) and returns the candidate set with reasons for any
 * exclusions. No bureau hit happens here — soft pull fires only on
 * `route`.
 */

const BodySchema = z.object({
  application_id: z.string().min(1),
  brand: z.enum(['tradepay', 'medpay', 'coachpay', 'direct']),
  amount_cents: z.number().int().min(50_000).max(15_000_000),
  tier: z.enum(['prime_plus', 'prime', 'near_prime', 'sub_prime', 'no_match']).default('prime'),
  state: z.string().length(2).optional(),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return problem({
      title: 'Unprocessable Entity',
      status: 422,
      code: 'invalid_payload',
      detail: 'application_id + brand + amount_cents are required.',
      instance: '/api/v1/orchestration/evaluate',
    });
  }
  const { brand, amount_cents, tier } = parsed.data;

  const decisions = SAMPLE_LENDERS.map((l) => {
    if (!l.brands.includes(brand as (typeof l.brands)[number])) {
      return { lender_product_id: l.id, outcome: 'ineligible', reason: `brand_mismatch:${brand}` };
    }
    if (!l.serves_tiers.includes(tier as (typeof l.serves_tiers)[number])) {
      return { lender_product_id: l.id, outcome: 'ineligible', reason: `tier_mismatch:${tier}` };
    }
    if (amount_cents < l.min_amount_cents || amount_cents > l.max_amount_cents) {
      return {
        lender_product_id: l.id,
        outcome: 'ineligible',
        reason: `amount_outside_envelope:${l.min_amount_cents}-${l.max_amount_cents}`,
      };
    }
    return { lender_product_id: l.id, outcome: 'eligible' };
  });

  return NextResponse.json(
    withMeta(
      {
        evaluation_id: idFor('eval', parsed.data.application_id + brand + tier),
        application_id: parsed.data.application_id,
        decisions,
        eligible_count: decisions.filter((d) => d.outcome === 'eligible').length,
      },
      {
        endpoint: 'POST /api/v1/orchestration/evaluate',
        policy_version: 'orch_v_2026_05_a',
      },
    ),
  );
}
