-- Sprint 9 — session revocation: per-user token version embedded in the JWT
-- AlterTable
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
