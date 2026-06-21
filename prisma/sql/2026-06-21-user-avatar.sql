-- Add profile photo URL to User (UploadThing). Additive, safe, default ''.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT NOT NULL DEFAULT '';
