import { NextResponse, type NextRequest } from 'next/server';
import { offerFor, SAMPLE_LENDERS, withMeta } from '../../../../../../lib/api-v1/shared';

/**
 * List offers for an application — `GET /api/v1/applications/[id]/offers`.
 *
 * Returns the offers aggregated from orchestration across every
 * eligible lender adapter that responded inside the SLA window.
 * Ranking is consumer-best by default (lowest total cost).
 */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const url = new URL(req.url);
  const amount = Number.parseInt(url.searchParams.get('amount_cents') ?? '1850000', 10);
  const brand = url.searchParams.get('brand') ?? 'tradepay';

  const eligible = SAMPLE_LENDERS.filter((l) =>
    l.brands.includes(brand as (typeof l.brands)[number]),
  );
  const offers = eligible.map((l) => offerFor(l, amount));

  return NextResponse.json(
    withMeta(
      {
        application_id: ctx.params.id,
        status: 'offers_ready',
        ranking: 'consumer_best_total_cost',
        offers,
      },
      {
        endpoint: `GET /api/v1/applications/${ctx.params.id}/offers`,
        brand,
        amount_cents: amount,
      },
    ),
  );
}
