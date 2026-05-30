-- AML-02/03/04 — persist the REAL OFAC/sanctions verdict as its own
-- column on every screened party (consumer, merchant entity, beneficial
-- owner) and make every activation/money gate read it directly.
--
-- Background (the bug this closes): the sanctions verdict used to be
-- inferred from a "checked at" timestamp that was written for BOTH
-- 'cleared' AND 'match', so a genuine OFAC hit was read back as
-- 'cleared'. There was also no entity/BO-level column at all, so merchant
-- activation keyed only off the vendor outcome and disbursement keyed
-- only off a verified bank account — neither blocked a sanctions match.
--
-- New enum is fail-closed by design: the default is `unknown`
-- (= unscreened) which every gate treats as NOT cleared. 'review' and
-- 'error' are likewise not-cleared. Only an explicit 'cleared' proceeds.

CREATE TYPE "SanctionsStatus" AS ENUM ('unknown', 'cleared', 'match', 'review', 'error');

ALTER TABLE "consumer_profiles"
  ADD COLUMN "sanctions_status" "SanctionsStatus" NOT NULL DEFAULT 'unknown';

ALTER TABLE "merchants"
  ADD COLUMN "sanctions_status" "SanctionsStatus" NOT NULL DEFAULT 'unknown';

ALTER TABLE "beneficial_owners"
  ADD COLUMN "sanctions_status" "SanctionsStatus" NOT NULL DEFAULT 'unknown';

-- Backfill posture: pre-existing rows stay 'unknown' on purpose. Any
-- party that was approved before this migration must be RE-SCREENED before
-- it can transact — leaving them 'unknown' makes the new gates fail closed
-- rather than grandfathering an unscreened entity through.
