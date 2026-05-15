export const PRISMA = Symbol.for('eazepay.prisma');
/** DI token for the {@link DispatcherCronOptions} carrying the
 *  single-replica leader gate + per-cron kill-switch. Injected into
 *  {@link WebhookDispatcher} so the @Cron handler can short-circuit
 *  before touching the database. */
export const DISPATCHER_CRON_OPTIONS = Symbol.for('eazepay.webhook.dispatcherCronOptions');
/** DI token for the ioredis client shared with the rest of the API
 *  (rate limiter, idempotency cache). Reused by the BullMQ queue +
 *  worker to avoid a second Redis connection per replica. */
export const WEBHOOK_QUEUE_REDIS = Symbol.for('eazepay.webhook.queueRedis');

export interface DispatcherCronOptions {
  /** True only on the single replica elected as cron leader. When false
   *  the dispatcher cron no-ops at handler entry — defense in depth on
   *  top of the provider-registration gate in {@link WebhookModule}. */
  cronLeader: boolean;
  /** Per-cron kill-switch. False disables this cron even when the
   *  process is leader; useful for incident isolation. */
  dispatcherEnabled: boolean;
}
