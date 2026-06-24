CREATE TABLE IF NOT EXISTS "SavedTemplate" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "baseId" TEXT NOT NULL, "html" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT, "createdByName" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SavedTemplate_companyId_idx" ON "SavedTemplate"("companyId");
CREATE TABLE IF NOT EXISTS "SavedTemplateVersion" (
  "id" TEXT NOT NULL, "savedTemplateId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "html" TEXT NOT NULL, "createdByName" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedTemplateVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SavedTemplateVersion_savedTemplateId_idx" ON "SavedTemplateVersion"("savedTemplateId");
DO $$ BEGIN
  ALTER TABLE "SavedTemplate" ADD CONSTRAINT "SavedTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SavedTemplateVersion" ADD CONSTRAINT "SavedTemplateVersion_savedTemplateId_fkey" FOREIGN KEY ("savedTemplateId") REFERENCES "SavedTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
