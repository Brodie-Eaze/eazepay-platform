import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listMigrations, seedMigrationQueue, queueMigration } from '@/lib/orchestrator/migration';
import { requireAdmin } from '@/lib/server-guards';
import { enforceOrigin } from '@/lib/origin-guard';
import { writeAuditLog } from '@/lib/audit-log';

/**
 * GET  /api/admin/migrations            — list all migration runs
 * POST /api/admin/migrations            — queue one or more migrations
 *
 * Body for POST:
 *   { sourceCustomerIds: string[] }     — bulk seed (idempotent)
 *   { sourceCustomerId: string }        — single queue
 */

const BodySchema = z.union([
  z.object({ sourceCustomerIds: z.array(z.string().min(1)).min(1) }),
  z.object({ sourceCustomerId: z.string().min(1) }),
]);

export async function GET(req: NextRequest) {
  // SEC-001: admin-only.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;
  return NextResponse.json({ migrations: await listMigrations() });
}

export async function POST(req: NextRequest) {
  // SEC-010: origin allowlist on state-changing admin POSTs.
  const originFail = enforceOrigin(req);
  if (originFail) return originFail;

  // SEC-001: admin-only. Pre-fix, an anonymous attacker could queue
  // arbitrary `sourceCustomerId` values into the migration orchestrator.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_migration_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  /* SOC2 CC8.1: migration queueing is privileged infra mutation —
   * audit both the bulk and single-id paths. The orchestrator already
   * writes its own `migration.queue` row from queueMigration (lib/
   * orchestrator/migration.ts) but those rows carry the
   * ORCHESTRATOR_ACTOR identity. The admin-route audit row captures
   * WHO triggered the queue from the BFF, which is the SOC2-relevant
   * actor for evidence purposes. */
  const auditBase = {
    actor: guard.actor,
    action: 'migration.queued' as const,
    targetType: 'customer_migration' as const,
    req,
  };

  if ('sourceCustomerIds' in parsed.data) {
    try {
      const records = await seedMigrationQueue(parsed.data.sourceCustomerIds);
      await writeAuditLog({
        ...auditBase,
        targetId: null,
        outcome: 'success',
        payload: {
          mode: 'bulk',
          requestedCount: parsed.data.sourceCustomerIds.length,
          queuedCount: records.length,
          recordIds: records.map((r) => r.id),
        },
      });
      return NextResponse.json({ queued: records.length, records });
    } catch (err) {
      await writeAuditLog({
        ...auditBase,
        targetId: null,
        outcome: 'failed',
        payload: {
          mode: 'bulk',
          requestedCount: parsed.data.sourceCustomerIds.length,
          error: err instanceof Error ? err.message : 'unknown',
        },
      });
      throw err;
    }
  }

  try {
    const record = await queueMigration(parsed.data.sourceCustomerId);
    await writeAuditLog({
      ...auditBase,
      targetId: record.id,
      outcome: 'success',
      payload: {
        mode: 'single',
        sourceCustomerId: parsed.data.sourceCustomerId,
        after: record,
      },
    });
    return NextResponse.json(record, { status: 202 });
  } catch (err) {
    await writeAuditLog({
      ...auditBase,
      targetId: null,
      outcome: 'failed',
      payload: {
        mode: 'single',
        sourceCustomerId: parsed.data.sourceCustomerId,
        error: err instanceof Error ? err.message : 'unknown',
      },
    });
    throw err;
  }
}
