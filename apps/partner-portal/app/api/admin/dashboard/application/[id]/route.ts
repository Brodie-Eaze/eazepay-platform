/**
 *  GET /api/admin/dashboard/application/[id]
 *
 *  Single-row lookup against the seeded fixture. Used by the deal-detail
 *  page (`/v/[brand]/applications/[id]`) so it no longer pulls the whole
 *  fixture into the client bundle just to do a `find()` on `id`.
 *
 *  Returns 404 if the id isn't in the seeded set — the page falls back
 *  to its other data sources (real submitted apps, hand-curated rows).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '../../../../../../lib/server-guards';
import { findSeededApplication } from '../../../../../../lib/seeded-applications-server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const row = findSeededApplication(params.id);
  if (!row) {
    return NextResponse.json(
      { type: 'about:blank', title: 'not_found', status: 404, code: 'not_found' },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { item: row },
    { headers: { 'cache-control': 'private, s-maxage=60, stale-while-revalidate=300' } },
  );
}
