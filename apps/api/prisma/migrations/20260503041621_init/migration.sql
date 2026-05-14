-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending_verification', 'active', 'locked', 'closed');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('not_started', 'in_progress', 'approved', 'manual_review', 'rejected');

-- CreateEnum
CREATE TYPE "PepStatus" AS ENUM ('unknown', 'cleared', 'match');

-- CreateEnum
CREATE TYPE "LoanCategory" AS ENUM ('auto', 'home_improvement', 'medical', 'retail', 'personal', 'consolidation');

-- CreateEnum
CREATE TYPE "OriginationChannel" AS ENUM ('consumer_direct', 'merchant_link', 'merchant_widget');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'underwriting', 'offers_presented', 'accepted', 'contracted', 'funding', 'active', 'declined', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('presented', 'accepted', 'expired', 'withdrawn');

-- CreateEnum
CREATE TYPE "LenderTier" AS ENUM ('internal', 'prime', 'near_prime', 'bnpl', 'subprime');

-- CreateEnum
CREATE TYPE "LenderRouteOutcome" AS ENUM ('eligible', 'ineligible', 'approved', 'declined', 'error', 'timeout');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('funding_pending', 'active', 'paid_off', 'charged_off', 'cancelled');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('drafted', 'sent', 'signed', 'declined', 'expired', 'voided');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('pending', 'kyb_in_progress', 'kyb_manual_review', 'active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "KybStatus" AS ENUM ('not_started', 'in_progress', 'approved', 'manual_review', 'rejected');

-- CreateEnum
CREATE TYPE "MerchantUserRole" AS ENUM ('owner', 'admin', 'staff', 'read_only');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('debit_card', 'bank_account');

-- CreateEnum
CREATE TYPE "PaymentMethodStatus" AS ENUM ('pending_verification', 'verified', 'failed', 'removed');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'succeeded', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "RepaymentStatus" AS ENUM ('scheduled', 'due', 'paid', 'partial', 'late', 'charged_off', 'waived');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('push', 'email', 'sms', 'in_app');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'suppressed');

-- CreateEnum
CREATE TYPE "RiskRecommendation" AS ENUM ('accept', 'manual_review', 'decline');

-- CreateEnum
CREATE TYPE "RiskFlagSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ComplianceReviewStatus" AS ENUM ('open', 'pending_dual_control', 'closed_approved', 'closed_declined', 'closed_no_action', 'escalated_reportable');

-- CreateEnum
CREATE TYPE "ComplianceReviewKind" AS ENUM ('application_decline', 'application_approve_override', 'risk_flag_resolution', 'pii_unmask_request', 'ofac_match', 'reportable_event');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('adverse_action_notice', 'loan_agreement', 'privacy_notice', 'amortization_schedule', 'payoff_quote', 'payment_assistance_letter', 'identity_verification_image', 'bank_statement', 'payslip', 'other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('active', 'superseded', 'retained', 'destroyed');

-- CreateEnum
CREATE TYPE "PiiUnmaskStatus" AS ENUM ('pending_approval', 'approved', 'revoked', 'expired', 'consumed');

-- CreateEnum
CREATE TYPE "PiiUnmaskReasonCode" AS ENUM ('manual_underwriting_review', 'fraud_investigation', 'customer_service_request', 'compliance_review', 'legal_request', 'reportable_matter_filing', 'notice_re_render');

-- CreateEnum
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('active', 'paused', 'disabled', 'revoked');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'in_flight', 'delivered', 'failed', 'dead_letter');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone_e164" TEXT,
    "password_hash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'pending_verification',
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'not_started',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumer_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pii_ciphertext" BYTEA NOT NULL,
    "pii_nonce" BYTEA NOT NULL,
    "data_key_ciphertext" BYTEA NOT NULL,
    "kek_id" TEXT NOT NULL,
    "pii_schema_version" INTEGER NOT NULL DEFAULT 1,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'not_started',
    "kyc_provider_ref" TEXT,
    "kyc_last_checked_at" TIMESTAMPTZ(6),
    "kyc_completed_at" TIMESTAMPTZ(6),
    "pep_status" "PepStatus" NOT NULL DEFAULT 'unknown',
    "sanctions_checked_at" TIMESTAMPTZ(6),
    "resident_state" VARCHAR(2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consumer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "key" TEXT NOT NULL,
    "user_id" UUID,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "merchant_id" UUID,
    "channel" "OriginationChannel" NOT NULL DEFAULT 'consumer_direct',
    "category" "LoanCategory" NOT NULL,
    "requested_amount_cents" BIGINT NOT NULL,
    "term_months" INTEGER NOT NULL,
    "purpose_detail" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "risk_score" INTEGER,
    "affordability_passes" BOOLEAN,
    "decline_reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policy_version" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "decision_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "lender_product_id" UUID NOT NULL,
    "lender_of_record" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "term_months" INTEGER NOT NULL,
    "apr_bps" INTEGER NOT NULL,
    "comparison_rate_bps" INTEGER,
    "fees_cents" BIGINT NOT NULL,
    "total_repayable_cents" BIGINT NOT NULL,
    "rank" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'presented',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "signature_provider" TEXT NOT NULL,
    "envelope_id" TEXT NOT NULL,
    "document_sha256" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'drafted',
    "signed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lender_of_record" TEXT NOT NULL,
    "lender_product_id" UUID NOT NULL,
    "principal_cents" BIGINT NOT NULL,
    "term_months" INTEGER NOT NULL,
    "apr_bps" INTEGER NOT NULL,
    "total_repayable_cents" BIGINT NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'funding_pending',
    "disbursed_at" TIMESTAMPTZ(6),
    "first_payment_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lenders" (
    "id" UUID NOT NULL,
    "adapter_key" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "lender_of_record" TEXT NOT NULL,
    "tier" "LenderTier" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "sla_p95_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_products" (
    "id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "product_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "min_amount_cents" BIGINT NOT NULL,
    "max_amount_cents" BIGINT NOT NULL,
    "min_term_months" INTEGER NOT NULL,
    "max_term_months" INTEGER NOT NULL,
    "permitted_states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lender_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_routes" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "lender_product_id" UUID NOT NULL,
    "evaluation_order" INTEGER NOT NULL,
    "evaluated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluation_latency_ms" INTEGER,
    "outcome" "LenderRouteOutcome" NOT NULL,
    "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raw_response_ref" TEXT,

    CONSTRAINT "lender_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "dba" TEXT,
    "ein" TEXT,
    "formation_state" VARCHAR(2),
    "naics_code" TEXT,
    "mcc" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "status" "MerchantStatus" NOT NULL DEFAULT 'pending',
    "kyb_status" "KybStatus" NOT NULL DEFAULT 'not_started',
    "kyb_provider_ref" TEXT,
    "kyb_last_checked_at" TIMESTAMPTZ(6),
    "kyb_completed_at" TIMESTAMPTZ(6),
    "mdr_bps" INTEGER NOT NULL DEFAULT 0,
    "application_fee_cents" BIGINT NOT NULL DEFAULT 0,
    "settlement_account_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_users" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MerchantUserRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "merchant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficial_owners" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "pii_ciphertext" BYTEA NOT NULL,
    "pii_nonce" BYTEA NOT NULL,
    "data_key_ciphertext" BYTEA NOT NULL,
    "kek_id" TEXT NOT NULL,
    "pii_schema_version" INTEGER NOT NULL DEFAULT 1,
    "ownership_pct" INTEGER NOT NULL,
    "is_controlling" BOOLEAN NOT NULL DEFAULT false,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'not_started',
    "pep_status" "PepStatus" NOT NULL DEFAULT 'unknown',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "beneficial_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_links" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "category" "LoanCategory",
    "amount_hint_cents" BIGINT,
    "customer_email" TEXT,
    "customer_phone" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_by_application_id" UUID,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,

    CONSTRAINT "application_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_token" TEXT NOT NULL,
    "last4" TEXT,
    "brand" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "PaymentMethodStatus" NOT NULL DEFAULT 'pending_verification',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "loan_id" UUID,
    "payment_method_id" UUID,
    "repayment_id" UUID,
    "direction" "TransactionDirection" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "provider_ref" TEXT NOT NULL,
    "failure_reason" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayments" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "amount_due_cents" BIGINT NOT NULL,
    "amount_paid_cents" BIGINT NOT NULL DEFAULT 0,
    "status" "RepaymentStatus" NOT NULL DEFAULT 'scheduled',
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "subject_type" TEXT,
    "subject_id" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "provider_ref" TEXT,
    "failure_reason" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "recommendation" "RiskRecommendation" NOT NULL,
    "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signals" JSONB NOT NULL DEFAULT '{}',
    "policy_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_flags" (
    "id" UUID NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "flag_type" TEXT NOT NULL,
    "severity" "RiskFlagSeverity" NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "raised_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" TEXT,

    CONSTRAINT "risk_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_reviews" (
    "id" UUID NOT NULL,
    "kind" "ComplianceReviewKind" NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ComplianceReviewStatus" NOT NULL DEFAULT 'open',
    "created_by_user_id" UUID NOT NULL,
    "closed_by_user_id" UUID,
    "dual_control_required" BOOLEAN NOT NULL DEFAULT false,
    "reportable_matter_ref" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "compliance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pii_unmask_requests" (
    "id" UUID NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason_code" "PiiUnmaskReasonCode" NOT NULL,
    "reason_notes" TEXT NOT NULL,
    "status" "PiiUnmaskStatus" NOT NULL DEFAULT 'pending_approval',
    "requested_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_user_id" UUID,
    "compliance_review_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pii_unmask_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "storage" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "retain_until" TIMESTAMPTZ(6),
    "status" "DocumentStatus" NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'active',
    "description" TEXT,
    "last_delivered_at" TIMESTAMPTZ(6),
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "subject_type" TEXT,
    "subject_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "last_status_code" INTEGER,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_outbox" (
    "id" UUID NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "audit_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "consumer_profiles_user_id_key" ON "consumer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "consumer_profiles_kyc_status_idx" ON "consumer_profiles"("kyc_status");

-- CreateIndex
CREATE INDEX "consumer_profiles_resident_state_idx" ON "consumer_profiles"("resident_state");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE INDEX "applications_user_id_created_at_idx" ON "applications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "applications_merchant_id_created_at_idx" ON "applications"("merchant_id", "created_at");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "offers_application_id_rank_idx" ON "offers"("application_id", "rank");

-- CreateIndex
CREATE INDEX "offers_application_id_status_idx" ON "offers"("application_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_offer_id_key" ON "contracts"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_envelope_id_key" ON "contracts"("envelope_id");

-- CreateIndex
CREATE INDEX "contracts_envelope_id_idx" ON "contracts"("envelope_id");

-- CreateIndex
CREATE UNIQUE INDEX "loans_offer_id_key" ON "loans"("offer_id");

-- CreateIndex
CREATE INDEX "loans_user_id_created_at_idx" ON "loans"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lenders_adapter_key_key" ON "lenders"("adapter_key");

-- CreateIndex
CREATE UNIQUE INDEX "lender_products_product_key_key" ON "lender_products"("product_key");

-- CreateIndex
CREATE INDEX "lender_routes_application_id_evaluation_order_idx" ON "lender_routes"("application_id", "evaluation_order");

-- CreateIndex
CREATE INDEX "lender_routes_lender_id_evaluated_at_idx" ON "lender_routes"("lender_id", "evaluated_at");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_slug_key" ON "merchants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_ein_key" ON "merchants"("ein");

-- CreateIndex
CREATE INDEX "merchants_status_idx" ON "merchants"("status");

-- CreateIndex
CREATE INDEX "merchant_users_user_id_idx" ON "merchant_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_users_merchant_id_user_id_key" ON "merchant_users"("merchant_id", "user_id");

-- CreateIndex
CREATE INDEX "beneficial_owners_merchant_id_idx" ON "beneficial_owners"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_links_token_hash_key" ON "application_links"("token_hash");

-- CreateIndex
CREATE INDEX "application_links_merchant_id_created_at_idx" ON "application_links"("merchant_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_methods_user_id_status_idx" ON "payment_methods"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_repayment_id_key" ON "transactions"("repayment_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_provider_ref_key" ON "transactions"("provider_ref");

-- CreateIndex
CREATE INDEX "transactions_loan_id_occurred_at_idx" ON "transactions"("loan_id", "occurred_at");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "repayments_loan_id_due_date_idx" ON "repayments"("loan_id", "due_date");

-- CreateIndex
CREATE INDEX "repayments_status_due_date_idx" ON "repayments"("status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "repayments_loan_id_sequence_key" ON "repayments"("loan_id", "sequence");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_channel_read_at_idx" ON "notifications"("user_id", "channel", "read_at");

-- CreateIndex
CREATE INDEX "notifications_status_created_at_idx" ON "notifications"("status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_subject_type_subject_id_idx" ON "notifications"("subject_type", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assessments_application_id_key" ON "risk_assessments"("application_id");

-- CreateIndex
CREATE INDEX "risk_assessments_recommendation_created_at_idx" ON "risk_assessments"("recommendation", "created_at");

-- CreateIndex
CREATE INDEX "risk_flags_subject_type_subject_id_raised_at_idx" ON "risk_flags"("subject_type", "subject_id", "raised_at");

-- CreateIndex
CREATE INDEX "risk_flags_flag_type_raised_at_idx" ON "risk_flags"("flag_type", "raised_at");

-- CreateIndex
CREATE INDEX "risk_flags_severity_resolved_at_idx" ON "risk_flags"("severity", "resolved_at");

-- CreateIndex
CREATE INDEX "compliance_reviews_status_created_at_idx" ON "compliance_reviews"("status", "created_at");

-- CreateIndex
CREATE INDEX "compliance_reviews_subject_type_subject_id_idx" ON "compliance_reviews"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "compliance_reviews_kind_created_at_idx" ON "compliance_reviews"("kind", "created_at");

-- CreateIndex
CREATE INDEX "pii_unmask_requests_subject_type_subject_id_idx" ON "pii_unmask_requests"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "pii_unmask_requests_status_expires_at_idx" ON "pii_unmask_requests"("status", "expires_at");

-- CreateIndex
CREATE INDEX "pii_unmask_requests_requested_by_user_id_created_at_idx" ON "pii_unmask_requests"("requested_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_owner_type_owner_id_kind_idx" ON "documents"("owner_type", "owner_id", "kind");

-- CreateIndex
CREATE INDEX "documents_status_retain_until_idx" ON "documents"("status", "retain_until");

-- CreateIndex
CREATE INDEX "documents_sha256_idx" ON "documents"("sha256");

-- CreateIndex
CREATE INDEX "webhook_endpoints_merchant_id_status_idx" ON "webhook_endpoints"("merchant_id", "status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_next_attempt_at_idx" ON "webhook_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_endpoint_id_created_at_idx" ON "webhook_deliveries"("endpoint_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_endpoint_id_event_id_key" ON "webhook_deliveries"("endpoint_id", "event_id");

-- CreateIndex
CREATE INDEX "audit_outbox_published_at_idx" ON "audit_outbox"("published_at");

-- CreateIndex
CREATE INDEX "audit_outbox_target_type_target_id_idx" ON "audit_outbox"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "consumer_profiles" ADD CONSTRAINT "consumer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_lender_product_id_fkey" FOREIGN KEY ("lender_product_id") REFERENCES "lender_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_products" ADD CONSTRAINT "lender_products_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_routes" ADD CONSTRAINT "lender_routes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_routes" ADD CONSTRAINT "lender_routes_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_routes" ADD CONSTRAINT "lender_routes_lender_product_id_fkey" FOREIGN KEY ("lender_product_id") REFERENCES "lender_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_links" ADD CONSTRAINT "application_links_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_repayment_id_fkey" FOREIGN KEY ("repayment_id") REFERENCES "repayments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayments" ADD CONSTRAINT "repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
