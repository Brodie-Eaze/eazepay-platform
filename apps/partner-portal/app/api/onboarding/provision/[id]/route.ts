import { NextResponse, type NextRequest } from 'next/server';
import { getRun } from '@/lib/orchestrator/provision';
import { assertPartnerOwnership, requirePartnerSession } from '@/lib/server-guards';

/**
 * GET /api/onboarding/provision/[id]
 *
 * Poll the status of a provisioning run. Returns the full run record
 * including each step's status, timing, note, and result payload.
 *
 * Suggested poll interval: 2s while status is 'queued' | 'running';
 * stop polling once 'completed' | 'failed'.
 *
 * Auth (SEC-001 / Task #41):
 *   - Admin (master / operator demo) sees any run.
 *   - Account session sees only runs where `run.partnerId` matches the
 *     caller's `partnerId` — pre-fix, the route returned ANY run by id,
 *     and run ids include a timestamp prefix that is enumerable.
 *   - Anonymous → 401 at the middleware fence.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePartnerSession(req);
  if (guard instanceof NextResponse) return guard;

  const run = await getRun(params.id);
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

  // IDOR check — caller must own the partner this run is for, or be
  // an admin override. We return 404 (not 403) for the wrong-tenant
  // case to avoid leaking the existence of run ids belonging to
  // other partners.
  const ownership = assertPartnerOwnership(guard, run.partnerId);
  if (ownership) {
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
