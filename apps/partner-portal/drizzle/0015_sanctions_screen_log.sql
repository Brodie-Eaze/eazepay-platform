-- ============================================================
-- 0015_sanctions_screen_log — append-only OFAC SDN screening
-- evidence store.
--
-- WHY THIS TABLE EXISTS
-- ---------------------
-- 31 CFR §501 (OFAC) + BSA program guidance require that EVERY
-- sanctions screen — onboarding and recurring — is preserved as
-- evidence for the duration of the merchant relationship plus 5
-- years (the Bank Secrecy Act retention floor). A regulator's
-- first question on an OFAC exam is "show me the screen": for any
-- date, any subject, you must produce the result, the SDN list
-- version, and the timestamp. An in-memory log, a `safeLog.info`
-- line, or a row that the application can later UPDATE is NOT
-- acceptable evidence.
--
-- DESIGN NOTES
-- ------------
-- * `subject_kind` is a CHECK-constrained text rather than a
--   pgEnum: the value set ('entity','beneficial_owner','principal',
--   'consumer') is stable and an additive CHECK avoids the
--   enum-alter-on-extension migration tax. Promote to pgEnum if
--   the value set churns.
-- * `subject_id` is intentionally NOT a foreign key — beneficial
--   owners and consumers live in service-merchant / service-user
--   schemas owned by separate services, and the evidence row MUST
--   survive a subject row being crypto-shredded under RTBF. The
--   `merchant_id` column is the routing key for partner queries
--   and is FK-soft-referenced via index only.
-- * `legal_name_hash` (sha256 of normalised legal-name) lets the
--   weekly re-screen cron dedupe (subject, list_version) without
--   ever indexing or storing the plaintext name in this table.
--   Plaintext PII is stored in the encrypted BO blob; this table
--   carries the audit hash plus opaque vendor match metadata.
-- * `matches_json` (jsonb) carries vendor-specific match details
--   for 'review'/'match' outcomes. Adapters MUST redact SSN, full
--   DOB, and address before persisting. Cleared rows store `[]`
--   (NOT NULL) so a missing column never gets read as "no matches".
-- * `list_version` is required on every non-'error' row — that's
--   the auditor's evidence of which SDN snapshot the decision
--   was made against. The CHECK enforces this.
-- * Partial index on `status` covers two operator queries:
--      WHERE status IN ('review','match') — open-halt queue
--      WHERE status='error'                — vendor-error retries
--   Both are <<1% of total volume so a partial index keeps the
--   covering scan cheap as the cleared rows accumulate over 5y.
--
-- APPEND-ONLY ENFORCEMENT
-- -----------------------
-- The BSA evidence contract is strict: no UPDATE, no DELETE, ever,
-- from the application role. The privileged migration role can
-- still backfill / surgery under explicit policy. Mirroring the
-- consent_receipts pattern (0011_consent_receipts.sql).
-- ============================================================

CREATE TABLE IF NOT EXISTS "sanctions_screen_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchant_id" text,
  "subject_kind" text NOT NULL,
  "subject_id" text,
  "legal_name_hash" text NOT NULL,
  "provider" text NOT NULL,
  "list_version" text,
  "status" text NOT NULL,
  "matches_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "error_reason" text,
  "screened_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "sanctions_screen_log_status_chk"
    CHECK ("status" IN ('cleared','review','match','error')),
  CONSTRAINT "sanctions_screen_log_subject_kind_chk"
    CHECK ("subject_kind" IN ('entity','beneficial_owner','principal','consumer')),
  CONSTRAINT "sanctions_screen_log_list_version_required_chk"
    CHECK ("status" = 'error' OR "list_version" IS NOT NULL),
  CONSTRAINT "sanctions_screen_log_error_reason_chk"
    CHECK ("status" <> 'error' OR "error_reason" IS NOT NULL)
);

-- Routing: partner dashboards + the re-screen cron filter by merchant.
CREATE INDEX IF NOT EXISTS "sanctions_screen_log_merchant_idx"
  ON "sanctions_screen_log" ("merchant_id", "screened_at" DESC);

-- BSA: "show me every screen on this subject" across providers.
CREATE INDEX IF NOT EXISTS "sanctions_screen_log_subject_idx"
  ON "sanctions_screen_log" ("subject_kind", "subject_id");

-- Dedupe: re-screen cron checks (subject hash, list_version) before
-- inserting so the same SDN snapshot can't produce duplicate evidence
-- rows on a worker retry.
CREATE INDEX IF NOT EXISTS "sanctions_screen_log_dedupe_idx"
  ON "sanctions_screen_log" ("legal_name_hash", "list_version");

-- Operator queue — only the non-cleared minority of rows.
CREATE INDEX IF NOT EXISTS "sanctions_screen_log_open_halts_idx"
  ON "sanctions_screen_log" ("status", "screened_at" DESC)
  WHERE "status" IN ('review','match','error');

-- Append-only enforcement. The `authenticated` role is the runtime DB
-- role; revoking UPDATE/DELETE here is the database-level guarantee
-- that supplements the application-layer write discipline. The role
-- may not exist in local docker-compose, so the DO block degrades
-- gracefully.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE UPDATE, DELETE ON "sanctions_screen_log" FROM authenticated;
  END IF;
END $$;
