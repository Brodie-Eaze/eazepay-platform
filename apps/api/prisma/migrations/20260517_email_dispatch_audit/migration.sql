-- SOC2 + SEC — durable audit row for every transactional email.
-- See services/email/email-dispatch-audit.service.ts for the writer
-- and apps/api/prisma/schema.prisma model EmailDispatch for the
-- generated TypeScript surface.
--
-- Body is intentionally NOT persisted (regenerable from template +
-- originating-service args; PII would otherwise live in this row).

CREATE TABLE "email_dispatch" (
    "id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_dispatch_pkey" PRIMARY KEY ("id")
);

-- "Show me every email to recipient X, newest first."
CREATE INDEX "email_dispatch_recipient_sent_at_idx"
  ON "email_dispatch"("recipient", "sent_at" DESC);

-- "Show me every email of template Y in date range Z."
CREATE INDEX "email_dispatch_template_key_sent_at_idx"
  ON "email_dispatch"("template_key", "sent_at" DESC);

-- Per-vertical FinOps + compliance reports.
CREATE INDEX "email_dispatch_brand_sent_at_idx"
  ON "email_dispatch"("brand", "sent_at" DESC);

-- Idempotency lookup (non-unique — see model docstring).
CREATE INDEX "email_dispatch_idempotency_key_idx"
  ON "email_dispatch"("idempotency_key");
