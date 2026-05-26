import { NextResponse, type NextRequest } from 'next/server';
import { getMigration, startMigration } from '@/lib/orchestrator/migration';

/**
 * GET  /api/admin/migrations/[id]       — fetch migration status
 * POST /api/admin/migrations/[id]       — start a queued migration
 */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const record = getMigration(params.id);
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

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const record = startMigration(params.id);
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
