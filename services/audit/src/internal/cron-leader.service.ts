import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PRISMA } from './tokens.js';

/**
 * ──────────────────────────────────────────────────────────────────────
 * Postgres advisory-lock based cron leader election (real distributed lock).
 * ──────────────────────────────────────────────────────────────────────
 *
 * Why this exists:
 *   The platform runs three timed crons (webhook dispatcher, audit-outbox
 *   drain, daily repayment collection). Pre-fix, the only multi-replica
 *   safety was the `CRON_LEADER` env flag — operator-set on exactly one
 *   replica. Easy to misconfigure: a Railway / k8s rolling deploy that
 *   accidentally leaves the flag `true` on two replicas leads to
 *   duplicate work — duplicate audit-sink puts (paid per write on
 *   DynamoDB), duplicate webhook deliveries (merchant idempotency
 *   bounds correctness, not cost), duplicate collection attempts (the
 *   PaymentProvider idempotency key collapses charges, but each replica
 *   burns DB + provider API quota).
 *
 * What this is:
 *   A wrapper around Postgres `pg_try_advisory_lock(<id>)` — a session-
 *   level lock identified by a 64-bit integer. Held for the duration of
 *   the cron tick: each tick calls `tryAcquireLock` at handler entry; if
 *   `held=false`, return immediately (another replica owns the tick).
 *   If `held=true`, run the work in a try/finally and release on exit.
 *
 *   The lock is process-scoped (session-level), so a process crash mid-
 *   tick automatically releases the lock at session teardown — no
 *   orphaned locks, no fencing token required. The `nextAttemptAt`
 *   per-row claim already bounds correctness if the lock is held by a
 *   crashed replica; the lock just stops duplicate WORK, not duplicate
 *   correctness guarantees.
 *
 * Why this is the PRIMARY mechanism:
 *   Even if every replica has `CRON_LEADER=true`, only ONE acquires
 *   `pg_try_advisory_lock` per tick. The `CRON_LEADER` env flag stays
 *   in place as a SECONDARY kill-switch (belt-and-braces) — flipping it
 *   to `false` on a replica still no-ops every cron in that process at
 *   handler entry. The advisory lock is the load-bearing guarantee.
 *
 * Lock ID reservation:
 *   PostgreSQL advisory locks are identified by either a single bigint
 *   or two int4s. We use the single-bigint variant. The IDs below are
 *   reserved per cron — pick a fresh number from the 41xxx range when
 *   adding a new cron so namespace collisions are impossible.
 *
 *   Reserved IDs:
 *     - LOCK_ID_WEBHOOK_DISPATCHER  = 41011
 *     - LOCK_ID_AUDIT_DRAIN         = 41012
 *     - LOCK_ID_COLLECTION          = 41013
 *
 *   Reservation registry: see comment in apps/api/prisma/schema.prisma
 *   above the AuditOutbox model.
 *
 * Why pg_try_advisory_lock (not pg_advisory_lock):
 *   - `pg_advisory_lock` blocks until acquired; on a busy leader it
 *     would queue every replica's cron tick behind the leader's, which
 *     is the opposite of what we want. We want "if someone else has it,
 *     skip this tick and try again next minute".
 *   - `pg_try_advisory_lock` returns boolean immediately. Non-blocking,
 *     idempotent, exactly the right semantic for "elect a tick leader".
 * ──────────────────────────────────────────────────────────────────────
 */

/** Webhook outbound dispatcher cron (every minute). */
export const LOCK_ID_WEBHOOK_DISPATCHER = 41011;
/** Audit-outbox drain cron (every minute). */
export const LOCK_ID_AUDIT_DRAIN = 41012;
/** Daily repayment collection cron (08:00 UTC). */
export const LOCK_ID_COLLECTION = 41013;

export interface CronLeaderLockHandle {
  /** True if this process owns the lock for the current tick. When
   *  false, the caller MUST return immediately — another replica is
   *  running the work. */
  held: boolean;
  /** Releases the advisory lock. Safe to call even when held=false
   *  (no-ops). Always invoke from a `finally` so a thrown exception in
   *  the cron body doesn't leak the lock for the rest of the session. */
  releaseFn: () => Promise<void>;
}

/**
 * Shared service wrapping `pg_try_advisory_lock`. Single instance per
 * NestJS module — inject by class. Constructed with a PrismaClient
 * whose pool is shared with the rest of the app: advisory locks are
 * session-scoped, but Prisma maps a single `$queryRaw` call to a
 * single backend session for its duration, and explicit
 * `pg_advisory_unlock` on the same client releases it. We retain the
 * same client across acquire + release by passing the same `prisma`
 * reference into `releaseFn`.
 */
@Injectable()
export class CronLeaderService {
  private readonly logger = new Logger(CronLeaderService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Attempt to acquire the advisory lock for `lockId`.
   *
   * Returns `{ held: false }` if another replica owns it; the caller
   * should return immediately. Returns `{ held: true, releaseFn }` if
   * acquired — the caller MUST invoke `releaseFn()` in a `finally` to
   * release on every exit path (success, thrown error, early return).
   *
   * Failure modes handled:
   *   - DB unreachable: rethrown to the caller. The cron's existing
   *     handler-entry guard logic will skip the tick.
   *   - Lock already held by this session (a buggy double-acquire):
   *     `pg_try_advisory_lock` returns true a second time and the lock
   *     count goes to 2 — the release path here calls unlock once, so
   *     a buggy double-acquire would still leave a lock held. Crons
   *     that call this only once per tick are safe; document this if
   *     ever extended.
   */
  async tryAcquireLock(lockId: number): Promise<CronLeaderLockHandle> {
    // pg_try_advisory_lock returns a single-column result set with the
    // boolean acquisition outcome. Prisma $queryRaw returns it as
    // `[{ pg_try_advisory_lock: boolean }]`.
    const result = await this.prisma.$queryRaw<
      Array<{ pg_try_advisory_lock: boolean }>
    >`SELECT pg_try_advisory_lock(${lockId}) as pg_try_advisory_lock`;
    const held = result[0]?.pg_try_advisory_lock === true;

    if (!held) {
      return {
        held: false,
        // No-op release on contention: nothing to release, but the
        // caller may still invoke this in their finally.
        releaseFn: async () => {
          /* no-op */
        },
      };
    }

    const releaseFn = async (): Promise<void> => {
      try {
        await this.prisma.$queryRaw`SELECT pg_advisory_unlock(${lockId})`;
      } catch (err) {
        // Release failure is logged but never rethrown — the caller's
        // finally must not mask the original error. Postgres session
        // teardown will release the lock on disconnect anyway.
        this.logger.warn(
          { err, lockId },
          'pg_advisory_unlock failed — lock will release at session end',
        );
      }
    };

    return { held: true, releaseFn };
  }
}
