-- AlterTable
ALTER TABLE "Credential" ADD COLUMN "host" TEXT;
ALTER TABLE "Credential" ADD COLUMN "port" INTEGER;
ALTER TABLE "Credential" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Credential" ADD COLUMN "lastRotatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Credential_organizationId_expiresAt_idx" ON "Credential"("organizationId", "expiresAt");
