-- ============================================================
-- 0013_rls_policies — Postgres row-level-security as the
-- defence-in-depth tenant-isolation backstop.
--
-- WHY
-- ---
-- Pre-fix, tenant isolation on `applications`, `offers`, `decisions`,
-- `mids`, `partner_marketplaces`, `partner_highsale_subaccounts`,
-- `audit_log` and `application_events` was 100% app-layer: every
-- route handler had to remember to add `WHERE partner_id = ?`. A
-- single missing predicate = cross-tenant leak, indistinguishable
-- from a normal query in the access log.
--
-- This migration adds RLS policies that filter every SELECT / UPDATE /
-- DELETE by `current_setting('app.current_partner_id', true)` and
-- forces RLS even for table owners. The app role
-- (`eazepay_service_role`) has NOBYPASSRLS — RLS applies to every
-- query the BFF makes. The migration role (`eazepay_migration_role`)
-- has BYPASSRLS so DDL / backfills still work.
--
-- The BFF must `SET LOCAL app.current_partner_id = ...` and
-- `SET LOCAL app.role = ...` at the start of every transaction. That
-- wiring lives in `lib/db/index.ts::withTenantContext`. Operators
-- (role='operator') see all rows via the OR-branch in each policy.
--
-- WHAT THIS DOES NOT DO
-- ---------------------
-- Does not GRANT/REVOKE specific privileges per role; those are
-- managed at the database-provisioning layer (Railway / Terraform).
-- The roles are CREATEd here only if missing, with NOLOGIN by
-- default so a fresh local clone does not accidentally expose them.
--
-- IDEMPOTENT — every CREATE ROLE / CREATE POLICY is wrapped in
-- DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$ so the
-- migration is safe to re-apply.
--
-- ALSO IN THIS MIGRATION
-- ----------------------
-- Adds two new values to `application_status` so the decision-engine
-- fail-closed contract has somewhere to write:
--   * 'failed_decisioning'      — upstream decision engine could not
--                                 produce a meaningful result; row
--                                 sits in the operator queue.
--   * 'failed_persisted_to_dlq' — decision was computed but could
--                                 not be persisted; payload is in
--                                 the file-backed DLQ awaiting replay.
-- Both are terminal-pending states from the consumer's perspective.
-- ============================================================

-- ----------------------------------------------------------------
-- 0. Roles — created NOLOGIN by default. Credentials are issued
--    out-of-band at deploy time.
-- ----------------------------------------------------------------

DO $$ BEGIN
  CREATE ROLE eazepay_service_role NOLOGIN NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE eazepay_migration_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 1. Extend application_status enum for fail-closed decision states.
--    `ADD VALUE IF NOT EXISTS` is idempotent on Postgres 12+.
-- ----------------------------------------------------------------

ALTER TYPE "application_status" ADD VALUE IF NOT EXISTS 'failed_decisioning';
ALTER TYPE "application_status" ADD VALUE IF NOT EXISTS 'failed_persisted_to_dlq';

-- ----------------------------------------------------------------
-- 2. Enable + FORCE RLS on every tenant-scoped table.
--    FORCE so even the table owner is subject to policies.
-- ----------------------------------------------------------------

ALTER TABLE "applications"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "applications"                     FORCE  ROW LEVEL SECURITY;

ALTER TABLE "offers"                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offers"                           FORCE  ROW LEVEL SECURITY;

ALTER TABLE "decisions"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decisions"                        FORCE  ROW LEVEL SECURITY;

ALTER TABLE "application_events"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_events"               FORCE  ROW LEVEL SECURITY;

ALTER TABLE "mids"                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mids"                             FORCE  ROW LEVEL SECURITY;

ALTER TABLE "partner_marketplaces"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partner_marketplaces"             FORCE  ROW LEVEL SECURITY;

ALTER TABLE "partner_highsale_subaccounts"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "partner_highsale_subaccounts"     FORCE  ROW LEVEL SECURITY;

ALTER TABLE "audit_log"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log"                        FORCE  ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 3. Policies for tables that carry partner_id directly.
--
-- Shape: the row's partner_id must match the session-scoped
-- `app.current_partner_id` GUC, OR the session role is 'operator'.
-- `current_setting(..., true)` returns NULL when the GUC is missing
-- rather than raising — important so cold connections that forgot to
-- set the context fail CLOSED (NULL never equals anything).
-- ----------------------------------------------------------------

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "applications"
    USING (
      partner_id = current_setting('app.current_partner_id', true)
      OR current_setting('app.role', true) = 'operator'
    )
    WITH CHECK (
      partner_id = current_setting('app.current_partner_id', true)
      OR current_setting('app.role', true) = 'operator'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "mids"
    USING (
      partner_id = current_setting('app.current_partner_id', true)
      OR current_setting('app.role', true) = 'operator'
    )
    WITH CHECK (
      partner_id = current_setting('app.current_partner_id', true)
      OR current_setting('app.role', true) = 'operator'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "partner_marketplaces"
    USING (
      partner_id = current_setting('app.current_partner_id', true)
      OR current_setting('app.role', true) = 'operator'
    )
    WITH CHECK (
      partner_id = current_setting('app.current_partner_id', true)
      OR current_setting('app.role', true) = 'operator'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "partner_highsale_subaccounts"
    USING (
      partner_id = current_setting('app.current_partner_id', true)
      OR current_setting('app.role', true) = 'operator'
    )
    WITH CHECK (
      partner_id = current_setting('app.current_partner_id', true)
      OR current_setting('app.role', true) = 'operator'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- audit_log uses `target_id` to encode the tenant-scoped target;
-- for partner-targeted rows we filter on target_id when target_type
-- is 'partner'. Operator role sees everything (the audit viewer is
-- operator-only today, but the policy is the durable backstop).
DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "audit_log"
    USING (
      current_setting('app.role', true) = 'operator'
      OR (target_type = 'partner'
          AND target_id = current_setting('app.current_partner_id', true))
    )
    WITH CHECK (
      current_setting('app.role', true) = 'operator'
      OR (target_type = 'partner'
          AND target_id = current_setting('app.current_partner_id', true))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 4. Policies for tables joined to applications by application_id.
--    EXISTS subquery walks back to applications.partner_id. The
--    subquery itself is subject to the applications policy, which
--    means an operator-less session can ONLY see offer/decision/
--    event rows whose parent application matches their partner_id.
-- ----------------------------------------------------------------

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "offers"
    USING (
      current_setting('app.role', true) = 'operator'
      OR EXISTS (
        SELECT 1 FROM "applications" a
        WHERE a.id = "offers".application_id
          AND a.partner_id = current_setting('app.current_partner_id', true)
      )
    )
    WITH CHECK (
      current_setting('app.role', true) = 'operator'
      OR EXISTS (
        SELECT 1 FROM "applications" a
        WHERE a.id = "offers".application_id
          AND a.partner_id = current_setting('app.current_partner_id', true)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "decisions"
    USING (
      current_setting('app.role', true) = 'operator'
      OR EXISTS (
        SELECT 1 FROM "applications" a
        WHERE a.id = "decisions".application_id
          AND a.partner_id = current_setting('app.current_partner_id', true)
      )
    )
    WITH CHECK (
      current_setting('app.role', true) = 'operator'
      OR EXISTS (
        SELECT 1 FROM "applications" a
        WHERE a.id = "decisions".application_id
          AND a.partner_id = current_setting('app.current_partner_id', true)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY tenant_isolation ON "application_events"
    USING (
      current_setting('app.role', true) = 'operator'
      OR EXISTS (
        SELECT 1 FROM "applications" a
        WHERE a.id = "application_events".application_id
          AND a.partner_id = current_setting('app.current_partner_id', true)
      )
    )
    WITH CHECK (
      current_setting('app.role', true) = 'operator'
      OR EXISTS (
        SELECT 1 FROM "applications" a
        WHERE a.id = "application_events".application_id
          AND a.partner_id = current_setting('app.current_partner_id', true)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- VERIFICATION (run manually post-deploy)
-- ============================================================
-- 1. SET LOCAL app.current_partner_id = 'acme-medspa';
--    SET LOCAL app.role = 'partner';
--    SELECT COUNT(*) FROM applications;   -- only acme rows
-- 2. SET LOCAL app.role = 'operator';
--    SELECT COUNT(*) FROM applications;   -- all rows
-- 3. RESET app.current_partner_id; RESET app.role;
--    SELECT COUNT(*) FROM applications;   -- zero (fail-closed)
-- ============================================================
