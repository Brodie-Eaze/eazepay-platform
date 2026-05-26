-- ============================================================
-- 0008_referential_integrity — foreign-key constraints across the
-- partner-portal schema + ownership-mapping table for HighSale
-- sub-accounts (Task #51 + SEC-001 follow-up).
--
-- Why now
-- -------
-- 0001/0002/0003/0004/0006/0007 shipped without any FKs because the
-- platform was still being scaffolded and we wanted partial inserts
-- (e.g. orphan applications during seed) to succeed. With auth +
-- inbox + decision engine all green, the data is real and orphans
-- are bugs. Without FKs, a CASCADE delete of a partner silently
-- leaves dangling applications / events / decisions in place; the
-- offer page renders, the audit replay points at nothing.
--
-- Why a separate migration vs. baking into the originals
-- ------------------------------------------------------
-- Original migrations have already been applied in lower envs; editing
-- them would force a checksum mismatch in `__drizzle_migrations` and
-- block the migrate runner. Additive 0008 lets every env catch up
-- without operator intervention.
--
-- ON DELETE rationale (matched to the audit table in Task #51)
-- ------------------------------------------------------------
--   applications.partner_id          → partners.id   (intentionally no FK)
--       The synthetic `'__unattributed__'` sentinel value MUST keep
--       working — adding a FK would require either a placeholder
--       partner row (carries its own integrity hazards: brand? legal_name?)
--       or per-write conditional logic. Soft reference + the application
--       index that filters by partner_id is sufficient. Documented
--       on schema.ts to keep the contract visible.
--
--   application_events.application_id → applications.id (CASCADE)
--       Events have no meaning without their application. Deleting an
--       application deletes its event trail. Regulator replay still
--       works because applications are NEVER deleted in production —
--       the cascade is a safety net for test fixtures + GDPR RTBF.
--
--   offers.application_id            → applications.id (CASCADE)
--       Same logic as events: an offer without its application is
--       meaningless. Lender_id stays soft (no FK) because lenders.id
--       is a text slug and a renamed lender shouldn't orphan history.
--
--   partner_marketplaces.partner_id  → partners.id  (CASCADE)
--   partner_marketplaces.lender_id   → lenders.id   (CASCADE)
--       Per-partner override rows are pure config; if either side is
--       deleted the override is meaningless. Cascade keeps the table
--       tidy without operator intervention.
--
--   mids.partner_id                  → partners.id  (RESTRICT)
--       A partner with an active MID is a live merchant. RESTRICT
--       forces the operator to explicitly pause / migrate the MID
--       first — a partner deletion without that audit trail would be
--       a compliance incident.
--
--   decisions.application_id         → applications.id (CASCADE)
--       Same reasoning as events / offers — the decision is keyed on
--       the application; without it, the row is uninterpretable.
--
--   customer_migrations.target_partner_id → partners.id (SET NULL)
--       Migration is historical record of "we built this partner from
--       this AI Funding customer". If the partner row is later deleted
--       we want the migration record to survive so the audit trail
--       remains intact — set the FK column to NULL.
--
--   provisioning_runs.partner_id     → partners.id (SET NULL)
--       Same audit-survival reasoning as customer_migrations. A failed
--       provisioning run for a partner that was never created should
--       not be lost when the partial partner row is cleaned up.
--
-- Tables with no FK target (intentional)
-- --------------------------------------
--   webhook_inbox.*                  Provider event ids are external.
--   vertical_configs.brand           Enum-bound, no FK needed.
--   audit_log.target_id              Polymorphic (text); FK impossible
--                                    because the target_type varies
--                                    (lender | partner | vertical_config |
--                                    mid | migration | provisioning_run).
--   idempotency_keys.*               Pure dedupe store.
--
-- New table: partner_highsale_subaccounts
-- ---------------------------------------
-- The HighSale orchestrator step `partner_portal_seed` (in
-- lib/orchestrator/provision.ts) creates a sub-account but we had
-- nowhere to record the (subaccount_id → partner_id) mapping. The new
-- `assertResourceOwnership('subaccount', ...)` lookup needs that
-- mapping to block cross-tenant prequal calls. CASCADE on partner
-- deletion: if the partner is gone the sub-account ownership row is
-- meaningless (the HighSale-side sub-account would be archived
-- separately via the orchestrator's deprovision path).
--
-- All statements are idempotent (DO $$ EXCEPTION block per constraint,
-- IF NOT EXISTS for the new table + indexes) so a half-applied run
-- can be safely retried.
--
-- Orphan rows in pre-production environments
-- ------------------------------------------
-- These FKs are validated against existing data — if a lower env has
-- orphan applications / events / decisions from earlier test runs the
-- ALTER will fail with `insert or update on table "X" violates foreign
-- key constraint`. That is the correct behavior: orphans are bugs and
-- this is the first opportunity to surface them. To clean up, the
-- operator runs:
--   DELETE FROM application_events WHERE application_id NOT IN
--     (SELECT id FROM applications);
-- (and the equivalent for each child table) before re-running the
-- migration.
-- ============================================================

-- ---------- nullability prep for SET NULL FKs ----------
--
-- ON DELETE SET NULL only works if the referencing column is nullable.
-- `provisioning_runs.partner_id` is currently NOT NULL (see
-- 0004_orchestrator_persistence). Relaxing the constraint here lets the
-- FK clear the column on partner deletion while preserving the audit
-- record. Existing rows are unaffected — a NULL becomes possible, not
-- mandatory, and the orchestrator continues to write a real partner_id
-- on every insert.
ALTER TABLE "provisioning_runs"
  ALTER COLUMN "partner_id" DROP NOT NULL;

-- ---------- new ownership table ----------

CREATE TABLE IF NOT EXISTS "partner_highsale_subaccounts" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_id"      text NOT NULL,
  "subaccount_id"   text NOT NULL,
  "bureau"          text,
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"      timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_highsale_subaccounts_subaccount_unique"
  ON "partner_highsale_subaccounts" ("subaccount_id");
CREATE INDEX IF NOT EXISTS "partner_highsale_subaccounts_partner_idx"
  ON "partner_highsale_subaccounts" ("partner_id");

-- Reuse the trigger function from 0001_init.sql for updated_at maintenance.
DROP TRIGGER IF EXISTS set_updated_at_partner_highsale_subaccounts
  ON "partner_highsale_subaccounts";
CREATE TRIGGER set_updated_at_partner_highsale_subaccounts
  BEFORE UPDATE ON "partner_highsale_subaccounts"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------- foreign keys ----------
--
-- Postgres doesn't have ADD CONSTRAINT IF NOT EXISTS; each FK lives
-- in its own DO $$ block that swallows the duplicate_object exception
-- so re-runs are no-ops.

DO $$ BEGIN
  ALTER TABLE "application_events"
    ADD CONSTRAINT "application_events_application_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "applications" ("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "offers"
    ADD CONSTRAINT "offers_application_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "applications" ("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "partner_marketplaces"
    ADD CONSTRAINT "partner_marketplaces_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners" ("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "partner_marketplaces"
    ADD CONSTRAINT "partner_marketplaces_lender_id_fk"
    FOREIGN KEY ("lender_id") REFERENCES "lenders" ("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "mids"
    ADD CONSTRAINT "mids_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners" ("id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "decisions"
    ADD CONSTRAINT "decisions_application_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "applications" ("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "customer_migrations"
    ADD CONSTRAINT "customer_migrations_target_partner_id_fk"
    FOREIGN KEY ("target_partner_id") REFERENCES "partners" ("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "provisioning_runs"
    ADD CONSTRAINT "provisioning_runs_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners" ("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "partner_highsale_subaccounts"
    ADD CONSTRAINT "partner_highsale_subaccounts_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners" ("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
