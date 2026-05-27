-- ============================================================
-- 0018_text_to_pgenum — promote five string-as-enum columns from
-- `text` to first-class Postgres ENUM types.
--
-- WHY
-- ---
-- Five columns currently carry `text` with the canonical set of values
-- enforced only in the Drizzle/Zod layer:
--
--   * webhook_inbox.processing_status   ('pending'|'processing'|'done'|'failed')
--   * offers.decision                   ('approved'|'counter'|'declined'|'ineligible')
--   * mids.provisioning_status          ('requested'|'pending'|'active'|'failed')
--   * lenders.status                    ('active'|'paused'|'pending_integration'|'deprecated')
--   * provisioning_runs.status          ('queued'|'running'|'completed'|'failed')
--
-- Promoting to a CREATE TYPE … AS ENUM tightens the DB-side contract:
-- a typo in raw SQL or a mis-coerced row from an external loader is
-- rejected at write time, not silently persisted. Drizzle's $inferInsert
-- also infers the literal-union from the enum, so application code
-- no longer needs `as Provider` / `as ProvisionRun['status']` casts to
-- satisfy the typer.
--
-- INTENTIONALLY LEFT AS TEXT
-- --------------------------
-- `webhook_inbox.provider` remains `text`. The column carries both
-- first-party providers ('micamp'|'highsale'|'trutopia') AND arbitrary
-- lender slugs ('lp_buzzpay_prime', etc.) — adding a lender today
-- shouldn't require a schema migration tomorrow. The first-party set
-- is declared as `webhook_provider_enum` for documentation + TS type
-- narrowing in the dispatcher, but the column itself stays open-ended.
--
-- IDEMPOTENT
-- ----------
-- Every CREATE TYPE is wrapped in DO $$ … EXCEPTION WHEN duplicate_object
-- so re-running the migration is a no-op. The ALTER TABLE … TYPE …
-- USING <col>::<enum> casts are inherently idempotent — re-applying
-- when the column is already the enum type is allowed by Postgres.
--
-- DATA SAFETY
-- -----------
-- The USING <col>::<enum> cast will FAIL LOUD if any row holds a value
-- outside the enum set. That is the desired behaviour: a legacy
-- 'live' / 'archived' / 'underwriting_pre' value should not be
-- silently coerced into a different bucket. If this migration fails
-- on a production database with legacy text values, the fix is a
-- preceding UPDATE that explicitly remaps the legacy values — not a
-- broader enum set.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. CREATE TYPE — idempotent
-- ----------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE webhook_provider_enum AS ENUM (
    'micamp',
    'highsale',
    'trutopia'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE webhook_status_enum AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE offer_decision_enum AS ENUM (
    'approved',
    'counter',
    'declined',
    'ineligible'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mid_provisioning_status_enum AS ENUM (
    'requested',
    'pending',
    'active',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lender_status_enum AS ENUM (
    'active',
    'paused',
    'pending_integration',
    'deprecated'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE provisioning_run_status_enum AS ENUM (
    'queued',
    'running',
    'completed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------
-- 2. ALTER COLUMN — defaults dropped, type swapped, defaults restored.
--
-- Postgres refuses to ALTER COLUMN TYPE when the column has a default
-- of a different type. We drop the default, swap the type with an
-- explicit USING cast, then reattach the typed default.
-- ----------------------------------------------------------------

-- webhook_inbox.processing_status -----------------------------------
ALTER TABLE "webhook_inbox" ALTER COLUMN "processing_status" DROP DEFAULT;
ALTER TABLE "webhook_inbox"
  ALTER COLUMN "processing_status" TYPE webhook_status_enum
  USING "processing_status"::webhook_status_enum;
ALTER TABLE "webhook_inbox"
  ALTER COLUMN "processing_status" SET DEFAULT 'pending'::webhook_status_enum;

-- offers.decision --------------------------------------------------
-- No default declared on `decision`; no DROP DEFAULT needed.
ALTER TABLE "offers"
  ALTER COLUMN "decision" TYPE offer_decision_enum
  USING "decision"::offer_decision_enum;

-- mids.provisioning_status -----------------------------------------
ALTER TABLE "mids" ALTER COLUMN "provisioning_status" DROP DEFAULT;
ALTER TABLE "mids"
  ALTER COLUMN "provisioning_status" TYPE mid_provisioning_status_enum
  USING "provisioning_status"::mid_provisioning_status_enum;
ALTER TABLE "mids"
  ALTER COLUMN "provisioning_status" SET DEFAULT 'requested'::mid_provisioning_status_enum;

-- lenders.status ---------------------------------------------------
ALTER TABLE "lenders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "lenders"
  ALTER COLUMN "status" TYPE lender_status_enum
  USING "status"::lender_status_enum;
ALTER TABLE "lenders"
  ALTER COLUMN "status" SET DEFAULT 'pending_integration'::lender_status_enum;

-- provisioning_runs.status -----------------------------------------
ALTER TABLE "provisioning_runs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "provisioning_runs"
  ALTER COLUMN "status" TYPE provisioning_run_status_enum
  USING "status"::provisioning_run_status_enum;
ALTER TABLE "provisioning_runs"
  ALTER COLUMN "status" SET DEFAULT 'queued'::provisioning_run_status_enum;

-- ----------------------------------------------------------------
-- 3. Down migration (manual)
--
-- To revert, swap each column back to text and drop the enum types:
--
--   ALTER TABLE webhook_inbox
--     ALTER COLUMN processing_status DROP DEFAULT,
--     ALTER COLUMN processing_status TYPE text USING processing_status::text,
--     ALTER COLUMN processing_status SET DEFAULT 'pending';
--   -- repeat for offers.decision, mids.provisioning_status,
--   --             lenders.status, provisioning_runs.status
--   DROP TYPE webhook_provider_enum;
--   DROP TYPE webhook_status_enum;
--   DROP TYPE offer_decision_enum;
--   DROP TYPE mid_provisioning_status_enum;
--   DROP TYPE lender_status_enum;
--   DROP TYPE provisioning_run_status_enum;
-- ----------------------------------------------------------------
