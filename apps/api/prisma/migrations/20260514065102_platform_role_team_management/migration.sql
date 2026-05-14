-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('master_admin', 'admin', 'underwriter', 'compliance', 'support', 'read_only');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "invited_at" TIMESTAMPTZ(6),
ADD COLUMN     "invited_by_id" UUID,
ADD COLUMN     "last_seen_at" TIMESTAMPTZ(6),
ADD COLUMN     "platform_role" "PlatformRole";

-- CreateIndex
CREATE INDEX "users_platform_role_idx" ON "users"("platform_role");
