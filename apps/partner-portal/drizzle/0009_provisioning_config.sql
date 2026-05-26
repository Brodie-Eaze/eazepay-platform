-- ============================================================
-- 0009_provisioning_config — persist the ProvisionConfig alongside
-- the run row so a cross-process worker (BullMQ — Task #50) can
-- recover the inputs without the config riding inside the Redis job
-- payload (which would leak partner PII into Redis).
--
-- The column is text-encoded JSON, matching the existing steps_json
-- convention. Nullable for back-compat with the rows that pre-date
-- this migration; the orchestrator's `loadProvisionConfig` returns
-- undefined and the route layer surfaces a 5xx if a worker tries to
-- replay one of those rows after a redeploy.
--
-- All statements are idempotent so a half-applied run can be safely
-- retried.
-- ============================================================

ALTER TABLE "provisioning_runs"
  ADD COLUMN IF NOT EXISTS "config_json" text;
