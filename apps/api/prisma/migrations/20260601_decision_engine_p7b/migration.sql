-- P7b — decision engine persistence tables (ADR-0033)
--
-- Queryable spine (decision_records) carries NO PII; encrypted §615(a)
-- basis lives in decision_bases; decision_dlq holds encrypted dead-letters.
-- The same-txn AuditOutbox + IdempotencyRecord writes reuse existing tables.
--
-- DecisionDisposition values are UPPERCASE to mirror the engine's
-- AggregatedDecision discriminant byte-for-byte — replay + shadow
-- comparison need no case translation (ADR-0033).

CREATE TYPE "DecisionDisposition" AS ENUM (
  'OFFERS',
  'INCOMPLETE',
  'ADVERSE_ACTION',
  'NO_OFFER'
);

-- Queryable spine — one row per /v1/decide outcome. No PII: disposition,
-- pinned engine versions, ordered Reg B reason codes (codes, not consumer
-- data), offer count, basis fingerprint (tamper-evidence anchor), and both
-- retention clocks. Disparate-impact monitoring (ADR-0029) + adverse-action
-- reproduction read this table without decrypting anything.
CREATE TABLE "decision_records" (
  "id"                            UUID              NOT NULL DEFAULT gen_random_uuid(),
  "application_id"                UUID              NOT NULL,
  "merchant_id"                   UUID,
  -- Derived idempotency key `applicationId:sha256(canonical request)`.
  -- UNIQUE so a retried decide replays, never double-writes.
  "idempotency_key"               TEXT              NOT NULL,
  "disposition"                   "DecisionDisposition" NOT NULL,
  "reason_codes"                  TEXT[]            NOT NULL DEFAULT ARRAY[]::TEXT[],
  "offer_count"                   INTEGER           NOT NULL DEFAULT 0,
  "policy_version"                TEXT              NOT NULL,
  "rule_version"                  TEXT              NOT NULL,
  "scorer_version"                TEXT              NOT NULL,
  "effective_catalog_snapshot_id" TEXT              NOT NULL,
  -- SHA-256 of the canonical basis — tamper-evidence anchor (ADR-0011).
  "basis_fingerprint"             TEXT              NOT NULL,
  -- Offer freshness: 14 days, tied to the soft-pull (ADR-0030).
  "offers_valid_until"            TIMESTAMPTZ       NOT NULL,
  -- FCRA / Reg B 1002.12(b) record-retention floor: 25 months.
  "retain_until"                  TIMESTAMPTZ       NOT NULL,
  "decided_at"                    TIMESTAMPTZ       NOT NULL,
  "created_at"                    TIMESTAMPTZ       NOT NULL DEFAULT now(),

  CONSTRAINT "decision_records_pkey"                PRIMARY KEY ("id"),
  CONSTRAINT "decision_records_idempotency_key_key" UNIQUE      ("idempotency_key")
);

CREATE INDEX "decision_records_application_id_decided_at_idx"
  ON "decision_records" ("application_id", "decided_at" DESC);

CREATE INDEX "decision_records_disposition_decided_at_idx"
  ON "decision_records" ("disposition", "decided_at");

CREATE INDEX "decision_records_retain_until_idx"
  ON "decision_records" ("retain_until");

-- Encrypted §615(a) basis. Ciphertext is the opaque-envelope of the
-- canonical-JSON basis (prequal echo PII + score factors + version pins).
-- Never plaintext. AAD binds the envelope to this specific decision.
-- One per record; CASCADE-deleted with the record (purge tool drives this).
CREATE TABLE "decision_bases" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "decision_id"    UUID        NOT NULL,
  "ciphertext"     TEXT        NOT NULL,
  "fingerprint"    TEXT        NOT NULL,
  "inputs_hash"    TEXT        NOT NULL,
  "schema_version" INTEGER     NOT NULL DEFAULT 1,
  "retain_until"   TIMESTAMPTZ NOT NULL,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "decision_bases_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "decision_bases_decision_id_key" UNIQUE    ("decision_id"),
  CONSTRAINT "decision_bases_decision_id_fkey"
    FOREIGN KEY ("decision_id") REFERENCES "decision_records" ("id") ON DELETE CASCADE
);

CREATE INDEX "decision_bases_retain_until_idx"
  ON "decision_bases" ("retain_until");

-- Encrypted dead-letter for decisions whose durable write failed (ADR-0033).
-- Stores the already-encrypted intended write — never plaintext — so a
-- reconcile tool can replay without leaking PII.
CREATE TABLE "decision_dlq" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  -- Key the failed write would have claimed; lets the reconcile tool
  -- dedupe against a later successful decision_records row.
  "idempotency_key" TEXT        NOT NULL,
  "application_id"  UUID,
  "ciphertext"      TEXT        NOT NULL,
  "fingerprint"     TEXT        NOT NULL,
  -- A failure CLASS, not a raw error string (no PII, no stack trace).
  "failure_reason"  TEXT        NOT NULL,
  "attempts"        INTEGER     NOT NULL DEFAULT 1,
  "retain_until"    TIMESTAMPTZ NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolved_at"     TIMESTAMPTZ,

  CONSTRAINT "decision_dlq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "decision_dlq_resolved_at_created_at_idx"
  ON "decision_dlq" ("resolved_at", "created_at");

CREATE INDEX "decision_dlq_idempotency_key_idx"
  ON "decision_dlq" ("idempotency_key");
