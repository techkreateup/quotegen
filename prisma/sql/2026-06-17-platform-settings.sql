-- Platform-wide key/value settings (super-admin editable).
-- Seeds the audit-log retention window (default 15 days) and indexes
-- AuditLog.createdAt for the daily retention-cleanup cron.
-- Apply with:
--   npx prisma db execute --file prisma/sql/2026-06-17-platform-settings.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "PlatformSetting" (
  "key"       TEXT NOT NULL PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "PlatformSetting" ("key", "value", "updatedAt")
VALUES ('audit_retention_days', '15', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
