-- ============================================================
-- 0003_platform_scaffolding — backend foundations for EazePay
-- platform demo + MedPay launch infrastructure.
--
-- Tables added
--   lenders               persisted lender registry (replaces fixture)
--   vertical_configs      per-vertical config (MedPay/TradePay/CoachPay)
--   partner_marketplaces  per-partner lender override (admin toggle)
--   mids                  MiCamp merchant IDs per partner
--   decisions             decision-engine evaluation audit trail
--   audit_log             admin-action audit log (non-application scope)
--   customer_migrations   AI Funding → MedPay migration queue
--
-- All statements are idempotent (IF NOT EXISTS) so a half-applied
-- run can be safely retried. The `brand` enum is reused from 0001_init.
-- ============================================================

CREATE TABLE IF NOT EXISTS "lenders" (
  "id"                      text PRIMARY KEY NOT NULL,
  "display_name"            text NOT NULL,
  "enabled_brands"          text DEFAULT '' NOT NULL,
  "status"                  text DEFAULT 'pending_integration' NOT NULL,
  "connection_health"       text DEFAULT 'unknown' NOT NULL,
  "last_synced_at"          timestamp with time zone,
  "eligibility_rules_json"  text,
  "kickback_bps"            integer DEFAULT 0 NOT NULL,
  "webhook_url"             text,
  "webhook_secret"          text,
  "min_amount_cents"        bigint,
  "max_amount_cents"        bigint,
  "created_at"              timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"              timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "lenders_status_idx"        ON "lenders" ("status");
CREATE INDEX IF NOT EXISTS "lenders_display_name_idx"  ON "lenders" ("display_name");

CREATE TABLE IF NOT EXISTS "vertical_configs" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "brand"                 "brand" NOT NULL,
  "enabled_lender_ids"    text DEFAULT '' NOT NULL,
  "routing_mode"          text DEFAULT 'hybrid' NOT NULL,
  "routing_rules_json"    text,
  "form_schema_slug"      text,
  "branding_json"         text,
  "economics_json"        text,
  "published_at"          timestamp with time zone,
  "published_by"          text,
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "vertical_configs_brand_unique" ON "vertical_configs" ("brand");

CREATE TABLE IF NOT EXISTS "partner_marketplaces" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_id"    text NOT NULL,
  "lender_id"     text NOT NULL,
  "state"         text NOT NULL,
  "reason"        text,
  "changed_by"    text DEFAULT 'system' NOT NULL,
  "created_at"    timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"    timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "partner_marketplaces_partner_lender_unique"
  ON "partner_marketplaces" ("partner_id", "lender_id");
CREATE INDEX IF NOT EXISTS "partner_marketplaces_partner_idx"
  ON "partner_marketplaces" ("partner_id");

CREATE TABLE IF NOT EXISTS "mids" (
  "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_id"                text NOT NULL,
  "micamp_mid"                text,
  "provisioning_status"       text DEFAULT 'requested' NOT NULL,
  "provisioning_state_json"   text,
  "rate_card_json"            text,
  "post_underwriting_at"      timestamp with time zone,
  "volume_cents_to_date"      bigint DEFAULT 0 NOT NULL,
  "last_settled_at"           timestamp with time zone,
  "created_at"                timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"                timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "mids_partner_idx"     ON "mids" ("partner_id");
CREATE INDEX IF NOT EXISTS "mids_status_idx"      ON "mids" ("provisioning_status");
CREATE UNIQUE INDEX IF NOT EXISTS "mids_micamp_mid_unique" ON "mids" ("micamp_mid");

CREATE TABLE IF NOT EXISTS "decisions" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id"           uuid NOT NULL,
  "engine"                   text NOT NULL,
  "engine_version"           text DEFAULT 'v1' NOT NULL,
  "inputs_json"              text,
  "ranked_lenders_json"      text,
  "eligible_lender_count"    integer DEFAULT 0 NOT NULL,
  "excluded_lender_count"    integer DEFAULT 0 NOT NULL,
  "top_propensity_score"     integer,
  "latency_ms"               integer,
  "created_at"               timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "decisions_app_created_idx" ON "decisions" ("application_id", "created_at");
CREATE INDEX IF NOT EXISTS "decisions_engine_idx"      ON "decisions" ("engine");

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor"          text NOT NULL,
  "action"         text NOT NULL,
  "target_type"    text NOT NULL,
  "target_id"      text,
  "payload_json"   text,
  "ip_address"     text,
  "user_agent"     text,
  "created_at"     timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "audit_log_actor_created_idx" ON "audit_log" ("actor", "created_at");
CREATE INDEX IF NOT EXISTS "audit_log_target_idx"        ON "audit_log" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "audit_log_created_idx"       ON "audit_log" ("created_at");

CREATE TABLE IF NOT EXISTS "customer_migrations" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_customer_id"    text NOT NULL,
  "target_partner_id"     text,
  "source_product"        text DEFAULT 'ai_funding' NOT NULL,
  "target_brand"          "brand" DEFAULT 'medpay' NOT NULL,
  "status"                text DEFAULT 'queued' NOT NULL,
  "step_state_json"       text,
  "failure_reason"        text,
  "started_at"            timestamp with time zone,
  "completed_at"          timestamp with time zone,
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "customer_migrations_status_idx"
  ON "customer_migrations" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "customer_migrations_source_unique"
  ON "customer_migrations" ("source_customer_id");
