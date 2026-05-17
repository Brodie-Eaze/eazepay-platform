# ADR-0011: Audit via transactional outbox + hash-chained sink

- **Status:** Accepted
- **Date:** 2026-05-03
- **Deciders:** Brodie

## Context

Every regulated mutation must produce a tamper-evident audit row.
Auditors read these during exam; consumers' lawyers read them during
disputes; we ourselves read them during incident response. The naive
"log to a file" approach fails on three counts:

1. Logs aren't transactional — a row state can change without a
   matching log line.
2. Logs aren't tamper-evident — anyone with the box can edit them.
3. Logs aren't queryable in regulator-friendly time windows.

## Decision

**Two-stage audit pipeline.**

1. **Transactional outbox in Postgres** (`AuditOutbox` table). Every
   regulated mutation writes a row in the same Prisma transaction
   that produces the state change. Either both happen or neither.

2. **Hash-chained immutable sink** (DynamoDB hot 90d + S3 Object
   Lock cold 7y). A drain consumer (services/audit) ships rows from
   the outbox to the sink with `hash = SHA-256(prevHash ||
canonicalJson(row))`. Tampering with a Postgres row post-drain
   yields a chain mismatch when verified against the sink.

The Postgres copy is the live, queryable view. The sink is the
write-once forensic anchor.

## Alternatives considered

- **Application-layer logging** (Pino → CloudWatch) — useful for
  ops but not audit. No transaction guarantee; CloudWatch is not
  write-once; logs evict on retention.
- **Direct writes to DynamoDB from services** — rejected. Couples
  every service to AWS; no transaction across Postgres + DynamoDB;
  failure modes ugly.
- **Event streaming (Kafka / Kinesis)** — rejected at this stage.
  Operationally heavy for our scale; outbox-pattern → cron drain is
  sufficient. Migration path: replace the cron drain with a CDC
  stream when read latency demands it.

## Consequences

- Every regulated service depends on writing `AuditOutbox` rows
  inside its TXs. Code review checks for this.
- The sink's chain integrity is a regulator-facing artifact. Loss
  of chain head requires a documented incident response.
- A retention sweep eventually purges Postgres rows older than
  their per-class retention window once the sink copy is durable
  (lands with the retention sweep job).

## Compliance / risk notes

This pattern satisfies SOC 2 CC7.2 (audit-log access controls),
the Safeguards Rule's monitoring requirements, and bank-partner
diligence on tamper-evident records. The hash chain across rows is
the property that distinguishes "we kept logs" from "we have
evidence."
