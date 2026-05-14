-- CreateEnum
CREATE TYPE "ProductBrand" AS ENUM ('medpay', 'tradepay', 'coachpay', 'direct');

-- CreateEnum
CREATE TYPE "LenderConnectionStatus" AS ENUM ('draft', 'awaiting_creds', 'testing', 'sandbox_active', 'live', 'paused', 'revoked');

-- CreateEnum
CREATE TYPE "LenderConnectionEnv" AS ENUM ('sandbox', 'live');

-- CreateEnum
CREATE TYPE "LenderHealthcheckOutcome" AS ENUM ('ok', 'timeout', 'auth_failure', 'schema_mismatch', 'http_error', 'network_error');

-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN     "brand" "ProductBrand" NOT NULL DEFAULT 'direct';

-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "brand" "ProductBrand" NOT NULL DEFAULT 'direct';

-- CreateTable
CREATE TABLE "lender_connections" (
    "id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "env" "LenderConnectionEnv" NOT NULL,
    "status" "LenderConnectionStatus" NOT NULL DEFAULT 'draft',
    "brand" "ProductBrand" NOT NULL DEFAULT 'direct',
    "base_url" TEXT NOT NULL,
    "inbound_webhook_url" TEXT,
    "outbound_webhook_path" TEXT NOT NULL DEFAULT '',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "api_key_ciphertext" TEXT,
    "api_key_fingerprint" TEXT,
    "api_secret_ciphertext" TEXT,
    "webhook_secret_ciphertext" TEXT,
    "last_healthcheck_at" TIMESTAMPTZ(6),
    "last_healthcheck_outcome" "LenderHealthcheckOutcome",
    "last_healthcheck_latency_ms" INTEGER,
    "failure_count_1h" INTEGER NOT NULL DEFAULT 0,
    "activated_by_id" UUID,
    "activated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lender_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_healthchecks" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" "LenderHealthcheckOutcome" NOT NULL,
    "latency_ms" INTEGER,
    "http_status" INTEGER,
    "detail" TEXT,
    "initiated_by" TEXT,

    CONSTRAINT "lender_healthchecks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lender_connections_status_idx" ON "lender_connections"("status");

-- CreateIndex
CREATE INDEX "lender_connections_brand_status_idx" ON "lender_connections"("brand", "status");

-- CreateIndex
CREATE INDEX "lender_healthchecks_connection_id_at_idx" ON "lender_healthchecks"("connection_id", "at");

-- AddForeignKey
ALTER TABLE "lender_connections" ADD CONSTRAINT "lender_connections_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lender_healthchecks" ADD CONSTRAINT "lender_healthchecks_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "lender_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
