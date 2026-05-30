-- ============================================================
-- 0020_encrypt_consumer_pii — PRIV-002 expand/contract step 1 of 2.
--
-- FRAMEWORK / CONTROL
-- -------------------
-- SOC 2 CC6.1 (logical access — data at rest protected by encryption)
-- GLBA Safeguards Rule, 16 CFR §314.4(c)(3) (encryption of customer
--   information at rest). FTC examiners read "customer information" to
--   include name + contact tuples that identify a consumer of a
--   financial product — exactly the columns below.
--
-- WHAT WAS WRONG
-- --------------
-- `applications.consumer_first / _last / _email / _phone` were PLAINTEXT
-- `text`. The backend services/user PII vault already encrypts the same
-- class of data with per-row AES-256-GCM envelope encryption; this edge
-- table was the gap — strong vault on one side, cleartext on the other.
-- Anyone with read access to this database (a leaked DATABASE_URL, a
-- backup snapshot, a compromised replica) could harvest every
-- consumer's identity + contact in the clear.
--
-- THE FIX (EXPAND/CONTRACT — why two migrations, not one)
-- -------------------------------------------------------
-- Dropping the plaintext columns in the SAME migration that adds the
-- encrypted ones is risky: the data lives ONLY in the new columns the
-- instant the drop commits, so if the backfill (which is application
-- code — it needs the KEK + HMAC key, not pure SQL) has any bug, the
-- plaintext is gone and unrecoverable. Instead:
--
--   0020 (this file):
--     • ADD the encrypted columns `consumer_*_enc` (nullable) and the
--       email blind-index column `consumer_email_bidx` (nullable).
--     • DROP the NOT NULL on the plaintext columns so the write path can
--       stop populating them immediately (the app no longer writes them).
--     • The plaintext columns are LEFT IN PLACE so the backfill can read
--       them and so a problem can be rolled back before any data loss.
--
--   scripts/backfill-priv002.ts  (run AFTER 0020, BEFORE 0021):
--     • For every row where `consumer_*_enc IS NULL`, AES-256-GCM-encrypt
--       the plaintext (AAD bound to the row id) and write the `_enc`
--       columns + the email blind index. Idempotent + restartable.
--     • Writes an audit_log row recording the backfill.
--
--   0021_drop_plaintext_consumer_pii.sql  (HOLD — separate PR, after the
--   backfill is verified against a DB snapshot):
--     • Promote the `_enc` columns to NOT NULL.
--     • DROP the plaintext columns. Because the column data is physically
--       removed and the per-row DEKs remain wrapped under the KEK, the
--       historical plaintext is crypto-shredded — recoverable only with
--       the KEK, never from the row alone.
--
-- ROLLBACK (this migration)
-- -------------------------
-- Reversible: the down-path re-adds NOT NULL on the plaintext columns
-- (safe while they are still populated) and drops the new columns. See
-- the `-- DOWN` block at the foot of this file — it is NOT executed by
-- the forward runner; it documents the exact reversal for the operator.
--
-- KEY MATERIAL
-- ------------
-- Encryption uses the SAME KEK the apps/api vault uses (LOCAL_KEK_HEX in
-- dev / the KMS CMK in prod). The blind index uses a SEPARATE HMAC key
-- (EDGE_PII_BLIND_INDEX_KEY). Neither key is referenced in SQL — they
-- only exist in the backfill/runtime process env.
-- ============================================================

-- Encrypted-at-rest columns. Nullable during the backfill window;
-- promoted to NOT NULL in 0021 once every row is populated.
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "consumer_first_enc" text;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "consumer_last_enc" text;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "consumer_email_enc" text;
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "consumer_phone_enc" text;

-- Deterministic HMAC-SHA-256 blind index of the normalized (lowercased)
-- email, for future equality lookup without decrypting. No query reads
-- it yet (there is no existing email lookup to preserve). Keyed by
-- EDGE_PII_BLIND_INDEX_KEY (distinct from the encryption KEK).
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "consumer_email_bidx" text;

CREATE INDEX IF NOT EXISTS "applications_consumer_email_bidx_idx"
  ON "applications" ("consumer_email_bidx");

-- Stop requiring the plaintext columns so the write path can cease
-- populating them now (it already does — see the POST handler). Kept
-- in place (not dropped) until the backfill is verified; 0021 drops them.
ALTER TABLE "applications" ALTER COLUMN "consumer_first" DROP NOT NULL;
ALTER TABLE "applications" ALTER COLUMN "consumer_last" DROP NOT NULL;
ALTER TABLE "applications" ALTER COLUMN "consumer_email" DROP NOT NULL;
ALTER TABLE "applications" ALTER COLUMN "consumer_phone" DROP NOT NULL;

-- ============================================================
-- DOWN (documentation only — NOT run by scripts/migrate.ts, which is
-- forward-only. To reverse, an operator runs this by hand BEFORE the
-- 0021 drop, while the plaintext columns are still populated):
--
--   DROP INDEX IF EXISTS "applications_consumer_email_bidx_idx";
--   ALTER TABLE "applications" DROP COLUMN IF EXISTS "consumer_email_bidx";
--   ALTER TABLE "applications" DROP COLUMN IF EXISTS "consumer_phone_enc";
--   ALTER TABLE "applications" DROP COLUMN IF EXISTS "consumer_email_enc";
--   ALTER TABLE "applications" DROP COLUMN IF EXISTS "consumer_last_enc";
--   ALTER TABLE "applications" DROP COLUMN IF EXISTS "consumer_first_enc";
--   ALTER TABLE "applications" ALTER COLUMN "consumer_first" SET NOT NULL;
--   ALTER TABLE "applications" ALTER COLUMN "consumer_last"  SET NOT NULL;
--   ALTER TABLE "applications" ALTER COLUMN "consumer_email" SET NOT NULL;
--   ALTER TABLE "applications" ALTER COLUMN "consumer_phone" SET NOT NULL;
-- (Reversal is only valid while plaintext columns still hold data, i.e.
--  before 0021 has run.)
-- ============================================================
