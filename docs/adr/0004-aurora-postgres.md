# ADR-0004: Aurora PostgreSQL 16 as primary OLTP

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Brodie (founder/CTO)

## Context

Source-of-truth datastore for users, merchants, applications, offers, loans, repayments, etc. Must support strict ACID, complex relational integrity, partial indexes, JSONB, encryption at rest with KMS, regional replication, and a credible audit story.

## Decision

- Aurora PostgreSQL 16 in `us-east-1` (multi-AZ).
- Aurora Global Database to `us-west-2` for warm-standby DR (RTO ≤ 4h, RPO ≤ 15min target).
- Prisma as the primary ORM (DX-first); raw SQL allowed for hot paths and complex queries.
- Money columns: `BIGINT` cents only (BigInt in TS); no `numeric` for monetary values, never floats.

## Alternatives considered

- **Vanilla RDS Postgres:** workable but Aurora's storage architecture, fast clones for staging, and Global Database make it the right default at fintech scale.
- **DynamoDB as primary:** rejected — relational integrity for lending data is non-negotiable; DynamoDB used only for the audit log (append-only, hot 90d).

## Consequences

- Single-region write primary; cross-region writes require explicit design (we don't need it at MVP).
- Cost is higher than vanilla RDS at small scale but pays back via DR + ops simplicity.
- We standardise on column-level encryption for NPI via KMS-wrapped data keys; full SSN held only in tokenisation vault (not Postgres).

## Compliance / risk notes

PITR enabled. Backups encrypted with KMS. Cross-region snapshot copy. Restore drill quarterly. Per Safeguards Rule we monitor + log access; per BSA/CIP we retain ≥5y post-account-closure on identification records.
