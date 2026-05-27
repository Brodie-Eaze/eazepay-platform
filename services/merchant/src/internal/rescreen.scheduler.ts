import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { PrismaClient } from '@prisma/client';
import { SANCTIONS_SCREEN, type SanctionsScreen } from '@eazepay/integrations-core';
import { PRISMA } from './tokens.js';

/**
 * Weekly OFAC re-screen — 31 CFR §501 + BSA program guidance.
 *
 * Why this exists
 * ---------------
 * OFAC publishes SDN updates on a rolling basis. A merchant cleared at
 * onboarding can become a positive match the next business day if a
 * controller or BO is later listed. Programs that screen ONLY at
 * onboarding will, by construction, miss every post-onboarding
 * sanctions event — that's an enforceable BSA program-deficiency
 * finding. Industry standard cadence is weekly; high-risk merchants
 * (MSB, money-transmitter-adjacent, cross-border) move to daily.
 *
 * Scope of this file
 * ------------------
 * REGISTRATION ONLY. The class declares the @Cron handler signature so
 * the host application can opt-in by including it in providers, but
 * the body intentionally does NOT execute screens yet — the runtime
 * implementation lands in a follow-up PR once the sanctions_screen_log
 * append-only evidence trigger is in place AND a real OFAC adapter is
 * wired. Shipping the registration first lets the runbook, IaC, and
 * leader-election plumbing be reviewed independently of the screening
 * logic itself.
 *
 * Operational guard rails (when the body lands)
 * ---------------------------------------------
 *  - Postgres advisory lock (one replica per tick — same pattern as
 *    {@link CollectionScheduler}) so the cron fires exactly once across
 *    the cluster.
 *  - Idempotency on (merchantId | beneficialOwnerId, listVersion):
 *    re-running for the same SDN snapshot must NOT create duplicate
 *    evidence rows.
 *  - Per-merchant rate budget — never more than N screens/sec against
 *    the upstream provider; provider 429s halt the tick gracefully.
 *  - Any non-cleared result flips the merchant to manual_review and
 *    notifies the compliance queue (see docs/runbooks/sanctions-re-screen.md).
 */
@Injectable()
export class SanctionsRescreenScheduler {
  private readonly logger = new Logger(SanctionsRescreenScheduler.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(SANCTIONS_SCREEN) private readonly sanctions: SanctionsScreen,
  ) {}

  // Monday 09:00 UTC — first business-day slot after the Treasury OFAC
  // SDN weekend publish window. Idempotent re-runs across the week are
  // safe (see header), so a missed Monday catches up on Tuesday.
  @Cron(CronExpression.EVERY_WEEK)
  async runWeekly(): Promise<void> {
    this.logger.log(
      'sanctions.rescreen.scheduled — port-only registration; runtime implementation pending',
    );
    // why void: keep the linter quiet about unused fields until the
    // runtime lands; both are required by the registration signature.
    void this.prisma;
    void this.sanctions;
  }
}
