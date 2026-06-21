-- Phase 2b: profile fields, per-company storage quota, storage pool.
ALTER TABLE "User"     ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User"     ADD COLUMN IF NOT EXISTS "bio"   TEXT NOT NULL DEFAULT '';
ALTER TABLE "Company"  ADD COLUMN IF NOT EXISTS "storageQuotaBytes" INTEGER;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "storagePool" TEXT NOT NULL DEFAULT 'primary';
