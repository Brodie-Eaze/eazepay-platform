-- SEC-119 — composite indexes for two hot query paths the audit
-- (operational maturity round) flagged as missing.
--
-- 1. AuditOutbox (audit_outbox)
--    "Show me what actor X did, newest first" — admin investigation,
--    compliance evidence pull, SOC2 export. Pre-fix the only indexes
--    were (published_at) and (target_type, target_id), so per-actor
--    queries did a sequential scan over the whole table.
--
-- 2. Application (applications)
--    Operator dashboards filter by (merchantId, status, newest first)
--    every time the partner control panel paints. Pre-fix Postgres
--    picked (merchant_id, created_at) and post-filtered by status,
--    which got slower with each partner's growing application history.
--
-- Both indexes are created CONCURRENTLY so we don't take a write lock
-- on tables that are hot. CONCURRENTLY cannot run inside a transaction
-- block — Prisma migrations run each statement in its own transaction
-- by default; the inline comments below pin that requirement so a
-- future contributor doesn't wrap these in BEGIN/COMMIT.

-- audit_outbox: actor lookup, recency-ordered.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_outbox_actor_type_actor_id_occurred_at_idx"
  ON "audit_outbox" ("actor_type", "actor_id", "occurred_at" DESC);

-- applications: merchant-status filter, recency-ordered.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "applications_merchant_id_status_created_at_idx"
  ON "applications" ("merchant_id", "status", "created_at" DESC);
