-- CreateEnum
CREATE TYPE "CreditTier" AS ENUM ('prime_plus', 'prime', 'near_prime', 'sub_prime', 'no_match');

-- CreateEnum
CREATE TYPE "MarketplaceProvider" AS ENUM ('engine_tech', 'in_house', 'affiliate_network', 'manual');

-- CreateEnum
CREATE TYPE "MarketplaceStatus" AS ENUM ('active', 'paused', 'disconnected');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "credit_tier" "CreditTier";

-- CreateTable
CREATE TABLE "marketplaces" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "provider" "MarketplaceProvider" NOT NULL,
    "status" "MarketplaceStatus" NOT NULL DEFAULT 'active',
    "api_base_url" TEXT,
    "webhook_secret_ciphertext" TEXT,
    "lender_count" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_lenders" (
    "id" UUID NOT NULL,
    "marketplace_id" UUID NOT NULL,
    "external_lender_id" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "serves_tiers" "CreditTier"[] DEFAULT ARRAY[]::"CreditTier"[],
    "brands" "ProductBrand"[] DEFAULT ARRAY[]::"ProductBrand"[],
    "min_amount_cents" BIGINT NOT NULL,
    "max_amount_cents" BIGINT NOT NULL,
    "min_score" INTEGER,
    "permitted_states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "globally_enabled" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_lenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_lender_access" (
    "id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "marketplace_lender_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "changed_by_id" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_lender_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "highsale_snapshots" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "highsale_ref" TEXT NOT NULL,
    "credit_tier" "CreditTier" NOT NULL,
    "fico_band" TEXT,
    "payload_ciphertext" TEXT NOT NULL,
    "payload_fingerprint" TEXT NOT NULL,
    "inputs_hash" TEXT NOT NULL,
    "inquiry_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "highsale_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplaces_slug_key" ON "marketplaces"("slug");

-- CreateIndex
CREATE INDEX "marketplaces_status_idx" ON "marketplaces"("status");

-- CreateIndex
CREATE INDEX "marketplace_lenders_marketplace_id_globally_enabled_idx" ON "marketplace_lenders"("marketplace_id", "globally_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_lenders_marketplace_id_external_lender_id_key" ON "marketplace_lenders"("marketplace_id", "external_lender_id");

-- CreateIndex
CREATE INDEX "partner_lender_access_merchant_id_idx" ON "partner_lender_access"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_lender_access_merchant_id_marketplace_lender_id_key" ON "partner_lender_access"("merchant_id", "marketplace_lender_id");

-- CreateIndex
CREATE UNIQUE INDEX "highsale_snapshots_application_id_key" ON "highsale_snapshots"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "highsale_snapshots_highsale_ref_key" ON "highsale_snapshots"("highsale_ref");

-- CreateIndex
CREATE INDEX "highsale_snapshots_credit_tier_status_idx" ON "highsale_snapshots"("credit_tier", "status");

-- AddForeignKey
ALTER TABLE "marketplace_lenders" ADD CONSTRAINT "marketplace_lenders_marketplace_id_fkey" FOREIGN KEY ("marketplace_id") REFERENCES "marketplaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_lender_access" ADD CONSTRAINT "partner_lender_access_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_lender_access" ADD CONSTRAINT "partner_lender_access_marketplace_lender_id_fkey" FOREIGN KEY ("marketplace_lender_id") REFERENCES "marketplace_lenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highsale_snapshots" ADD CONSTRAINT "highsale_snapshots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
