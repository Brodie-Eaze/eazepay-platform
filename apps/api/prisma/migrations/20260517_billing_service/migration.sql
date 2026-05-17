-- Billing service — platform-fee invoicing.
--
-- Creates BillingConfig (per-merchant), Invoice (one per period), and
-- the supporting append-only InvoicePayment + InvoiceActivity tables,
-- plus ConfirmToken for the recipient confirm/dispute page.
--
-- Indexes target dominant queries: period+status, status+dueDate (the
-- Collections lane), and per-invoice activity time-desc.
--
-- PII posture:
--   billing_configs.send_to_email_enc is an envelope-encrypted blob
--   (PiiVaultService.sealOpaque). AAD binds the ciphertext to the
--   row (entity=billing_config, field=sendToEmail, merchantId=<uuid>).
--   Swapping ciphertext between rows fails the GCM auth-tag check.

CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'weekly', 'paused');

CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'overdue', 'voided');

CREATE TYPE "InvoicePaymentMethod" AS ENUM ('ach', 'wire', 'card', 'check', 'other');

CREATE TYPE "InvoiceActivityKind" AS ENUM (
  'status_change',
  'fee_pct_change',
  'fee_amount_change',
  'due_date_change',
  'payment_recorded',
  'voided',
  'unvoided',
  'email_composed',
  'generated',
  'confirmed',
  'disputed'
);

CREATE TYPE "ConfirmState" AS ENUM ('pending', 'confirmed', 'disputed');

CREATE TABLE "billing_configs" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchant_id"            UUID NOT NULL UNIQUE REFERENCES "merchants"("id") ON DELETE CASCADE,
  "cycle"                  "BillingCycle" NOT NULL DEFAULT 'monthly',
  "day_of_period"          INTEGER NOT NULL DEFAULT 1,
  "send_to_email_enc"      TEXT,
  "auto_send"              BOOLEAN NOT NULL DEFAULT FALSE,
  "payment_link_template"  TEXT,
  "note"                   TEXT,
  "updated_by_id"          UUID,
  "created_at"             TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX "billing_configs_cycle_idx" ON "billing_configs"("cycle");

CREATE TABLE "invoices" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_no"          TEXT NOT NULL UNIQUE,
  "merchant_id"         UUID NOT NULL REFERENCES "merchants"("id") ON DELETE RESTRICT,
  "billing_config_id"   UUID REFERENCES "billing_configs"("id") ON DELETE SET NULL,
  "period_id"           TEXT NOT NULL,
  "period_label"        TEXT NOT NULL,
  "period_start"        DATE NOT NULL,
  "period_end"          DATE NOT NULL,
  "gross_funded_cents"  BIGINT NOT NULL,
  "fee_bps"             INTEGER NOT NULL,
  "amount_cents"        BIGINT NOT NULL,
  "status"              "InvoiceStatus" NOT NULL DEFAULT 'draft',
  "due_date"            DATE NOT NULL,
  "voided_at"           TIMESTAMPTZ(6),
  "void_reason"         TEXT,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "invoices_merchant_period_unique" ON "invoices"("merchant_id", "period_id");
CREATE INDEX "invoices_period_status_idx" ON "invoices"("period_id", "status");
CREATE INDEX "invoices_status_due_idx" ON "invoices"("status", "due_date");

CREATE TABLE "invoice_payments" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_id"     UUID NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "amount_cents"   BIGINT NOT NULL,
  "paid_at"        DATE NOT NULL,
  "method"         "InvoicePaymentMethod" NOT NULL,
  "reference"      TEXT,
  "note"           TEXT,
  "recorded_by_id" UUID,
  "recorded_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX "invoice_payments_invoice_idx" ON "invoice_payments"("invoice_id");

CREATE TABLE "invoice_activity" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_id"   UUID NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "kind"         "InvoiceActivityKind" NOT NULL,
  "actor_label"  TEXT NOT NULL,
  "actor_id"     UUID,
  "summary"      TEXT NOT NULL,
  "remote_ip"    TEXT,
  "user_agent"   TEXT,
  "at"           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX "invoice_activity_invoice_at_desc_idx" ON "invoice_activity"("invoice_id", "at" DESC);

CREATE TABLE "confirm_tokens" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "token"          TEXT NOT NULL UNIQUE,
  "invoice_id"     UUID NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "state"          "ConfirmState" NOT NULL DEFAULT 'pending',
  "acted_at"       TIMESTAMPTZ(6),
  "dispute_reason" TEXT,
  "remote_ip"      TEXT,
  "user_agent"     TEXT,
  "expires_at"     TIMESTAMPTZ(6) NOT NULL,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX "confirm_tokens_invoice_idx" ON "confirm_tokens"("invoice_id");
CREATE INDEX "confirm_tokens_expires_idx" ON "confirm_tokens"("expires_at");
