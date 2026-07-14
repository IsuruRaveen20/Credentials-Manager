-- AlterTable
ALTER TABLE "User" ALTER COLUMN "clerkId" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'disabled');

-- AlterTable User workforce fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'invited';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMP(3);

-- Unique email (may already be unique via clerk path; add if missing)
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CredentialShare" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CredentialShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CredentialShare_credentialId_userId_key" ON "CredentialShare"("credentialId", "userId");
CREATE INDEX IF NOT EXISTS "CredentialShare_userId_idx" ON "CredentialShare"("userId");

DO $$ BEGIN
  ALTER TABLE "CredentialShare" ADD CONSTRAINT "CredentialShare_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CredentialShare" ADD CONSTRAINT "CredentialShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CredentialShare" ADD CONSTRAINT "CredentialShare_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
