import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listMigrations, seedMigrationQueue, queueMigration } from '@/lib/orchestrator/migration';

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

export async function GET() {
  return NextResponse.json({ migrations: listMigrations() });
}

export async function POST(req: NextRequest) {
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
    const records = seedMigrationQueue(parsed.data.sourceCustomerIds);
    return NextResponse.json({ queued: records.length, records });
  }
  const record = queueMigration(parsed.data.sourceCustomerId);
  return NextResponse.json(record, { status: 202 });
}
