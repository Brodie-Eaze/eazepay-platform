# @eazepay/service-audit

Audit outbox drain → hash-chained immutable sink.

## Responsibilities

- Define the `AuditOutbox` row written by every regulated mutation
  (same TX as the business change, so no row can sneak through
  without an audit)
- Run the drain that ships outbox rows to the immutable sink
  (`local-fs` in dev, `dynamodb` in prod) with per-batch hash chaining
- Provide the `AuditSinkPort` adapter contract

## Public API

- `AuditModule.forRoot({ sink, localFsRoot, drainEnabled, prismaToken, isDevelopment })`
- `AuditDrainService` — the cron-driven drain
- Adapter: `LocalFsAuditSinkAdapter` (dev)
- Port: `AuditSinkPort`

## Dependencies

- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma); the configured sink

## Notes

- The drain should run in `@eazepay/workers`, not in `apps/api`
- Hash chain: each batch's `tipHash = sha256(prevTipHash || sorted-row-hashes)`
  — tampering is detectable on full re-scan
- The sink is append-only; the local-fs adapter writes day-partitioned
  files for diff-friendly review during dev
