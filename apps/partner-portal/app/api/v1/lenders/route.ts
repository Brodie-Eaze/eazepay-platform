import { NextResponse, type NextRequest } from 'next/server';
import { SAMPLE_LENDERS, withMeta } from '../../../../lib/api-v1/shared';

/**
 * Lender marketplace registry — `GET /api/v1/lenders`.
 *
 * Returns every lender product that's eligible to receive routed
 * traffic through orchestration. A prospective lender uses this to
 * confirm the marketplace is alive and to see the shape we'll send
 * them on `POST /v1/partner/applications`.
 *
 * Query params:
 *   ?brand=tradepay        filter by brand
 *   ?tier=prime            filter by served tier
 *   ?amount=1850000        filter by amount envelope (cents)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const brand = url.searchParams.get('brand');
  const tier = url.searchParams.get('tier');
  const amount = Number.parseInt(url.searchParams.get('amount') ?? '0', 10);

  const rows = SAMPLE_LENDERS.filter((l) => {
    if (brand && !l.brands.includes(brand as (typeof l.brands)[number])) return false;
    if (tier && !l.serves_tiers.includes(tier as (typeof l.serves_tiers)[number])) return false;
    if (amount > 0 && (amount < l.min_amount_cents || amount > l.max_amount_cents)) return false;
    return true;
  });

  return NextResponse.json(
    withMeta(
      {
        data: rows,
        page: { cursor: null, has_more: false, total: rows.length },
      },
      {
        endpoint: 'GET /api/v1/lenders',
        filters: { brand, tier, amount: amount || null },
      },
    ),
  );
}
