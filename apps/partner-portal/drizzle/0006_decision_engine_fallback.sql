-- 0006_decision_engine_fallback.sql
--
-- Tasks #44b — audit integrity for Trutopia → internal-engine fallback.
--
-- Adds an explicit boolean flag on `decisions` so a regulator replay can
-- distinguish a clean upstream Trutopia decision from one that was
-- silently fulfilled by the internal scorer after Trutopia timed out or
-- errored. Without this column, the `engine` text alone would be a lie
-- (set to 'trutopia' even when internal produced the result).
--
-- Defaults to FALSE so backfill on every existing row is correct — those
-- decisions ran before the fallback path landed and were authentically
-- the engine they claim to be.

ALTER TABLE "decisions"
  ADD COLUMN IF NOT EXISTS "engine_fallback" boolean NOT NULL DEFAULT false;
