-- SEC-038 / scale: defensive UNIQUE INDEX on `loans.offer_id`.
--
-- The init migration (20260503041621_init) already created
-- `loans_offer_id_key` because the Loan model has `@unique` on
-- `offerId`. This migration is a defensive re-affirmation: if the
-- index was ever dropped during ops debugging, or if a parallel
-- environment was bootstrapped without running the full init, we
-- guarantee the constraint exists before deploying the new
-- application-service code path that depends on Prisma raising
-- P2002 to short-circuit concurrent CONTRACT_SIGNED webhooks.
--
-- Threat model:
--   `completeContractSigned` is called twice in parallel for the
--   same offer (typical scenario: an e-sign webhook retry racing
--   the controller's own call). Both transactions pass the
--   application-status idempotency guard at READ time. Without the
--   UNIQUE constraint, two Loan rows would be created for the same
--   Offer, creating ambiguity about which is the legal record.
--   With the constraint, the second insert raises P2002 and the
--   service catches it as `loan_already_exists_idempotent`,
--   returning the existing row.
--
-- This statement is idempotent (IF NOT EXISTS) and runs inside a
-- normal Prisma migration transaction.

CREATE UNIQUE INDEX IF NOT EXISTS "Loan_offerId_key"
  ON "loans"("offer_id");
