/**
 *  GET /api/admin/dashboard/snapshot
 *
 *  Pre-aggregated KPI snapshot for the master Command Center and the
 *  per-brand dashboard, derived server-side from the seeded fixture.
 *
 *  WHY
 *    Prior to this endpoint, both pages imported `expandedApplications`
 *    (the ~420-row fixture, ~1MB stringified) directly into client JS
 *    and aggregated in the browser. This route does the aggregation on
 *    the server and ships only the KPIs / chart series (~5KB).
 *
 *  PARAMETERS
 *    ?scope=master                          → global aggregate, 90d / 12m charts
 *    ?scope=partner&partner=<legalName>&range=<7d|30d|90d|12m|all>
 *
 *  GATING
 *    requireAdmin — same guard the rest of /api/admin/* uses. The seeded
 *    fixture is non-production demo data, but the dashboards it powers
 *    are still operator-only views, so we keep the surface consistent.
 *
 *  CACHEABILITY
 *    Pure function of the seeded fixture + the current clock (range
 *    boundaries depend on `now`). No personalisation; safe to cache
 *    briefly per (scope, partner, range) tuple. Set s-maxage=30 so a
 *    burst of operators on the same view doesn't recompute per request.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '../../../../../lib/server-guards';
import {
  masterSnapshot,
  partnerSnapshot,
  partnerLeaderboard,
} from '../../../../../lib/seeded-applications-server';

const Query = z.object({
  scope: z.enum(['master', 'partner']).default('master'),
  partner: z.string().min(1).max(200).optional(),
  range: z.enum(['7d', '30d', '90d', '12m', 'all']).default('90d'),
});

function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: 'about:blank', title: code, status, code, detail }, { status });
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const parsed = Query.safeParse({
    scope: req.nextUrl.searchParams.get('scope') ?? undefined,
    partner: req.nextUrl.searchParams.get('partner') ?? undefined,
    range: req.nextUrl.searchParams.get('range') ?? undefined,
  });
  if (!parsed.success) {
    return problem(400, 'invalid_query', parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { scope, partner, range } = parsed.data;

  if (scope === 'partner') {
    if (!partner) {
      return problem(400, 'partner_required', 'scope=partner requires a partner legalName');
    }
    const snap = partnerSnapshot(partner, range);
    return NextResponse.json(
      { scope, partner, snapshot: snap },
      { headers: { 'cache-control': 'private, s-maxage=30, stale-while-revalidate=60' } },
    );
  }

  const snap = masterSnapshot();
  const leaderboard = partnerLeaderboard(5);
  return NextResponse.json(
    { scope: 'master', snapshot: snap, leaderboard },
    { headers: { 'cache-control': 'private, s-maxage=30, stale-while-revalidate=60' } },
  );
}
