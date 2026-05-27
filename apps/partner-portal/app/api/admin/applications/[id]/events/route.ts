/**
 * GET /api/admin/applications/[id]/events
 *
 * Returns the audit chain for a single application — every row in
 * `application_events` for the given application_id, ordered oldest →
 * newest, as a paged list.
 *
 * This is the master-side endpoint that lets the `/audit` page (and
 * future regulator-export tooling) replay the decision trail per ADR-
 * 0011 transactional outbox. The chain is what a Reg B / FCRA / TILA
 * subpoena would ask for: "show me every state change on application
 * X between dates Y and Z." Before this route existed the answer was
 * 14 hardcoded fixture rows; now it's the real chain.
 *
 * Gating: operator session only (same pattern as the parent
 * `/api/admin/applications` route). Non-operators get 403.
 *
 * Pagination: cursor on `created_at` for stable ordering across page
 * boundaries when an application has dozens of events (lender quotes,
 * status changes, manual notes). Default 100, max 500 (events are
 * tiny and operators often want the whole chain).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, asc, eq, gt, type SQL } from 'drizzle-orm';
import { getDb, hasDb } from '../../../../../../lib/db';
import { applicationEvents, applications } from '../../../../../../lib/db/schema';
import { requireAdmin } from '../../../../../../lib/server-guards';
import { redactForLog } from '../../../../../../lib/safe-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: 'about:blank', title: code, status, code, detail }, { status });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // SEC-001: admin-only — same gate as /api/admin/applications.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  if (!hasDb()) {
    return problem(503, 'db_unavailable', 'Application database is not yet provisioned.');
  }

  const { id } = await params;

  // Application_id is a UUID. Reject obvious garbage early — a bad
  // id should be a 400, not a 500 from PG's regex check on the cast.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return problem(400, 'invalid_application_id', 'application id must be a UUID.');
  }

  const parsed = Query.safeParse({
    cursor: req.nextUrl.searchParams.get('cursor') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return problem(400, 'invalid_query', parsed.error.errors.map((e) => e.message).join('; '));
  }
  const { cursor, limit } = parsed.data;

  const db = getDb();

  // Confirm the application exists before listing events. A request
  // for a non-existent application should 404, not "200 with empty
  // events" — the latter would let a caller probe for application
  // ids by watching the response shape.
  const appRows = await db
    .select({ id: applications.id, brand: applications.brand, partnerId: applications.partnerId })
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1);
  if (appRows.length === 0) {
    return problem(404, 'not_found', `Application ${id} not found.`);
  }

  // Audit chain query — oldest first so the timeline reads naturally
  // top → bottom. Cursor pagination on createdAt for stable ordering
  // when an application has hundreds of events.
  const conditions: SQL[] = [eq(applicationEvents.applicationId, id)];
  if (cursor) {
    conditions.push(gt(applicationEvents.createdAt, new Date(cursor)));
  }

  const events = await db
    .select()
    .from(applicationEvents)
    .where(and(...conditions))
    .orderBy(asc(applicationEvents.createdAt))
    .limit(limit + 1);

  const hasMore = events.length > limit;
  const rows = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore ? (rows[rows.length - 1]?.createdAt.toISOString() ?? null) : null;

  // SEC-211 — PII scrub on read. Application-event payloads are written
  // from upstream sources (lender quote callbacks, MiCamp webhooks,
  // operator notes) whose shape we don't control byte-for-byte. They
  // can carry consumer email / phone / DOB / SSN-last-4 / address.
  // Operators viewing the audit timeline shouldn't see raw consumer
  // PII — the same fields are deny-listed in safeLog so we reuse
  // `redactForLog` to enforce a single source of truth for "what's PII".
  const resBody = {
    application: appRows[0],
    items: rows.map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actor: e.actor,
      // Parse the stored JSON payload before returning so consumers
      // don't have to double-parse. Then redact PII fields before
      // emit. If the row was written with a non-JSON payload, return
      // it as a `raw` string fallback (also PII-scrubbed via the
      // wrapping object).
      payload: e.payload ? redactForLog(safeParseJson(e.payload)) : null,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor,
  };
  return NextResponse.json(resBody, {
    headers: {
      // SEC-212 — sensitive admin response: no intermediary caching.
      'Cache-Control': 'no-store',
    },
  });
}

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: s };
  }
}
