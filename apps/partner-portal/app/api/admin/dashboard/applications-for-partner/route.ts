/**
 *  GET /api/admin/dashboard/applications-for-partner
 *
 *  Returns the seeded application rows for a (partner, product) pair.
 *  Used by `/v/[brand]/applications` so the page no longer imports the
 *  full ~1MB fixture into the client bundle.
 *
 *  PARAMETERS
 *    ?partner=<legalName>&product=<MedPay|TradePay|CoachPay>
 *    &exclude=<csv of ids to omit>      ← caller's already-seen ids
 *
 *  Payload size: typically <50KB even for the largest partner (vs the
 *  ~1MB whole-fixture import the page used to ship).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/server-guards';
import { applicationsForPartnerProduct } from '../../../../../lib/seeded-applications-server';

const Query = z.object({
  partner: z.string().min(1).max(200),
  product: z.string().min(1).max(64),
  exclude: z.string().max(20_000).optional(),
});

function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: 'about:blank', title: code, status, code, detail }, { status });
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const parsed = Query.safeParse({
    partner: req.nextUrl.searchParams.get('partner') ?? undefined,
    product: req.nextUrl.searchParams.get('product') ?? undefined,
    exclude: req.nextUrl.searchParams.get('exclude') ?? undefined,
  });
  if (!parsed.success) {
    return problem(400, 'invalid_query', parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { partner, product, exclude } = parsed.data;

  const excludeSet = new Set(exclude ? exclude.split(',').filter(Boolean) : []);
  const rows = applicationsForPartnerProduct(partner, product, excludeSet);
  return NextResponse.json(
    { items: rows },
    { headers: { 'cache-control': 'private, s-maxage=30, stale-while-revalidate=60' } },
  );
}
