-- ============================================================
-- 0001_init — initial schema for the partner-portal data layer.
--
-- Tables
--   partners              persisted partner directory (seeded from
--                         master-data fixture once on first deploy)
--   applications          every consumer apply-flow submission
--   application_events    append-only audit log per application
--
-- Enums
--   brand                 medpay | tradepay | coachpay
--   application_status    submitted | in_review | approved | funded | declined
--   application_event_type  created | status_changed | lender_quoted |
--                           offer_accepted | lender_funded | note_added
--
-- Trigger: `applications.updated_at` and `partners.updated_at` auto-
-- update on every UPDATE via the trigger function set below.
--
-- This migration is idempotent — re-running it against an already-
-- migrated database is a no-op because every statement uses
-- IF NOT EXISTS / DO $$ guards.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "brand" AS ENUM ('medpay', 'tradepay', 'coachpay');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "application_status" AS ENUM (
    'submitted', 'in_review', 'approved', 'funded', 'declined'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "application_event_type" AS ENUM (
    'created', 'status_changed', 'lender_quoted',
    'offer_accepted', 'lender_funded', 'note_added'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "partners" (
  "id"                    text PRIMARY KEY,
  "brand"                 "brand" NOT NULL,
  "legal_name"            text NOT NULL,
  "display_name"          text,
  "product"               text,
  "status"                text NOT NULL DEFAULT 'active',
  "primary_contact_email" text,
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "partners_brand_idx" ON "partners" ("brand");
CREATE INDEX IF NOT EXISTS "partners_legal_name_idx" ON "partners" ("legal_name");

CREATE TABLE IF NOT EXISTS "applications" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "brand"            "brand" NOT NULL,
  "partner_id"       text NOT NULL,
  "ref_query"        text,
  "consumer_first"   text NOT NULL,
  "consumer_last"    text NOT NULL,
  "consumer_email"   text NOT NULL,
  "consumer_phone"   text NOT NULL,
  "amount_cents"     bigint NOT NULL CHECK ("amount_cents" > 0),
  "tier"             text,
  "selected_lender"  text,
  "status"           "application_status" NOT NULL DEFAULT 'submitted',
  "request_id"       text,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "applications_partner_created_idx"
  ON "applications" ("partner_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "applications_brand_created_idx"
  ON "applications" ("brand", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "applications_brand_status_created_idx"
  ON "applications" ("brand", "status", "created_at" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "applications_request_id_unique"
  ON "applications" ("request_id")
  WHERE "request_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "application_events" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL,
  "type"           "application_event_type" NOT NULL,
  "from_status"    "application_status",
  "to_status"      "application_status",
  "payload"        text,
  "actor"          text NOT NULL DEFAULT 'system',
  "created_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "application_events_app_created_idx"
  ON "application_events" ("application_id", "created_at" DESC);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_partners ON "partners";
CREATE TRIGGER set_updated_at_partners
  BEFORE UPDATE ON "partners"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_applications ON "applications";
CREATE TRIGGER set_updated_at_applications
  BEFORE UPDATE ON "applications"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
