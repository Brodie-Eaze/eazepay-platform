-- ============================================================
-- 0011_consent_receipts — durable, append-only FCRA §604(a)(2)
-- consent receipt store.
--
-- WHY THIS TABLE EXISTS
-- ---------------------
-- Pre-fix, `lib/consumer-consent.ts` held receipts in two in-process
-- `new Map()` instances. That store:
--   * Vanishes on every replica restart / Railway redeploy / autoscale
--     event — receipts captured pre-bounce become "not_found" and the
--     downstream HighSale FCRA verifier returns 412 for legitimate
--     consumers.
--   * Doesn't fan out across replicas — a receipt captured on replica
--     A is invisible to the prequal call routed to replica B.
--   * Provides no audit chain for a CFPB / SOC 2 auditor — the
--     in-memory rows are never persisted to disk, full stop.
--
-- FCRA §604(a)(2) and 12 CFR §1002.5 (Reg B) require a defensible,
-- retained record of every consumer authorization for a soft credit
-- pull. "Retained" means the record survives process death and is
-- producible on demand months / years after capture.
--
-- DESIGN NOTES
-- ------------
-- * `id` is the server-minted UUID surfaced back to the consumer
--   apply flow — the opaque audit-chain pointer the prequal route
--   echoes into HighSale's `clientReference` field.
-- * `signature_hash` reserved for the hash-chained-log primitive
--   (sha256(prev_hash + payload)). The current write path stores the
--   sha256 of the captured raw text; the prev_hash chain lands in a
--   follow-up migration once the consent worker exists.
-- * `raw_text` is the verbatim disclosure string the consumer saw at
--   capture time — the legal artifact, not a normalised summary.
-- * APPEND-ONLY: UPDATE + DELETE revoked from the `authenticated`
--   role so neither the BFF nor a leaked operator token can mutate or
--   erase a receipt. Crypto-shred / RTBF flows must zero the encrypted
--   PII columns through a privileged migration role.
-- ============================================================

CREATE TABLE IF NOT EXISTS "consent_receipts" (
  "id" text PRIMARY KEY,
  "application_id" text NOT NULL,
  "session_id" text,
  "partner_id" text,
  "brand" text NOT NULL,
  "disclosure_version" text NOT NULL,
  "captured_at" timestamptz NOT NULL DEFAULT now(),
  "captured_ip" text NOT NULL,
  "captured_user_agent" text,
  "signature_hash" text NOT NULL,
  "raw_text" text NOT NULL,
  "created_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "consent_receipts_application_idx"
  ON "consent_receipts" ("application_id");
CREATE INDEX IF NOT EXISTS "consent_receipts_session_idx"
  ON "consent_receipts" ("session_id");
CREATE INDEX IF NOT EXISTS "consent_receipts_captured_at_idx"
  ON "consent_receipts" ("captured_at");

-- Append-only enforcement. The `authenticated` role is the role the
-- runtime DB connection assumes; revoking UPDATE/DELETE here is the
-- DB-level guarantee that supplements the application-layer write
-- discipline. The role may not exist in local docker-compose, so the
-- DO block degrades gracefully.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE UPDATE, DELETE ON "consent_receipts" FROM authenticated;
  END IF;
END $$;
