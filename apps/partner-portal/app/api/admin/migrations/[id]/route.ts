import { NextResponse, type NextRequest } from 'next/server';
import { getMigration, startMigration } from '@/lib/orchestrator/migration';
import { requireAdmin } from '@/lib/server-guards';

/**
 * GET  /api/admin/migrations/[id]       — fetch migration status
 * POST /api/admin/migrations/[id]       — start a queued migration
 */

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // SEC-001: admin-only.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const record = await getMigration(params.id);
  if (!record) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'migration_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json(record);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // SEC-001: admin-only.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const record = await startMigration(params.id);
  if (!record) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'migration_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json(record, { status: 202 });
}
