-- ============================================================
-- 0019_append_only_grants — enforce append-only intent at the
-- database layer for tables that previously only said "append-only"
-- in a code comment.
--
-- WHY
-- ---
-- `application_events`, `audit_log`, `decisions`, `webhook_inbox`
-- are the regulator-replay + tamper-evident trail. Today nothing
-- stops a bug (or a malicious operator with the app role) from
-- UPDATE-ing or DELETE-ing rows. A single `UPDATE audit_log SET
-- action='ok' WHERE id=...` silently breaks the chain of custody.
--
-- This migration enforces append-only at TWO layers (defense in depth):
--   1. PRIVILEGE: REVOKE UPDATE/DELETE/TRUNCATE from the app role.
--      A future ALTER ROLE that re-grants privileges is the only
--      way to bypass — and that ALTER itself shows up in pg_audit.
--   2. TRIGGER: a BEFORE UPDATE OR DELETE OR TRUNCATE trigger on
--      audit_log RAISES EXCEPTION unconditionally. Even a role that
--      has been re-granted UPDATE can't tamper.
--
-- ALSO IN THIS MIGRATION
-- ----------------------
-- `application_events.application_id` was ON DELETE CASCADE — which
-- meant deleting an application also wiped its audit trail. That is
-- exactly the path you must NOT have on a regulator-replay table.
-- Drop the cascade, drop NOT NULL on application_id, replace with
-- ON DELETE SET NULL. The event survives the application deletion;
-- the parent FK is cleared. (RTBF flows can still hard-delete the
-- application row; the event row remains as the audit anchor.)
--
-- Roles assumed (created in 0013_rls_policies):
--   eazepay_service_role  — what the BFF connects as. NOBYPASSRLS.
--   eazepay_migration_role — what scripts/migrate.ts connects as.
--                           BYPASSRLS. Keeps DDL working.
--
-- IDEMPOTENT — every REVOKE is safe to re-run; trigger creation is
-- guarded with DROP TRIGGER IF EXISTS; FK rebuild is guarded.
-- ============================================================

-- ----------------------------------------------------------------
-- 0. Ensure migration role has the privileges to run structural
--    changes against these tables. (Idempotent grant.)
-- ----------------------------------------------------------------

GRANT ALL ON TABLE
  "application_events",
  "audit_log",
  "decisions",
  "webhook_inbox"
TO eazepay_migration_role;

-- ----------------------------------------------------------------
-- 1. application_events — REVOKE UPDATE, DELETE, TRUNCATE.
--    Replace ON DELETE CASCADE with ON DELETE SET NULL so deleting
--    the parent application does not nuke the audit trail.
-- ----------------------------------------------------------------

-- 1a. Privilege revocation. Service role keeps SELECT + INSERT.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "application_events" FROM eazepay_service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "application_events" FROM PUBLIC;

-- 1b. Drop NOT NULL on application_id so the FK can SET NULL.
ALTER TABLE "application_events" ALTER COLUMN "application_id" DROP NOT NULL;

-- 1c. Rebuild the FK with ON DELETE SET NULL. The constraint name
--     Drizzle generated in 0001 is `application_events_application_id_applications_id_fk`.
--     Drop it if present, then re-add. Wrapped in DO so a fresh DB
--     (where the FK might already be SET NULL after a re-init) is fine.
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'application_events'::regclass
    AND contype = 'f'
    AND conkey  = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'application_events'::regclass
        AND attname = 'application_id'
    )::smallint];

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "application_events" DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE "application_events"
    ADD CONSTRAINT "application_events_application_id_applications_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "applications"("id")
    ON DELETE SET NULL;
END $$;

-- ----------------------------------------------------------------
-- 2. audit_log — strongest controls. Tamper-evident.
--    REVOKE UPDATE, DELETE, TRUNCATE + trigger that RAISES on any
--    UPDATE/DELETE attempt. Even if the service role is later
--    re-granted UPDATE, the trigger blocks the write.
-- ----------------------------------------------------------------

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_log" FROM eazepay_service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "audit_log" FROM PUBLIC;

-- Statement-level trigger fires for TRUNCATE; row-level for UPDATE/DELETE.
-- Both call the same guard function which simply raises.

CREATE OR REPLACE FUNCTION audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % blocked', TG_OP
    USING ERRCODE = 'insufficient_privilege',
          HINT    = 'Issue a follow-up audit_log row instead of mutating history.';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_block_update ON "audit_log";
CREATE TRIGGER audit_log_block_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

DROP TRIGGER IF EXISTS audit_log_block_delete ON "audit_log";
CREATE TRIGGER audit_log_block_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

DROP TRIGGER IF EXISTS audit_log_block_truncate ON "audit_log";
CREATE TRIGGER audit_log_block_truncate
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutation();

-- ----------------------------------------------------------------
-- 3. decisions — regulator-replay trail. No column is ever updated
--    by application code (no `updated_at`). REVOKE UPDATE, DELETE,
--    TRUNCATE. Re-running the engine writes a NEW row.
-- ----------------------------------------------------------------

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "decisions" FROM eazepay_service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "decisions" FROM PUBLIC;

-- ----------------------------------------------------------------
-- 4. webhook_inbox — append-only on the wire payload. The worker
--    DOES legitimately mutate processing_status / attempts / etc.,
--    so we cannot blanket-revoke UPDATE. Instead: REVOKE DELETE +
--    TRUNCATE, and add a trigger that blocks any UPDATE which
--    touches the immutable columns (provider, event_id, event_type,
--    raw_body, signature_header, received_at).
--
--    Plus the existing (provider, event_id) unique constraint from
--    0007 keeps double-applies impossible. This migration tightens
--    further by making the row's identity bytes literally immutable.
-- ----------------------------------------------------------------

REVOKE DELETE, TRUNCATE ON TABLE "webhook_inbox" FROM eazepay_service_role;
REVOKE DELETE, TRUNCATE ON TABLE "webhook_inbox" FROM PUBLIC;

CREATE OR REPLACE FUNCTION webhook_inbox_block_immutable_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.provider          IS DISTINCT FROM OLD.provider
  OR NEW.event_id          IS DISTINCT FROM OLD.event_id
  OR NEW.event_type        IS DISTINCT FROM OLD.event_type
  OR NEW.raw_body          IS DISTINCT FROM OLD.raw_body
  OR NEW.signature_header  IS DISTINCT FROM OLD.signature_header
  OR NEW.received_at       IS DISTINCT FROM OLD.received_at
  THEN
    RAISE EXCEPTION 'webhook_inbox identity columns are immutable'
      USING ERRCODE = 'insufficient_privilege',
            HINT    = 'Only processing_status, processed_at, failure_reason, attempts may be updated.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS webhook_inbox_block_immutable_update ON "webhook_inbox";
CREATE TRIGGER webhook_inbox_block_immutable_update
  BEFORE UPDATE ON "webhook_inbox"
  FOR EACH ROW EXECUTE FUNCTION webhook_inbox_block_immutable_update();

-- ============================================================
-- VERIFICATION (run manually post-deploy as eazepay_service_role)
-- ============================================================
-- 1. INSERT INTO audit_log (actor, action, target_type)
--      VALUES ('test', 'noop', 'partner');       -- succeeds
--    UPDATE audit_log SET action='x' WHERE actor='test';
--      -- ERROR: audit_log is append-only: UPDATE blocked
--    DELETE FROM audit_log WHERE actor='test';
--      -- ERROR: audit_log is append-only: DELETE blocked
--    TRUNCATE audit_log;
--      -- ERROR: permission denied / blocked
-- 2. INSERT INTO application_events (application_id, type) ...;
--    UPDATE application_events SET type='x';
--      -- ERROR: permission denied for table application_events
--    DELETE FROM applications WHERE id=...;
--      -- application_events.application_id becomes NULL; row survives.
-- 3. INSERT INTO webhook_inbox (provider, event_id, event_type, raw_body)
--      VALUES ('micamp','evt_1','x','{}');
--    UPDATE webhook_inbox SET processing_status='done' WHERE event_id='evt_1'; -- OK
--    UPDATE webhook_inbox SET raw_body='{}' WHERE event_id='evt_1';
--      -- ERROR: webhook_inbox identity columns are immutable
-- ============================================================
