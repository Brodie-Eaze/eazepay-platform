import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PrismaClient } from '@prisma/client';
import { AUDIT_DRAIN_CRON_OPTIONS, type AuditDrainCronOptions, PRISMA } from './internal/tokens.js';
import type { CronLeaderService } from './internal/cron-leader.service.js';
import { LOCK_ID_AUDIT_DRAIN } from './internal/cron-leader.service.js';
import { AUDIT_SINK, type AuditSink } from './ports/audit-sink.port.js';
import { validateAuditPayload } from './audit-payload.js';

const BATCH_SIZE = 200;

/**
 * Drains the AuditOutbox into the configured AuditSink. AuditOutbox
 * rows are intentionally append-only; the drain marks publishedAt
 * (NOT delete) so the source-of-truth Postgres trail persists for the
 * window before retention sweep.
 *
 * Drain ordering: rows are processed in insertion order (id is uuid,
 * so we order by occurredAt then id ascending). The sink's hash chain
 * is contiguous in this order, so any tampering with a Postgres row
 * post-drain shows up as a chain-hash mismatch when verified against
 * the immutable sink copy.
 */
@Injectable()
export class AuditDrainService {
  private readonly logger = new Logger(AuditDrainService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(AUDIT_SINK) private readonly sink: AuditSink,
    @Inject(AUDIT_DRAIN_CRON_OPTIONS) private readonly options: AuditDrainCronOptions,
    private readonly cronLeader: CronLeaderService,
  ) {}

  // Every minute. The audit sink is best-effort eventual; one minute
  // is well within any practical SLA on audit-drain freshness.
  //
  // Three-layer guard. ALL must allow the tick to fire:
  //   1. Postgres advisory lock (PRIMARY). pg_try_advisory_lock at
  //      LOCK_ID_AUDIT_DRAIN — only ONE replica per tick acquires.
  //      Real distributed lock; survives env-flag misconfiguration.
  //      See services/audit/src/internal/cron-leader.service.ts.
  //   2. cronLeader env flag (secondary kill-switch). Lets an operator
  //      yank a misbehaving replica out of the rotation without
  //      restarting Postgres.
  //   3. drainEnabled per-cron kill-switch. Lets an operator pause
  //      audit drain during an incident without affecting webhook /
  //      collection crons.
  // Layers 2 + 3 are also enforced at provider-registration time in
  // {@link AuditModule.forRoot}; this handler-entry check is defense
  // in depth.
  @Cron(CronExpression.EVERY_MINUTE)
  async runMinute(): Promise<void> {
    if (!this.options.cronLeader) return;
    if (!this.options.drainEnabled) return;
    const lock = await this.cronLeader.tryAcquireLock(LOCK_ID_AUDIT_DRAIN);
    if (!lock.held) return;
    try {
      await this.drain();
    } finally {
      await lock.releaseFn();
    }
  }

  /** Public entrypoint for /admin trigger and tests. */
  async drain(): Promise<{ processed: number; failed: number }> {
    const rows = await this.prisma.auditOutbox.findMany({
      where: { publishedAt: null },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
    });
    if (rows.length === 0) return { processed: 0, failed: 0 };

    let processed = 0;
    let failed = 0;
    for (const r of rows) {
      try {
        // SEC-040 — last-line-of-defence PII check before the row
        // crosses into the immutable sink. If a developer accidentally
        // wrote a banned field (ssn / dob / name / address / phone /
        // email / account / routing) into before/after, throwing here
        // keeps the row in the outbox (publishedAt stays null) so it
        // re-tries next sweep. The retry loop won't ever succeed —
        // that's the point: the row needs human intervention before
        // it pollutes the chain. Surface it loudly via the error log
        // so on-call sees it.
        validateAuditPayload(r.before);
        validateAuditPayload(r.after);
        await this.sink.put({
          id: r.id,
          actorType: r.actorType,
          actorId: r.actorId,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          before: r.before ?? null,
          after: r.after ?? null,
          ipAddress: r.ipAddress,
          userAgent: r.userAgent,
          occurredAt: r.occurredAt.toISOString(),
        });
        await this.prisma.auditOutbox.update({
          where: { id: r.id },
          data: { publishedAt: new Date() },
        });
        processed++;
      } catch (err) {
        failed++;
        this.logger.error({ err, rowId: r.id }, 'audit drain put failed; will retry next sweep');
      }
    }
    return { processed, failed };
  }
}
