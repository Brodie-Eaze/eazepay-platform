-- ============================================================
-- 0005_webhook_inbox — write-then-200 webhook inbox + caller-supplied
-- idempotency keys for state-changing routes (Task #43).
--
-- Tables added
--   webhook_inbox       inbound provider events persisted before 200 ack
--   idempotency_keys    caller-supplied idempotency keys (scope, key)
--
-- Why
--   Before this migration, the MiCamp + HighSale webhook routes ack'd
--   200 OK while every event-type branch was a `// TODO` + `break`.
--   Upstream treats 200 as "delivered, never retry" — silent drops on
--   any crash mid-handler. This table is the durable boundary: we
--   persist the verified event, ack 200, and an async worker drains.
--
--   The unique (provider, event_id) constraint is the idempotency
--   gate. Provider replays (which DO happen on every webhook source)
--   collide at INSERT time so the worker only sees one copy.
--
-- All statements are idempotent (IF NOT EXISTS) so a half-applied
-- run can be safely retried.
-- ============================================================

CREATE TABLE IF NOT EXISTS "webhook_inbox" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider"            text NOT NULL,
  "event_id"            text NOT NULL,
  "event_type"          text NOT NULL,
  "raw_body"            text NOT NULL,
  "signature_header"    text,
  "received_at"         timestamp with time zone DEFAULT now() NOT NULL,
  "processing_status"   text DEFAULT 'pending' NOT NULL,
  "processed_at"        timestamp with time zone,
  "failure_reason"      text,
  "attempts"            integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_inbox_provider_event_unique"
  ON "webhook_inbox" ("provider", "event_id");
CREATE INDEX IF NOT EXISTS "webhook_inbox_status_received_idx"
  ON "webhook_inbox" ("processing_status", "received_at");
CREATE INDEX IF NOT EXISTS "webhook_inbox_provider_received_idx"
  ON "webhook_inbox" ("provider", "received_at");

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope"            text NOT NULL,
  "key"              text NOT NULL,
  "response_hash"    text NOT NULL,
  "status_code"      integer NOT NULL,
  "response_body"    text NOT NULL,
  "created_at"       timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at"       timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_scope_key_unique"
  ON "idempotency_keys" ("scope", "key");
CREATE INDEX IF NOT EXISTS "idempotency_keys_expires_idx"
  ON "idempotency_keys" ("expires_at");
