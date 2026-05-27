-- ============================================================
-- 0014_outbox — transactional outbox for cross-system side
-- effects (notifications, outbound webhooks, audit log writes).
--
-- WHY THIS TABLE EXISTS
-- ---------------------
-- Today, a route handler that mutates Postgres AND fires a
-- notification / outbound webhook / audit-log write does it in
-- TWO separate steps: the DB commit, then the side-effect. The
-- two are NOT atomic. If the process dies between them — or if
-- the side-effect call fails after a 200 response is already
-- returned — the partner ends up with a DB row that says "we
-- emailed them" but no email ever sent (or worse, the inverse:
-- email sent, DB rolled back, partner sees a phantom event).
--
-- The classic fix is the transactional-outbox pattern: the
-- side-effect is INSERTed into a durable table inside the SAME
-- transaction as the business write. A separate drain worker
-- picks up `pending` rows and dispatches them. The business
-- transaction either commits both the business row AND the
-- outbox row, or neither. The drain worker provides at-least-
-- once delivery with bounded retries.
--
-- DESIGN NOTES
-- ------------
-- * `payload_json` is jsonb so the drain worker + handlers can
--   index / filter on payload fields without re-parsing text.
-- * `status` is a CHECK-constrained text rather than a pgEnum:
--   the value set ('pending','sent','failed','dead') is stable
--   and a CHECK constraint avoids the enum-alter-on-extension
--   migration tax. Promote to pgEnum if the value set grows.
-- * `next_attempt_at` defaults to `now()` so a fresh row is
--   immediately eligible. Retries set it to a future timestamp.
-- * Partial index on `(status, next_attempt_at) WHERE
--   status='pending'` keeps the drain query cheap even as `sent`
--   rows accumulate — the worker only ever scans pending work.
--
-- APPEND-ONLY ENFORCEMENT
-- -----------------------
-- The append-only contract here is narrower than `consent_receipts`:
-- the drain worker LEGITIMATELY needs to mutate `status`,
-- `attempts`, `last_error`, `sent_at`, and `next_attempt_at`.
-- Everything else — `id`, `kind`, `payload_json`, `created_at` —
-- is immutable.
--
-- A trigger blocks UPDATEs that change the immutable columns and
-- blocks DELETE outright. The `eazepay_service_role` (the BFF /
-- worker runtime) is subject to the trigger; the migration role
-- can bypass via `SET LOCAL eazepay.allow_outbox_admin = 'true'`
-- for backfills and ops surgery.
-- ============================================================

CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind"             text NOT NULL,
  "payload_json"     jsonb NOT NULL,
  "status"           text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','sent','failed','dead')),
  "attempts"         int  NOT NULL DEFAULT 0,
  "last_error"       text,
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "sent_at"          timestamptz,
  "next_attempt_at"  timestamptz NOT NULL DEFAULT now()
);

-- Drain index: the worker query is
--   SELECT ... FROM outbox_events
--   WHERE status='pending' AND next_attempt_at <= now()
--   ORDER BY next_attempt_at ASC LIMIT N.
-- Partial index on status='pending' keeps the working set tiny
-- regardless of how many `sent`/`dead` rows accumulate.
CREATE INDEX IF NOT EXISTS "outbox_events_pending_due_idx"
  ON "outbox_events" ("status", "next_attempt_at")
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS "outbox_events_kind_created_idx"
  ON "outbox_events" ("kind", "created_at");

-- ------------------------------------------------------------
-- Append-only enforcement.
--
-- The trigger function denies:
--   * DELETE (always)
--   * UPDATE that touches id / kind / payload_json / created_at
--
-- Permitted UPDATE columns are: status, attempts, last_error,
-- sent_at, next_attempt_at.
--
-- A session can bypass for admin / migration surgery by setting
--   SET LOCAL eazepay.allow_outbox_admin = 'true';
-- The default GUC value is unset which evaluates as falsey.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION "outbox_events_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bypass text := current_setting('eazepay.allow_outbox_admin', true);
BEGIN
  IF bypass = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'outbox_events is append-only: DELETE forbidden';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id           IS DISTINCT FROM OLD.id           THEN
      RAISE EXCEPTION 'outbox_events.id is immutable';
    END IF;
    IF NEW.kind         IS DISTINCT FROM OLD.kind         THEN
      RAISE EXCEPTION 'outbox_events.kind is immutable';
    END IF;
    IF NEW.payload_json IS DISTINCT FROM OLD.payload_json THEN
      RAISE EXCEPTION 'outbox_events.payload_json is immutable';
    END IF;
    IF NEW.created_at   IS DISTINCT FROM OLD.created_at   THEN
      RAISE EXCEPTION 'outbox_events.created_at is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "outbox_events_guard_trg" ON "outbox_events";
CREATE TRIGGER "outbox_events_guard_trg"
  BEFORE UPDATE OR DELETE ON "outbox_events"
  FOR EACH ROW EXECUTE FUNCTION "outbox_events_guard"();

-- Defence-in-depth: revoke UPDATE/DELETE from the service role
-- entirely except for the mutable columns. The trigger above is
-- the authoritative guard; the column-level GRANT is the second
-- belt. Wrapped in DO so a local docker-compose without the role
-- doesn't fail the migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eazepay_service_role') THEN
    REVOKE UPDATE, DELETE ON "outbox_events" FROM eazepay_service_role;
    GRANT  SELECT, INSERT  ON "outbox_events" TO   eazepay_service_role;
    GRANT  UPDATE ("status", "attempts", "last_error", "sent_at", "next_attempt_at")
                            ON "outbox_events" TO   eazepay_service_role;
  END IF;
END $$;
