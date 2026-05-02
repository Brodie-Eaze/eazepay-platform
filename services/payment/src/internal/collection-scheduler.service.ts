import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { PRISMA } from './tokens.js';
import { PaymentService } from '../payment.service.js';

const BATCH_SIZE = 100;

/**
 * Daily collection sweep. Looks for repayments whose dueDate has
 * arrived and that are not yet paid, and attempts collection via the
 * configured PaymentProvider.
 *
 * Hard rules baked in here:
 *  - One charge per Repayment per cron run. Idempotency-key on the
 *    PaymentProvider call is `collect-{repaymentId}` so retries on a
 *    later run collapse to the same Transaction.
 *  - Errors are logged + audit-rowed; never re-thrown so a single bad
 *    repayment doesn't poison the whole run.
 *  - Settled `paid` repayments are skipped via the where clause; we
 *    never re-evaluate them.
 *
 * Production hardening (next round): move to a queue with per-job
 * retry policy + exponential backoff; gate on Nacha return-rate
 * thresholds before running; expose a manual /admin trigger.
 */
@Injectable()
export class CollectionScheduler {
  private readonly logger = new Logger(CollectionScheduler.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly payments: PaymentService,
  ) {}

  // 08:00 UTC daily — early enough for ACH same-day windows.
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDaily(): Promise<void> {
    await this.collectDue();
  }

  /** Public entry point so it can also be triggered manually from /admin. */
  async collectDue(): Promise<{ attempted: number; succeeded: number; failed: number }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const due = await this.prisma.repayment.findMany({
      where: {
        dueDate: { lte: today },
        status: { in: ['scheduled', 'due', 'late', 'partial'] },
        loan: { status: 'active' },
      },
      orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
      take: BATCH_SIZE,
    });

    let succeeded = 0;
    let failed = 0;
    for (const r of due) {
      try {
        const result = await this.payments.collectRepayment(r.id);
        if (result.status === 'succeeded') succeeded++;
        else failed++;
      } catch (err) {
        failed++;
        this.logger.error(
          { err, repaymentId: r.id },
          'collection error — skipping; audit row will be written by collectRepayment if it reached the persist step',
        );
      }
    }

    this.logger.log(
      `collection sweep complete attempted=${due.length} succeeded=${succeeded} failed=${failed}`,
    );
    return { attempted: due.length, succeeded, failed };
  }
}
