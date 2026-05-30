-- ============================================================
-- 0021_consent_receipts_immutability — make the FCRA §604(a)(2)
-- consent receipt TRULY append-only at the database layer.
--
-- WHY (EX-005)
-- ------------
-- 0011_consent_receipts intended consent receipts to be immutable and
-- said so in its docblock ("APPEND-ONLY: UPDATE + DELETE revoked").
-- But the REVOKE it shipped targeted the role `authenticated` —
-- a role that does NOT exist in this database (a leftover from a
-- Supabase-shaped template). The REVOKE was wrapped in
-- `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')`,
-- so on every real deploy the branch was skipped and the REVOKE never
-- ran. Net effect: the immutability guarantee on FCRA consent receipts
-- was a complete no-op. The actual app role, `eazepay_service_role`,
-- could UPDATE the verbatim disclosure text and DELETE receipts —
-- proven before this migration: `UPDATE consent_receipts SET
-- raw_text='TAMPERED'` and `DELETE FROM consent_receipts` both
-- succeeded as the service role.
--
-- A consent receipt is the legal artifact that proves a consumer
-- authorized a specific soft credit pull (15 U.S.C. § 1681b). It must
-- be tamper-evident and non-erasable from the application — a mutable
-- receipt is, for audit purposes, no receipt.
--
-- This migration enforces append-only at TWO layers (defense in depth,
-- mirroring the audit_log treatment in 0019_append_only_grants):
--   1. PRIVILEGE: REVOKE UPDATE/DELETE/TRUNCATE from eazepay_service_role
--      and PUBLIC. The BFF can only INSERT + SELECT.
--   2. TRIGGER:   a BEFORE UPDATE/DELETE/TRUNCATE trigger that RAISES,
--      so even a future accidental re-GRANT to the service role can't
--      mutate or erase a receipt.
--
-- RTBF / CRYPTO-SHRED CARVE-OUT
-- -----------------------------
-- 0011's docblock requires that RTBF (right-to-be-forgotten) crypto-
-- shred zero the encrypted PII columns "through a privileged migration
-- role." So — unlike audit_log, which is immutable to EVERYONE — the
-- consent_receipts trigger EXEMPTS `eazepay_migration_role` (BYPASSRLS,
-- the role scripts/migrate.ts and the RTBF worker connect as). That
-- role keeps full DML (GRANT ALL below) and the trigger lets it
-- through, so a RtbfRequest can crypto-shred a consumer's receipt PII
-- while the app role remains permanently locked out. Every other role
-- (service role, re-grants, PUBLIC) is blocked.
--
-- IDEMPOTENT — REVOKE is safe to re-run; GRANT is additive; trigger
-- creation is guarded with DROP TRIGGER IF EXISTS; CREATE OR REPLACE
-- FUNCTION is inherently idempotent.
--
-- REVERSIBLE — down block documented at the foot of this file. (The
-- runner is forward-only; roll back via a new migration that pastes it.)
-- ============================================================

-- ----------------------------------------------------------------
-- 0. Ensure the privileged migration role retains full DML so RTBF
--    crypto-shred works after the REVOKEs below. (Idempotent grant —
--    same pattern as 0019 step 0.)
-- ----------------------------------------------------------------

GRANT ALL ON TABLE "consent_receipts" TO eazepay_migration_role;

-- ----------------------------------------------------------------
-- 1. PRIVILEGE layer — strip mutation rights from the app role + PUBLIC.
--    Service role keeps SELECT + INSERT (the only legitimate surface;
--    see lib/db/consent-receipts.ts — no update/delete helper exists).
-- ----------------------------------------------------------------

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "consent_receipts" FROM eazepay_service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "consent_receipts" FROM PUBLIC;

-- ----------------------------------------------------------------
-- 2. TRIGGER layer — block mutation for everyone EXCEPT the privileged
--    migration role (which performs RTBF crypto-shred). Row-level for
--    UPDATE/DELETE, statement-level for TRUNCATE.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION consent_receipts_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- RTBF / crypto-shred carve-out: the privileged migration role (or a
  -- member of it) may zero the encrypted PII columns. Honour the FCRA
  -- right-to-be-forgotten contract from 0011 while keeping the receipt
  -- immutable to the application.
  IF current_user = 'eazepay_migration_role'
     OR pg_has_role(current_user, 'eazepay_migration_role', 'MEMBER') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  RAISE EXCEPTION 'consent_receipts is append-only (FCRA §604(a)(2)): % blocked for role %', TG_OP, current_user
    USING ERRCODE = 'insufficient_privilege',
          HINT    = 'Receipts are immutable; RTBF crypto-shred runs only as eazepay_migration_role. Never mutate a consent receipt from the app.';
END;
$$;

DROP TRIGGER IF EXISTS consent_receipts_block_update ON "consent_receipts";
CREATE TRIGGER consent_receipts_block_update
  BEFORE UPDATE ON "consent_receipts"
  FOR EACH ROW EXECUTE FUNCTION consent_receipts_block_mutation();

DROP TRIGGER IF EXISTS consent_receipts_block_delete ON "consent_receipts";
CREATE TRIGGER consent_receipts_block_delete
  BEFORE DELETE ON "consent_receipts"
  FOR EACH ROW EXECUTE FUNCTION consent_receipts_block_mutation();

DROP TRIGGER IF EXISTS consent_receipts_block_truncate ON "consent_receipts";
CREATE TRIGGER consent_receipts_block_truncate
  BEFORE TRUNCATE ON "consent_receipts"
  FOR EACH STATEMENT EXECUTE FUNCTION consent_receipts_block_mutation();

-- ============================================================
-- VERIFICATION (run manually post-deploy)
-- ============================================================
-- As eazepay_service_role:
--   INSERT INTO consent_receipts (id, application_id, brand,
--     disclosure_version, captured_ip, signature_hash, raw_text)
--     VALUES ('t1','a1','medpay','v3','1.1.1.1','h','text');        -- OK
--   UPDATE consent_receipts SET raw_text='x' WHERE id='t1';
--     -- ERROR: consent_receipts is append-only (FCRA ...): UPDATE blocked
--   DELETE FROM consent_receipts WHERE id='t1';
--     -- ERROR: ... DELETE blocked
--   TRUNCATE consent_receipts;
--     -- ERROR: ... / permission denied
-- As eazepay_migration_role (RTBF crypto-shred):
--   UPDATE consent_receipts SET raw_text='[REDACTED]', captured_ip='[REDACTED]'
--     WHERE id='t1';                                                 -- OK
-- ============================================================
-- DOWN MIGRATION (paste into a NEW forward migration to roll back)
-- ============================================================
--   DROP TRIGGER IF EXISTS consent_receipts_block_update    ON "consent_receipts";
--   DROP TRIGGER IF EXISTS consent_receipts_block_delete    ON "consent_receipts";
--   DROP TRIGGER IF EXISTS consent_receipts_block_truncate  ON "consent_receipts";
--   DROP FUNCTION IF EXISTS consent_receipts_block_mutation();
--   GRANT UPDATE, DELETE ON TABLE "consent_receipts" TO eazepay_service_role;
--   -- (TRUNCATE intentionally NOT re-granted; it was never legitimately used.)
-- ============================================================
