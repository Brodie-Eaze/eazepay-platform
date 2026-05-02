import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { PRISMA } from './internal/tokens.js';
import { AUDIT_SINK, type AuditSink } from './ports/audit-sink.port.js';

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
  ) {}

  // Every minute. The audit sink is best-effort eventual; one minute
  // is well within any practical SLA on audit-drain freshness.
  @Cron(CronExpression.EVERY_MINUTE)
  async runMinute(): Promise<void> {
    await this.drain();
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
