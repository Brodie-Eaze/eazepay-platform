-- ============================================================
-- 0002_offers — first-class offers table for the lender marketplace.
--
-- One row per offer a lender returns for an application. Inserted
-- when a lender POSTs to /api/v1/webhooks/lenders/<id> with a
-- decision (approved | counter | declined | ineligible). Updated in
-- place if the same lender re-quotes (idempotency on lender_id +
-- application_id).
--
-- Money columns are integer cents, APR is basis points (1499 = 14.99%).
-- raw_payload preserves the full webhook body for regulator replay.
--
-- Trigger: offers.updated_at auto-bumps on UPDATE via the existing
-- trigger function created in 0001_init.sql (set_updated_at).
--
-- This migration is idempotent — re-running against an already-
-- migrated database is a no-op because every statement uses
-- IF NOT EXISTS / DO $$ guards.
-- ============================================================

CREATE TABLE IF NOT EXISTS "offers" (
  "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id"         uuid NOT NULL,
  "lender_id"              text NOT NULL,
  "lender_name"            text,
  "decision"               text NOT NULL,
  "amount_cents"           bigint,
  "apr_bps"                integer,
  "term_months"            integer,
  "monthly_payment_cents"  bigint,
  "accepted_at"            timestamptz,
  "expires_at"             timestamptz,
  "declined_reason"        text,
  "raw_payload"            text,
  "created_at"             timestamptz NOT NULL DEFAULT now(),
  "updated_at"             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "offers_app_created_idx"
  ON "offers" ("application_id", "created_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "offers_lender_application_unique"
  ON "offers" ("lender_id", "application_id");

-- Wire the existing trigger_set_updated_at() function (defined in
-- 0001_init.sql) to bump updated_at on every UPDATE. DROP IF EXISTS
-- before CREATE so a re-run is a no-op — matches the partners /
-- applications pattern.
DROP TRIGGER IF EXISTS set_updated_at_offers ON "offers";
CREATE TRIGGER set_updated_at_offers
  BEFORE UPDATE ON "offers"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
