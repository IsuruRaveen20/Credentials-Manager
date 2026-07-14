-- CreateTable
CREATE TABLE IF NOT EXISTS "CredentialCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CredentialCategory_organizationId_name_key" ON "CredentialCategory"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "CredentialCategory_organizationId_idx" ON "CredentialCategory"("organizationId");

DO $$ BEGIN
  ALTER TABLE "CredentialCategory" ADD CONSTRAINT "CredentialCategory_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
