-- ============================================================
-- 20260527_outbox_events_prisma_view
--
-- Register the `outbox_events` table with the Prisma migrations
-- ledger so NestJS services can INSERT outbox rows via Prisma.
--
-- WHY THIS IS IDEMPOTENT-ONLY
-- ---------------------------
-- The authoritative DDL for this table — including the
-- `outbox_events_guard` trigger and column-level REVOKE/GRANT
-- statements that enforce append-only at the DB layer — lives
-- in `apps/partner-portal/drizzle/0014_outbox.sql`. Both apps
-- point at the SAME `DATABASE_URL` Postgres in dev + prod, so
-- whichever migration tool runs first wins; the other one
-- needs to no-op.
--
-- This migration uses CREATE ... IF NOT EXISTS so it is safe in
-- both orderings:
--   * Drizzle ran first (normal prod path): every statement is a
--     no-op; Prisma's ledger learns about the table without
--     touching the schema.
--   * Prisma ran first (e.g. an api-only integration test DB
--     that never runs Drizzle migrations): the table + indexes
--     are created, BUT the append-only trigger from 0014 is NOT
--     installed here. Tests that exercise the trigger MUST run
--     against the full migration set, not Prisma-only.
--
-- The CHECK constraint on `status` is replicated to match the
-- Drizzle schema; without it, Prisma-only DBs accept arbitrary
-- status strings and the drain worker silently mis-routes rows.
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

CREATE INDEX IF NOT EXISTS "outbox_events_pending_due_idx"
  ON "outbox_events" ("status", "next_attempt_at");

CREATE INDEX IF NOT EXISTS "outbox_events_kind_created_idx"
  ON "outbox_events" ("kind", "created_at");
