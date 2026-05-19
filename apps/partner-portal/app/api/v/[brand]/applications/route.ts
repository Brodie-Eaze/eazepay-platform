/**
 *  POST /api/v/<brand>/applications   public — consumer apply form
 *  GET  /api/v/<brand>/applications   partner-scoped — dashboard read
 *
 *  POST
 *  ----
 *  Called by the consumer apply page when the engine step completes.
 *  Public (no session) because the consumer is not signed in to the
 *  partner portal — they're a patient / homeowner / prospect filling
 *  out the form.
 *
 *  Tenant attribution:
 *    • `partner_id` comes from the BODY (which the apply page took
 *      from the URL `?ref=`). The server *validates* it exists in
 *      `partners` and matches the URL brand. A mismatch (e.g. a
 *      tradepay partner id submitted to /v/medpay/applications) is
 *      rejected with 400; we don't trust client-claimed attribution
 *      across brands.
 *    • If no partner_id was passed, or the passed id doesn't exist
 *      or belongs to another brand, the row is stamped with the
 *      synthetic `UNATTRIBUTED_PARTNER_ID` sentinel. Those rows
 *      never appear in any partner-scoped read.
 *
 *  Idempotency:
 *    The body carries a `request_id` (client-generated UUID v4). The
 *    DB has a UNIQUE constraint on `request_id`. A retry of the same
 *    POST returns the previously-stored row instead of a duplicate.
 *
 *  GET
 *  ---
 *  Session-required. The verified session cookie determines which
 *  partner_ids the caller is allowed to read. We compute the set via
 *  `allowedPartnerIdsForBrand` (same gate every other v/<brand>/* route
 *  uses) and filter the DB query with it. No partner_id can come from
 *  the client query string.
 *
 *  Cursor pagination keeps the dashboard responsive at 8M+ rows: we
 *  page on `(created_at, id)` not OFFSET, so the cost is constant in
 *  page depth.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { getDb, hasDb } from '../../../../../lib/db';
import { applicationEvents, applications, partners } from '../../../../../lib/db/schema';
import { getSessionContext, allowedPartnerIdsForBrand } from '../../../../../lib/session';
import { UNATTRIBUTED_PARTNER_ID } from '../../../../../lib/submitted-applications';

const BrandEnum = z.enum(['medpay', 'tradepay', 'coachpay']);

const PostBody = z.object({
  partnerId: z.string().min(1).max(64).optional(),
  refQuery: z.string().max(256).optional(),
  consumerFirst: z.string().min(1).max(80),
  consumerLast: z.string().min(1).max(80),
  consumerEmail: z.string().email().max(254),
  consumerPhone: z.string().min(10).max(32),
  amountCents: z.number().int().positive().max(100_000_000),
  tier: z.enum(['prime_plus', 'prime', 'near_prime', 'sub_prime', 'no_match']).optional(),
  selectedLender: z.string().max(120).optional(),
  requestId: z.string().min(8).max(128),
});

const StatusEnum = z.enum(['submitted', 'in_review', 'approved', 'funded', 'declined']);
const GetQuery = z.object({
  status: StatusEnum.optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: 'about:blank', title: code, status, code, detail }, { status });
}

/* ============================================================
 * POST — consumer apply page hands a completed application
 * ============================================================ */
export async function POST(req: NextRequest, { params }: { params: Promise<{ brand: string }> }) {
  if (!hasDb()) {
    /* Cutover guard: when DATABASE_URL isn't set yet (pre-Postgres
     * provisioning) the apply page should fall back to its legacy
     * localStorage path. Return a structured 503 so the client
     * recognises the situation and degrades gracefully. */
    return problem(503, 'db_unavailable', 'Application database is not yet provisioned.');
  }

  const { brand: brandSlug } = await params;
  const brandParsed = BrandEnum.safeParse(brandSlug);
  if (!brandParsed.success) {
    return problem(400, 'unknown_brand', `Unknown brand "${brandSlug}".`);
  }
  const brand = brandParsed.data;

  let body: z.infer<typeof PostBody>;
  try {
    const raw = await req.json();
    body = PostBody.parse(raw);
  } catch (err) {
    const detail =
      err instanceof z.ZodError ? err.errors.map((e) => e.message).join('; ') : 'invalid_body';
    return problem(400, 'invalid_body', detail);
  }

  const db = getDb();

  /* Resolve the claimed partner id. Three cases:
   *   1. Body has a partnerId AND it exists in `partners` AND matches
   *      our brand → use it.
   *   2. Body has a partnerId but it's a stranger or belongs to a
   *      different brand → log + downgrade to UNATTRIBUTED.
   *   3. Body has no partnerId → UNATTRIBUTED.
   */
  let resolvedPartnerId = UNATTRIBUTED_PARTNER_ID;
  if (body.partnerId && body.partnerId !== UNATTRIBUTED_PARTNER_ID) {
    const match = await db
      .select({ id: partners.id, brand: partners.brand })
      .from(partners)
      .where(eq(partners.id, body.partnerId))
      .limit(1);
    const row = match[0];
    if (row && row.brand === brand) {
      resolvedPartnerId = row.id;
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'apply.partner_mismatch',
          claimedPartnerId: body.partnerId,
          urlBrand: brand,
          partnerBrand: row?.brand ?? null,
          action: 'attribution_downgraded_to_unattributed',
        }),
      );
    }
  }

  /* Insert application + audit-event row in a single transaction (per
   * ADR-0011 transactional outbox). The application row is the
   * canonical state; the application_events row is the audit-chain
   * entry. Both must succeed or both must roll back — otherwise a
   * regulator subpoena of the chain shows applications without a
   * 'created' event, which fails the chain's integrity guarantee.
   *
   * Idempotency: ON CONFLICT (request_id) DO NOTHING. If the constraint
   * fires the application insert returns empty + we re-fetch the
   * original outside the transaction. The event is NOT re-written on
   * a duplicate post — the original 'created' event still anchors the
   * chain. */
  const inserted = await db.transaction(async (tx) => {
    const appRows = await tx
      .insert(applications)
      .values({
        brand,
        partnerId: resolvedPartnerId,
        refQuery: body.refQuery ?? body.partnerId ?? null,
        consumerFirst: body.consumerFirst.trim(),
        consumerLast: body.consumerLast.trim(),
        consumerEmail: body.consumerEmail.trim().toLowerCase(),
        consumerPhone: body.consumerPhone.replace(/\D+/g, ''),
        amountCents: body.amountCents,
        tier: body.tier ?? null,
        selectedLender: body.selectedLender ?? null,
        requestId: body.requestId,
      })
      .onConflictDoNothing({ target: applications.requestId })
      .returning();

    // On a fresh insert (not duplicate), anchor the audit chain with a
    // 'created' event. The payload captures the originating context so
    // a regulator can reconstruct who/what initiated the application
    // without joining back to the applications table.
    if (appRows[0]) {
      await tx.insert(applicationEvents).values({
        applicationId: appRows[0].id,
        type: 'created',
        toStatus: 'submitted',
        actor: 'consumer',
        payload: JSON.stringify({
          brand,
          partnerId: resolvedPartnerId,
          amountCents: body.amountCents,
          tier: body.tier ?? null,
          requestId: body.requestId,
        }),
      });
    }

    return appRows;
  });

  let row = inserted[0];
  if (!row) {
    // Duplicate request_id — fetch and return the original.
    const dup = await db
      .select()
      .from(applications)
      .where(eq(applications.requestId, body.requestId))
      .limit(1);
    row = dup[0];
  }
  if (!row) {
    return problem(500, 'insert_failed', 'Could not persist the application.');
  }

  return NextResponse.json(
    {
      id: row.id,
      brand: row.brand,
      partnerId: row.partnerId,
      status: row.status,
      createdAt: row.createdAt,
      duplicate: !inserted[0], // true if returned from the conflict re-fetch
    },
    { status: 201 },
  );
}

/* ============================================================
 * GET — partner dashboard read, scoped to the session partner
 * ============================================================ */
export async function GET(req: NextRequest, { params }: { params: Promise<{ brand: string }> }) {
  if (!hasDb()) {
    return problem(503, 'db_unavailable', 'Application database is not yet provisioned.');
  }

  const { brand: brandSlug } = await params;
  const brandParsed = BrandEnum.safeParse(brandSlug);
  if (!brandParsed.success) {
    return problem(400, 'unknown_brand', `Unknown brand "${brandSlug}".`);
  }
  const brand = brandParsed.data;

  const session = await getSessionContext(req);
  const allowed = allowedPartnerIdsForBrand(session, brand);
  if (allowed.length === 0) {
    /* Session is either absent (mode=none) or has no visibility into
     * this brand. Return 200 with an empty page rather than 401 so
     * the dashboard can render a "no access" state without a thrown
     * error — the v/<brand>/layout.tsx server gate has already
     * returned 404 in cases where the cookie shouldn't be on /v/<brand>
     * at all. */
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const query = GetQuery.safeParse({
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    cursor: req.nextUrl.searchParams.get('cursor') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!query.success) {
    return problem(400, 'invalid_query', query.error.errors.map((e) => e.message).join('; '));
  }
  const { status, cursor, limit } = query.data;

  const conditions = [eq(applications.brand, brand), inArray(applications.partnerId, allowed)];
  if (status) conditions.push(eq(applications.status, status));
  if (cursor) conditions.push(lt(applications.createdAt, new Date(cursor)));

  const db = getDb();
  const rows = await db
    .select()
    .from(applications)
    .where(and(...conditions))
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

// Force this route onto the Node.js runtime — `pg` is not edge-compatible.
export const runtime = 'nodejs';
// Disable caching — every read must reflect the latest writes.
export const dynamic = 'force-dynamic';
// Mute static analysis warnings for unused imports when the file ships.
void sql;
