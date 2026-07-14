-- AlterTable
ALTER TABLE "Credential" ADD COLUMN IF NOT EXISTS "loginKind" TEXT NOT NULL DEFAULT 'username';

-- Infer email-looking identities from existing rows
UPDATE "Credential"
SET "loginKind" = 'email'
WHERE "username" IS NOT NULL AND "username" LIKE '%@%' AND "loginKind" = 'username';

UPDATE "Credential"
SET "loginKind" = 'none'
WHERE ("username" IS NULL OR TRIM("username") = '') AND "loginKind" = 'username';

CREATE INDEX IF NOT EXISTS "Credential_organizationId_category_idx" ON "Credential"("organizationId", "category");
