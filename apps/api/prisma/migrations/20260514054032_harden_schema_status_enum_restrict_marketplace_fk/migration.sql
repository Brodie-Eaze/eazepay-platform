/*
  Warnings:

  - The `status` column on the `highsale_snapshots` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "HighsaleSnapshotStatus" AS ENUM ('pending', 'scored', 'expired', 'failed');

-- DropForeignKey
ALTER TABLE "partner_lender_access" DROP CONSTRAINT "partner_lender_access_marketplace_lender_id_fkey";

-- AlterTable
ALTER TABLE "highsale_snapshots" DROP COLUMN "status",
ADD COLUMN     "status" "HighsaleSnapshotStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "lender_products" ADD COLUMN     "marketplace_lender_id" UUID;

-- CreateIndex
CREATE INDEX "highsale_snapshots_credit_tier_status_idx" ON "highsale_snapshots"("credit_tier", "status");

-- AddForeignKey
ALTER TABLE "lender_products" ADD CONSTRAINT "lender_products_marketplace_lender_id_fkey" FOREIGN KEY ("marketplace_lender_id") REFERENCES "marketplace_lenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_lender_access" ADD CONSTRAINT "partner_lender_access_marketplace_lender_id_fkey" FOREIGN KEY ("marketplace_lender_id") REFERENCES "marketplace_lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
