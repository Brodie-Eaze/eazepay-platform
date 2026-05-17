-- Events bus — fleet-wide real-time activity log.
--
-- Backs the SSE streams (master /v1/events/stream + per-application
-- /v1/applications/:id/stream). Every state-changing operation that
-- partner or master operator wants to see in real-time writes a row
-- here inside the same Postgres transaction as the state change, then
-- a Redis pub/sub broadcast fans it out to live subscribers.
--
-- See ADR-0019 for the threat model + scope rules.
--
-- Indexes target the dominant queries:
--   (merchant_id, id DESC) — partner SSE catchup + recent list
--   (kind, id DESC)        — master filter chip ("Billing only")
--   (target_type, target_id) — per-entity ticker (e.g. app detail)
--   (at)                   — retention sweep (90-day TTL cron)

CREATE TYPE "EventKind" AS ENUM (
  'application_opened',
  'application_submitted',
  'application_viewed',
  'application_abandoned',
  'offer_received',
  'offer_selected',
  'contract_signed',
  'funding_released',
  'invoice_generated',
  'invoice_sent',
  'invoice_confirmed',
  'invoice_disputed',
  'invoice_paid',
  'config_changed',
  'auth_signin_failed'
);

CREATE TABLE "event_log" (
  "id"              BIGSERIAL PRIMARY KEY,
  "uuid"            UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  "kind"            "EventKind" NOT NULL,
  -- NULL = master-only event (e.g. auth_signin_failed for an unknown
  -- user). When non-null, partner SSE filters on JWT.merchantId match.
  "merchant_id"     UUID,
  "target_type"     TEXT NOT NULL,
  "target_id"       TEXT NOT NULL,
  "actor_id"        UUID,
  "actor_label"     TEXT NOT NULL,
  -- ID-only payload (allowlisted shapes per sanitiser.ts). Free-text
  -- PII must ride in payload_pii_enc instead.
  "payload"         JSONB NOT NULL,
  -- Envelope-encrypted blob (PiiVaultService.sealOpaque with AAD =
  -- {entity:event_log, field:payloadPii, eventUuid:<uuid>}). NULL when
  -- the event carries no free-text PII. Partner SSE never surfaces it.
  "payload_pii_enc" TEXT,
  "at"              TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX "event_log_merchant_id_desc" ON "event_log"("merchant_id", "id" DESC);
CREATE INDEX "event_log_kind_id_desc"     ON "event_log"("kind", "id" DESC);
CREATE INDEX "event_log_target"           ON "event_log"("target_type", "target_id");
CREATE INDEX "event_log_at"               ON "event_log"("at");
