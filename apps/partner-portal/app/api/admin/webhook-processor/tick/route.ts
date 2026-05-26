import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { hasDb } from '@/lib/db';
import { inboxBacklog, processInbox } from '@/lib/workers/webhook-processor';
import { safeLog } from '@/lib/safe-log';

/**
 * POST /api/admin/webhook-processor/tick
 *
 * Manual kick-off for the webhook inbox processor. Drains pending rows
 * from `webhook_inbox` (limit 50), dispatches each to its provider's
 * event handler, and returns per-status counts.
 *
 * This endpoint is the TEMPORARY trigger until BullMQ lands in Task #50,
 * at which point a repeatable job will call `processInbox()` instead
 * and this route becomes ops-only (re-drain on demand after a handler
 * fix).
 *
 * Authz: operator session required. `processInbox()` does not take any
 * tenant scope because the inbox is platform-global — events from
 * MiCamp / HighSale arrive without partner context until the handler
 * resolves the target row.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function problem(status: number, code: string, detail: string) {
  return NextResponse.json({ type: 'about:blank', title: code, status, code, detail }, { status });
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext(req);
  // TODO(SEC-104): switch to `requireAdmin(req)` once Builder B's
  // helper lands. Until then we accept the same gate the existing
  // admin routes use (mode='demo' && isOperator) — narrowest valid
  // check we can express without that helper.
  const isOperator = session.mode === 'demo' && session.isOperator;
  if (!isOperator) {
    return problem(403, 'forbidden', 'Webhook processor tick requires an operator session.');
  }

  if (!hasDb()) {
    return problem(503, 'db_unavailable', 'Webhook inbox database is not yet provisioned.');
  }

  try {
    const startedAt = Date.now();
    const result = await processInbox();
    const backlog = await inboxBacklog();
    const durationMs = Date.now() - startedAt;

    safeLog.info({
      event: 'webhook.processor.tick.invoked',
      actor: session.preset,
      durationMs,
      ...result,
      backlogPending: backlog.pending,
      backlogFailed: backlog.failed,
    });

    return NextResponse.json({
      ok: true,
      durationMs,
      ...result,
      backlog,
    });
  } catch (err) {
    safeLog.error({
      event: 'webhook.processor.tick.failed',
      actor: session.preset,
      error: err instanceof Error ? err.message : String(err),
    });
    return problem(
      500,
      'processor_failed',
      err instanceof Error ? err.message : 'Unknown processor error',
    );
  }
}
