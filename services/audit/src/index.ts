export * from './audit.module.js';
export * from './audit-drain.service.js';
export * from './ports/audit-sink.port.js';
export * from './adapters/local-fs-audit-sink.adapter.js';
export * from './adapters/s3-worm.adapter.js';
// Audit hash-chain integrity verifier — runs daily under the cron
// leader, alerts on any chain break by hash mismatch or missing prev.
export * from './internal/chain-verify.cron.js';
// SEC-040 — typed payload contract for audit writes; runtime validator
// + compile-time `AuditWritePayload<T>` mapped type.
export * from './audit-payload.js';
// Postgres advisory-lock based cron leader election — primary
// distributed-lock mechanism for the three timed crons. CRON_LEADER
// env stays as secondary kill-switch.
export {
  CronLeaderService,
  LOCK_ID_WEBHOOK_DISPATCHER,
  LOCK_ID_AUDIT_DRAIN,
  LOCK_ID_COLLECTION,
  type CronLeaderLockHandle,
} from './internal/cron-leader.service.js';
