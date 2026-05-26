/**
 *  GET /api/admin/applications
 *
 *  Master / operator view — every application across every brand and
 *  partner. Filters optionally on brand, partner_id, status.
 *
 *  Gating: requires an operator session (mode='demo' with isOperator,
 *  or future real-session admin claim). Non-operators get 403 — even
 *  partner-scoped sessions cannot fetch from this endpoint; they go
 *  through /api/v/<brand>/applications instead.
 *
 *  Pagination: cursor on (created_at, id) for stable ordering at scale.
 *  Limit default 50, max 100.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, desc, eq, lt, type SQL } from 'drizzle-orm';
import { getDb, hasDb } from '../../../../lib/db';
import { applications } from '../../../../lib/db/schema';
import { requireAdmin } from '../../../../lib/server-guards';

const BrandEnum = z.enum(['medpay', 'tradepay', 'coachpay']);
const StatusEnum = z.enum(['submitted', 'in_review', 'approved', 'funded', 'declined']);

const Query = z.object({
  brand: BrandEnum.optional(),
  partnerId: z.string().min(1).max(64).optional(),
  status: StatusEnum.optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: 'about:blank', title: code, status, code, detail }, { status });
}

export async function GET(req: NextRequest) {
  // SEC-001: admin-only. Unified on requireAdmin so the auth surface
  // is one helper; pre-fix this route ran its own inline isOperator
  // check that diverged from the rest of /api/admin/*.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  if (!hasDb()) {
    return problem(503, 'db_unavailable', 'Application database is not yet provisioned.');
  }

  const parsed = Query.safeParse({
    brand: req.nextUrl.searchParams.get('brand') ?? undefined,
    partnerId: req.nextUrl.searchParams.get('partnerId') ?? undefined,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    cursor: req.nextUrl.searchParams.get('cursor') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return problem(400, 'invalid_query', parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { brand, partnerId, status, cursor, limit } = parsed.data;

  const conditions: SQL[] = [];
  if (brand) conditions.push(eq(applications.brand, brand));
  if (partnerId) conditions.push(eq(applications.partnerId, partnerId));
  if (status) conditions.push(eq(applications.status, status));
  if (cursor) conditions.push(lt(applications.createdAt, new Date(cursor)));

  const db = getDb();
  const rows = await db
    .select()
    .from(applications)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(applications.createdAt))
    .limit(limit + 1);

  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? items[items.length - 1]?.createdAt.toISOString() : null;

  return NextResponse.json({
    items: items.map((a) => ({
      id: a.id,
      brand: a.brand,
      partnerId: a.partnerId,
      consumer: `${a.consumerFirst} ${a.consumerLast.slice(0, 1)}.`,
      consumerEmail: a.consumerEmail,
      amountCents: a.amountCents,
      tier: a.tier,
      selectedLender: a.selectedLender,
      status: a.status,
      createdAt: a.createdAt,
    })),
    nextCursor,
  });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
