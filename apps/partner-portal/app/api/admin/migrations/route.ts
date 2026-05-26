import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listMigrations, seedMigrationQueue, queueMigration } from '@/lib/orchestrator/migration';
import { requireAdmin } from '@/lib/server-guards';

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
  if ('sourceCustomerIds' in parsed.data) {
    const records = await seedMigrationQueue(parsed.data.sourceCustomerIds);
    return NextResponse.json({ queued: records.length, records });
  }
  const record = await queueMigration(parsed.data.sourceCustomerId);
  return NextResponse.json(record, { status: 202 });
}
