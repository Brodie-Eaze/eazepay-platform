export const PRISMA = Symbol.for('eazepay.prisma');
/** DI token for the {@link AuditDrainCronOptions} carrying the
 *  single-replica leader gate + per-cron kill-switch. Injected into
 *  {@link AuditDrainService} so the @Cron handler can short-circuit
 *  before touching the database. */
export const AUDIT_DRAIN_CRON_OPTIONS = Symbol.for('eazepay.audit.drainCronOptions');

export interface AuditDrainCronOptions {
  /** True only on the single replica elected as cron leader. When false
   *  the drain cron no-ops at handler entry — defense in depth on top
   *  of the provider-registration gate in {@link AuditModule}. */
  cronLeader: boolean;
  /** Per-cron kill-switch. False disables the drain even when the
   *  process is leader; useful for incident isolation. */
  drainEnabled: boolean;
}
