-- ============================================================
-- 0014_jsonb_columns — convert 12 JSON-as-text columns to jsonb.
--
-- WHY
-- ---
-- Pre-fix, every "JSON" column on the partner-portal schema was
-- declared as `text` and the application layer round-tripped
-- through JSON.stringify / JSON.parse. Two real hazards:
--
--   1. Silent corruption. A writer that forgot to JSON.stringify
--      would persist the JS `[object Object]` literal. The DB
--      had no opinion; reads would explode at JSON.parse time on
--      a row the writer had no idea was bad.
--   2. No server-side validation, no GIN-able shape. We cannot
--      run a `payload_json @> '{"outcome":"failed"}'` audit query
--      against text — every row has to be parsed in the app.
--
-- This migration flips the column type to `jsonb`. The app-layer
-- companion (libs/shared-types + lib/db boundary helpers) layers
-- a Zod schema on top of every read and write, so the *shape* is
-- still validated at the application boundary while the *bytes*
-- are now structured at rest.
--
-- ONLINE SAFETY
-- -------------
-- `ALTER TABLE ... ALTER COLUMN ... TYPE jsonb USING ...::jsonb`
-- rewrites every row of the affected table and takes an
-- ACCESS EXCLUSIVE lock for the duration. At current data volumes
-- (<10k rows across all twelve columns) this is a sub-second
-- operation per table and is acceptable to ship in-line.
--
-- For future, larger conversions the safe pattern is:
--   (a) add `<col>_jsonb jsonb` nullable,
--   (b) dual-write,
--   (c) backfill in batches off-peak,
--   (d) cut reads over,
--   (e) drop the text column in a follow-up release.
-- This migration is NOT that pattern — flagged in the PR description.
--
-- IDEMPOTENT
-- ----------
-- Every ALTER is guarded by a `data_type = 'text'` check. Re-running
-- on a database where the column is already jsonb is a no-op. The
-- entire migration runs in a single transaction; partial failure
-- leaves the schema unchanged.
-- ============================================================

BEGIN;

-- Helper: only convert if the column is still `text`. Skip on jsonb.
-- The DO block lets us keep all twelve conversions in one file
-- without writing twelve separate idempotency wrappers.

DO $migration$
DECLARE
  -- (table_name, column_name)
  c RECORD;
BEGIN
  FOR c IN (
    SELECT * FROM (VALUES
      ('decisions',           'inputs_json'),
      ('decisions',           'ranked_lenders_json'),
      ('audit_log',           'payload_json'),
      -- spec item 4: provisioning_runs.step_state_json is named
      -- `steps_json` in schema.ts; converting the matching column
      ('provisioning_runs',   'steps_json'),
      ('provisioning_runs',   'config_json'),
      ('vertical_configs',    'routing_rules_json'),
      ('vertical_configs',    'eligibility_rules_json'),
      ('vertical_configs',    'branding_json'),
      ('vertical_configs',    'economics_json'),
      ('mids',                'provisioning_state_json'),
      ('mids',                'rate_card_json'),
      ('lenders',             'eligibility_rules_json'),
      -- The audit also flagged the genuinely-named step_state_json
      -- on customer_migrations; converting alongside for parity.
      ('customer_migrations', 'step_state_json')
    ) AS t(table_name, column_name)
  ) LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = c.table_name
        AND column_name  = c.column_name
        AND data_type    = 'text'
    ) THEN
      EXECUTE format(
        -- The USING clause coerces existing text rows. NULL stays
        -- NULL; invalid JSON would raise here and abort the TX,
        -- which is the desired behaviour — better to fail loudly
        -- than to silently jsonb-encode garbage.
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE jsonb USING %I::jsonb',
        c.table_name, c.column_name, c.column_name
      );
      RAISE NOTICE '0014: converted %.% to jsonb', c.table_name, c.column_name;
    ELSE
      RAISE NOTICE '0014: %.% already jsonb or missing — skipped', c.table_name, c.column_name;
    END IF;
  END LOOP;
END
$migration$;

COMMIT;

-- ============================================================
-- DOWN (manual, not auto-applied — drizzle migrations are forward-only).
-- ============================================================
-- BEGIN;
-- ALTER TABLE public.decisions           ALTER COLUMN inputs_json             TYPE text USING inputs_json::text;
-- ALTER TABLE public.decisions           ALTER COLUMN ranked_lenders_json     TYPE text USING ranked_lenders_json::text;
-- ALTER TABLE public.audit_log           ALTER COLUMN payload_json            TYPE text USING payload_json::text;
-- ALTER TABLE public.provisioning_runs   ALTER COLUMN steps_json              TYPE text USING steps_json::text;
-- ALTER TABLE public.provisioning_runs   ALTER COLUMN config_json             TYPE text USING config_json::text;
-- ALTER TABLE public.vertical_configs    ALTER COLUMN routing_rules_json      TYPE text USING routing_rules_json::text;
-- ALTER TABLE public.vertical_configs    ALTER COLUMN eligibility_rules_json  TYPE text USING eligibility_rules_json::text;
-- ALTER TABLE public.vertical_configs    ALTER COLUMN branding_json           TYPE text USING branding_json::text;
-- ALTER TABLE public.vertical_configs    ALTER COLUMN economics_json          TYPE text USING economics_json::text;
-- ALTER TABLE public.mids                ALTER COLUMN provisioning_state_json TYPE text USING provisioning_state_json::text;
-- ALTER TABLE public.mids                ALTER COLUMN rate_card_json          TYPE text USING rate_card_json::text;
-- ALTER TABLE public.lenders             ALTER COLUMN eligibility_rules_json  TYPE text USING eligibility_rules_json::text;
-- ALTER TABLE public.customer_migrations ALTER COLUMN step_state_json         TYPE text USING step_state_json::text;
-- COMMIT;
