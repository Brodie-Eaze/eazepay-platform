import { NextResponse, type NextRequest } from 'next/server';
import { getRun } from '@/lib/orchestrator/provision';

/**
 * GET /api/onboarding/provision/[id]
 *
 * Poll the status of a provisioning run. Returns the full run record
 * including each step's status, timing, note, and result payload.
 *
 * Suggested poll interval: 2s while status is 'queued' | 'running';
 * stop polling once 'completed' | 'failed'.
 */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const run = getRun(params.id);
  if (!run) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'provision_run_not_found',
      },
      { status: 404 },
    );
  }
  return NextResponse.json(run);
}
