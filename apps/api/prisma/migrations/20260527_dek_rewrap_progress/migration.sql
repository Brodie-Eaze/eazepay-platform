-- ============================================================
-- 20260527_dek_rewrap_progress
--
-- Persistent cursor + audit trail for the DEK-rewrap cutover
-- script (scripts/migrate-deks-to-kms.ts).
--
-- WHY THIS LIVES IN PRISMA, NOT DRIZZLE
-- -------------------------------------
-- This table is owned by the migration tooling (NestJS service-side
-- scripts), not the partner-portal BFF. Prisma is the right home —
-- and we mirror the safe `IF NOT EXISTS` posture used by the
-- shared outbox migration so re-running this against a database
-- where the table already exists is a no-op.
--
-- AUDIT POSTURE
-- -------------
-- Rows are append-only by convention (the script only ever INSERTS).
-- We do NOT install a trigger here — operators occasionally need to
-- delete stale `finished_run=true` rows during housekeeping, and
-- forcing a function-owner workaround for that would be net-negative
-- without a SOC2-driven need. The hash-chained audit_log captures
-- the immutable cutover record; this table is operational scratch.
-- ============================================================

CREATE TABLE IF NOT EXISTS "dek_rewrap_progress" (
  "id"                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "job"                 text        NOT NULL,
  "source_kek_id"       text        NOT NULL,
  "destination_kek_id"  text        NOT NULL,
  "last_processed_id"   uuid,
  "count_done"          integer     NOT NULL DEFAULT 0,
  "count_skipped"       integer     NOT NULL DEFAULT 0,
  "count_failed"        integer     NOT NULL DEFAULT 0,
  "batch_started_at"    timestamptz NOT NULL,
  "batch_finished_at"   timestamptz NOT NULL,
  "run_id"              uuid        NOT NULL,
  "finished_run"        boolean     NOT NULL DEFAULT false,
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

-- Resume + "what did this job do" queries hit (job, created_at DESC).
CREATE INDEX IF NOT EXISTS "dek_rewrap_progress_job_created_idx"
  ON "dek_rewrap_progress" ("job", "created_at" DESC);

-- `--resume-from=auto` query looks for the most-recent UNFINISHED
-- row for the job; the partial-index pattern would be tighter, but
-- a composite covers the same access path and matches the Prisma
-- schema's @@index declaration.
CREATE INDEX IF NOT EXISTS "dek_rewrap_progress_job_finished_created_idx"
  ON "dek_rewrap_progress" ("job", "finished_run", "created_at" DESC);
