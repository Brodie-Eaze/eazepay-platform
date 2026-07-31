-- PRIV-014 (b) — right-to-be-forgotten via CRYPTO-SHRED: row-level
-- erasure markers.
--
-- Adds the schema surface for an erasure capability that destroys a
-- consumer's per-subject AES-256-GCM data-encryption key (rendering their
-- PII ciphertext permanently unrecoverable) WITHOUT row-deleting records
-- the law requires us to keep (BSA/AML CIP 5yr; FCRA/ECOA adverse-action).
--
-- What this migration does NOT do: it does not shred any existing data.
-- The shred is performed at runtime by ErasureService on a verified,
-- admin-gated request, subject to the injectable RetentionPolicy. See
-- docs/compliance/priv-014.md.
--
-- The `data_erasure` ComplianceReviewKind value is added separately in
-- 20260531_priv014a_erasure_enum (enum ADD VALUE must precede use).

-- Row-level erasure markers on consumer_profiles. `pii_erased_at`
-- non-null means the PII blob has been crypto-shredded (DEK destroyed;
-- ciphertext/nonce tombstoned). Queryable so a quarterly SOC2 / privacy
-- evidence pull can enumerate erased subjects without decrypting.
ALTER TABLE "consumer_profiles"
  ADD COLUMN "pii_erased_at" TIMESTAMPTZ(6),
  ADD COLUMN "erasure_receipt_id" UUID;

CREATE INDEX "consumer_profiles_pii_erased_at_idx"
  ON "consumer_profiles" ("pii_erased_at");

-- Row-level marker on users for tombstoned CONTACT PII (email / phone /
-- display name / totp secret). The user ROW is intentionally preserved
-- (loans + audit FK to it); only the contact columns are nulled.
ALTER TABLE "users"
  ADD COLUMN "contact_erased_at" TIMESTAMPTZ(6),
  ADD COLUMN "erasure_receipt_id" UUID;
