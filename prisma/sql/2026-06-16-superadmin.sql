-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "adminNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "featureOverrides" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "maxUsers" INTEGER,
ADD COLUMN     "suspendedReason" TEXT;

-- CreateTable
CREATE TABLE "PlatformAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAnnouncement_isActive_startsAt_idx" ON "PlatformAnnouncement"("isActive", "startsAt");

