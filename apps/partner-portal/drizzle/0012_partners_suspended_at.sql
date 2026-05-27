-- ============================================================
-- 0012_partners_suspended_at — add suspension audit columns to the
-- partners table.
--
-- Before this migration, "Suspend partner" in the operator control-
-- panel was pure UI theatre: `setPartner((p) => ({ ...p, status:
-- 'Suspended' }))` mutated React state and that was it. A suspended
-- partner kept transacting because the server had no record of the
-- decision and no enforcement point. This migration adds the storage
-- columns; the POST /api/admin/partners/[id]/status route + audit_log
-- insert in the same PR makes the action real.
--
-- Compliance posture: SOC2 CC6.6 (logical access removed when no
-- longer authorised) + CC7.2 (security-relevant events captured in
-- the audit chain). The audit_log row is the durable evidence; these
-- columns are the operational state the BFF reads to gate further
-- writes.
--
-- All statements are idempotent so a half-applied run can be safely
-- retried.
-- ============================================================

ALTER TABLE "partners"
  ADD COLUMN IF NOT EXISTS "suspended_at" timestamptz;

ALTER TABLE "partners"
  ADD COLUMN IF NOT EXISTS "suspended_reason" text;

-- Partial index on `suspended_at IS NOT NULL` accelerates the
-- "list all currently-suspended partners" query the compliance
-- dashboard runs.
CREATE INDEX IF NOT EXISTS "partners_suspended_at_idx"
  ON "partners" ("suspended_at")
  WHERE "suspended_at" IS NOT NULL;
