import { NextResponse, type NextRequest } from 'next/server';
import { desc, sql, and, eq, gt } from 'drizzle-orm';
import { hasDb, getDb, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/server-guards';
import { safeErrorResponse } from '@/lib/safe-error';

/**
 * GET /api/admin/audit?actor=&action=&targetType=&since=
 *
 * Paged read of the platform-wide audit log. Drives the
 * /admin/audit viewer.
 *
 * Falls back to a synthetic in-memory log when the DB isn't wired,
 * so the demo viewer still has data to show.
 */

const SYNTHETIC_LOG = [
  {
    id: 'audit_demo_1',
    actor: 'brodie',
    action: 'lender.toggle',
    targetType: 'lender',
    targetId: 'ml_in_us_bank',
    payloadJson: JSON.stringify({ from: 'enabled', to: 'paused', reason: 'pending NDA execution' }),
    ipAddress: '10.0.0.42',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  },
  {
    id: 'audit_demo_2',
    actor: 'kevin',
    action: 'vertical_config.publish',
    targetType: 'vertical_config',
    targetId: 'medpay',
    payloadJson: JSON.stringify({ routingMode: 'hybrid', enabledLenderCount: 7 }),
    ipAddress: '10.0.0.41',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(Date.now() - 1000 * 60 * 21).toISOString(),
  },
  {
    id: 'audit_demo_3',
    actor: 'system',
    action: 'provision.complete',
    targetType: 'partner',
    targetId: 'acme-medspa',
    payloadJson: JSON.stringify({ runId: 'prov_demo_abc', durationMs: 3128 }),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
  },
  {
    id: 'audit_demo_4',
    actor: 'steven',
    action: 'mid.status_change',
    targetType: 'mid',
    targetId: 'mid_acme_001',
    payloadJson: JSON.stringify({
      from: 'underwriting_pre',
      to: 'underwriting_post',
      volumeCents: 24_50_000,
    }),
    ipAddress: '10.0.0.44',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'audit_demo_5',
    actor: 'brodie',
    action: 'partner.suspend',
    targetType: 'partner',
    targetId: 'old-medspa-x',
    payloadJson: JSON.stringify({ reason: 'compliance review' }),
    ipAddress: '10.0.0.42',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
];

export async function GET(req: NextRequest) {
  // SEC-001: admin-only. Pre-fix this route returned the full audit
  // log to anonymous callers — including strings like "pending NDA
  // execution" against `ml_in_us_bank` that leak partner relationships.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;
  const { actor: viewerActor, role: viewerRole } = guard;

  const search = req.nextUrl.searchParams;
  const actor = search.get('actor');
  const action = search.get('action');
  const targetType = search.get('targetType');
  const sinceIso = search.get('since');

  if (!hasDb()) {
    let entries = SYNTHETIC_LOG.slice();
    if (actor) entries = entries.filter((e) => e.actor === actor);
    if (action) entries = entries.filter((e) => e.action === action);
    if (targetType) entries = entries.filter((e) => e.targetType === targetType);
    if (sinceIso) entries = entries.filter((e) => e.createdAt >= sinceIso);
    return NextResponse.json({
      source: 'synthetic',
      viewer: { actor: viewerActor, role: viewerRole },
      entries,
    });
  }

  try {
    const db = getDb();
    const conditions = [];
    if (actor) conditions.push(eq(schema.auditLog.actor, actor));
    if (action) conditions.push(eq(schema.auditLog.action, action));
    if (targetType) conditions.push(eq(schema.auditLog.targetType, targetType));
    if (sinceIso) conditions.push(gt(schema.auditLog.createdAt, new Date(sinceIso)));
    const where = conditions.length > 0 ? and(...conditions) : sql`true`;

    const rows = await db
      .select()
      .from(schema.auditLog)
      .where(where)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(200);

    return NextResponse.json({
      source: 'db',
      viewer: { actor: viewerActor, role: viewerRole },
      entries: rows,
    });
  } catch (err) {
    // SEC-007: never echo `err.message` to the wire — Drizzle/pg errors
    // carry the full SQL statement + offending column. safeErrorResponse
    // logs the full error context for the operator and returns the
    // generic detail mapped from `audit_query_failed`.
    return safeErrorResponse(err, 'audit_query_failed', 500, '/api/admin/audit');
  }
}
