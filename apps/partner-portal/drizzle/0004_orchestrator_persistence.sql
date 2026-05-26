-- ============================================================
-- 0004_orchestrator_persistence — persist provision/migration
-- orchestrator state to Postgres so polls survive worker rotations
-- and Railway redeploys, and so SOC 2 CC8.1 audit trail can be
-- replayed.
--
-- Tables added
--   provisioning_runs   one row per partner provisioning attempt
--
-- Existing tables `customer_migrations`, `mids`, and `audit_log`
-- already have the columns the orchestrator now writes to (see
-- 0003_platform_scaffolding.sql) — no schema change there.
--
-- All statements are idempotent (IF NOT EXISTS) so a half-applied
-- run can be safely retried.
-- ============================================================

CREATE TABLE IF NOT EXISTS "provisioning_runs" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_id"        text NOT NULL,
  "brand"             text NOT NULL,
  "status"            text DEFAULT 'queued' NOT NULL,
  "steps_json"        text,
  "started_at"        timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at"      timestamp with time zone,
  "failure_reason"    text,
  "created_at"        timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "provisioning_runs_partner_idx"
  ON "provisioning_runs" ("partner_id");
CREATE INDEX IF NOT EXISTS "provisioning_runs_status_idx"
  ON "provisioning_runs" ("status");
CREATE INDEX IF NOT EXISTS "provisioning_runs_started_at_idx"
  ON "provisioning_runs" ("started_at");
