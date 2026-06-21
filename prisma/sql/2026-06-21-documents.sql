-- Document Vault (Phase 2). Only the Document table — unrelated drift from
-- `migrate diff` (AuditLog index, PlatformSetting default) deliberately omitted.
CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL DEFAULT '',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "description" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "employeeId" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Document_companyId_idx" ON "Document"("companyId");
CREATE INDEX IF NOT EXISTS "Document_companyId_category_idx" ON "Document"("companyId", "category");
CREATE INDEX IF NOT EXISTS "Document_companyId_expiresAt_idx" ON "Document"("companyId", "expiresAt");
CREATE INDEX IF NOT EXISTS "Document_companyId_employeeId_idx" ON "Document"("companyId", "employeeId");

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
