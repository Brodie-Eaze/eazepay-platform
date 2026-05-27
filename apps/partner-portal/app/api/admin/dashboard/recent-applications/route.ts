/**
 *  GET /api/admin/dashboard/recent-applications
 *
 *  Recent seeded rows for a partner, used by `/v/[brand]` to populate
 *  the "Recent Applications" table without shipping the full ~1MB
 *  fixture to the browser.
 *
 *  PARAMETERS
 *    ?partner=<legalName>&limit=<1..50>&exclude=<csv of ids to omit>
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/server-guards';
import { recentSeededApplicationsForPartner } from '../../../../../lib/seeded-applications-server';

const Query = z.object({
  partner: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(6),
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
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    exclude: req.nextUrl.searchParams.get('exclude') ?? undefined,
  });
  if (!parsed.success) {
    return problem(400, 'invalid_query', parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { partner, limit, exclude } = parsed.data;

  const excludeSet = new Set(exclude ? exclude.split(',').filter(Boolean) : []);
  const items = recentSeededApplicationsForPartner(partner, limit, excludeSet);
  return NextResponse.json(
    { items },
    { headers: { 'cache-control': 'private, s-maxage=30, stale-while-revalidate=60' } },
  );
}
