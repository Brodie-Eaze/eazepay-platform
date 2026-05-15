export const PRISMA = Symbol.for('eazepay.prisma');
/** DI token for the {@link CollectionCronOptions} carrying the
 *  single-replica leader gate + per-cron kill-switch. Injected into
 *  {@link CollectionScheduler} so the @Cron handler can short-circuit
 *  before touching the database. */
export const COLLECTION_CRON_OPTIONS = Symbol.for('eazepay.payment.collectionCronOptions');

export interface CollectionCronOptions {
  /** True only on the single replica elected as cron leader. When false
   *  the collection cron no-ops at handler entry — defense in depth on
   *  top of the provider-registration gate in {@link PaymentModule}. */
  cronLeader: boolean;
  /** Per-cron kill-switch. False disables collection even when the
   *  process is leader; useful for incident isolation (e.g. pause
   *  collections during a Nacha return-rate spike). */
  collectionCronEnabled: boolean;
}
