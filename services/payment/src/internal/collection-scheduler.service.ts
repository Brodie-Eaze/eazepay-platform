import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PrismaClient } from '@prisma/client';
import type { CronLeaderService } from '@eazepay/service-audit';
import { LOCK_ID_COLLECTION } from '@eazepay/service-audit';
import { COLLECTION_CRON_OPTIONS, type CollectionCronOptions, PRISMA } from './tokens.js';
import type { PaymentService } from '../payment.service.js';

const BATCH_SIZE = 500;
// Cap the number of batches per tick so the collection cron cannot
// monopolise the leader replica's cron thread. At BATCH_SIZE=500 and
// MAX_LOOPS=4 we drain up to 2,000 due repayments per tick — enough
// headroom for ~10x current daily volume, while still freeing the
// leader replica's cron scheduler within a bounded wall-clock budget
// so the audit-drain and webhook-dispatcher crons (also leader-only)
// aren't starved. If the queue exceeds 2,000 a single day, the next
// scheduled tick or the manual /admin trigger picks up the residue.
const MAX_LOOPS = 4;

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
 *  - Bounded loop: at most MAX_LOOPS batches per cron tick. Prevents a
 *    multi-thousand-row catchup from starving sibling crons on the
 *    same elected leader replica.
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
    @Inject(COLLECTION_CRON_OPTIONS) private readonly options: CollectionCronOptions,
    private readonly cronLeader: CronLeaderService,
  ) {}

  // 08:00 UTC daily — early enough for ACH same-day windows.
  //
  // Three-layer guard. ALL must allow the tick to fire:
  //   1. Postgres advisory lock (PRIMARY). pg_try_advisory_lock at
  //      LOCK_ID_COLLECTION — only ONE replica per tick acquires.
  //      Real distributed lock; survives env-flag misconfiguration.
  //   2. cronLeader env flag (secondary kill-switch).
  //   3. collectionCronEnabled per-cron kill-switch. Operators flip
  //      this off (via env reload + restart) during high-return-rate
  //      incidents without having to disable the webhook / audit crons
  //      or take the leader replica down entirely.
  // Layers 2 + 3 are also enforced at provider-registration time in
  // {@link PaymentModule.forRoot} — this handler-entry check is
  // defense in depth.
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDaily(): Promise<void> {
    if (!this.options.cronLeader) return;
    if (!this.options.collectionCronEnabled) return;
    const lock = await this.cronLeader.tryAcquireLock(LOCK_ID_COLLECTION);
    if (!lock.held) return;
    try {
      await this.collectDue();
    } finally {
      await lock.releaseFn();
    }
  }

  /** Public entry point so it can also be triggered manually from /admin. */
  async collectDue(): Promise<{ attempted: number; succeeded: number; failed: number }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let attemptedTotal = 0;
    let succeeded = 0;
    let failed = 0;

    // Loop while the previous batch returned a full page AND we have
    // loop budget remaining. Each batch is sorted by (dueDate ASC,
    // sequence ASC) and we set processed rows out of the `due` status
    // via collectRepayment, so successive findMany calls return the
    // next slice without an explicit cursor.
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const due = await this.prisma.repayment.findMany({
        where: {
          dueDate: { lte: today },
          status: { in: ['scheduled', 'due', 'late', 'partial'] },
          loan: { status: 'active' },
        },
        orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
        take: BATCH_SIZE,
      });

      if (due.length === 0) break;
      attemptedTotal += due.length;

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

      // If we got a partial page back, the queue is drained — bail
      // out before incurring another findMany round-trip.
      if (due.length < BATCH_SIZE) break;
    }

    this.logger.log(
      `collection sweep complete attempted=${attemptedTotal} succeeded=${succeeded} failed=${failed}`,
    );
    return { attempted: attemptedTotal, succeeded, failed };
  }
}
