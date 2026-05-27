/**
 * Append-only audit log writer for privileged admin mutations.
 *
 * SOC2 CC8.1 requires that every privileged change (team membership,
 * role grants, infra mutations like migration queue) is recorded with
 * actor + action + target + before/after snapshot. The existing
 * orchestrator code (lib/orchestrator/{provision,migration}.ts) writes
 * directly to `schema.auditLog`; this helper is the single funnel for
 * admin-route mutations so the surface stays consistent and adding a
 * new admin action is one import.
 *
 * Design choices:
 *
 *  - Best-effort write. We never throw out of `writeAuditLog` — losing
 *    one row is preferable to failing the user-visible action AFTER it
 *    already happened. Failures are logged via `safeLog.error` so the
 *    operator dashboard sees the signal.
 *  - No-op when `hasDb()` is false. Admin routes still serve in
 *    `next dev` without DATABASE_URL; we degrade silently rather than
 *    breaking the dev loop. Production deploys always have the DB.
 *  - `outcome` discriminator on the payload so failed-then-retried
 *    actions can be reconstructed by a reviewer.
 *  - Source IP + UA captured from the request when available — required
 *    for SOC2 access-monitoring evidence.
 */

import type { NextRequest } from 'next/server';
import { getDb, hasDb, schema } from './db';
import { safeLog } from './safe-log';

export type AuditOutcome = 'success' | 'failed';

export interface WriteAuditLogInput {
  /** Stable identity of the actor (e.g. `demo:master`, `user:<uuid>`). */
  actor: string;
  /** Dotted action name (`team.member.added`, `migration.queued`, ...). */
  action: string;
  /** Logical type of the thing being acted on (`team_member`, `migration`). */
  targetType: string;
  /** Target id when known (member id, migration id). May be null on
   *  pre-insert failures where the id never minted. */
  targetId?: string | null;
  /** Free-form context, JSON-encoded into `payload_json`. Use it for
   *  before/after snapshots, validation errors, etc. PII MUST be
   *  redacted at the call site; this helper does not re-scan payloads. */
  payload?: Record<string, unknown>;
  outcome: AuditOutcome;
  /** Source request — used to capture IP + UA. Optional so background
   *  jobs / cron writers can still call this helper. */
  req?: NextRequest;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  if (!hasDb()) {
    // Dev fallback — surface the call so engineers see what would have
    // been recorded, but never block the mutation.
    safeLog.info({
      event: 'audit_log.skip_no_db',
      action: input.action,
      actor: input.actor,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      outcome: input.outcome,
    });
    return;
  }

  try {
    const db = getDb();
    await db.insert(schema.auditLog).values({
      actor: input.actor,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      payloadJson: JSON.stringify({
        outcome: input.outcome,
        ...(input.payload ?? {}),
      }),
      ipAddress: input.req ? extractIp(input.req) : null,
      userAgent: input.req?.headers.get('user-agent') ?? null,
    });
  } catch (err) {
    /* Never throw. A failed audit write is a serious signal — the
     * mutation it was attached to already happened — but throwing here
     * would mask the success of that mutation behind a 500. The error
     * surfaces in the operator dashboard via the structured log. */
    safeLog.error({
      event: 'audit_log.write_failed',
      action: input.action,
      actor: input.actor,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      outcome: input.outcome,
      err: err instanceof Error ? err.message : 'unknown',
    });
  }
}

/** Best-effort source-IP extraction. Trusts the first `x-forwarded-for`
 *  hop (Railway / Vercel proxy adds this) and falls back to the
 *  Next.js request's reported ip. */
function extractIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return req.ip ?? null;
}
