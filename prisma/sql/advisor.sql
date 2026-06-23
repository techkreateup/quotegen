-- Decision Advisor (Phase 3) — additive migration. Applied directly (testing phase).
-- Only advisor changes; pre-existing schema drift is intentionally excluded.

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "advisorContributes" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "AdvisorEvent" (
    "id" TEXT NOT NULL,
    "tenantHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "industry" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "amountBucket" TEXT NOT NULL,
    "discountBand" TEXT NOT NULL,
    "quarter" TEXT NOT NULL DEFAULT '',
    "won" BOOLEAN NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvisorEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorCohortStat" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cohortKey" TEXT NOT NULL,
    "cohortLevel" INTEGER NOT NULL,
    "discountBand" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "trials" INTEGER NOT NULL DEFAULT 0,
    "tenantCount" INTEGER NOT NULL DEFAULT 0,
    "epsilon" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorCohortStat_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorRecommendation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "shownAt" TIMESTAMP(3),
    "accepted" BOOLEAN,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdvisorEvent_kind_occurredAt_idx" ON "AdvisorEvent"("kind", "occurredAt");
CREATE INDEX IF NOT EXISTS "AdvisorEvent_tenantHash_idx" ON "AdvisorEvent"("tenantHash");
CREATE INDEX IF NOT EXISTS "AdvisorCohortStat_kind_idx" ON "AdvisorCohortStat"("kind");
CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorCohortStat_kind_cohortKey_discountBand_key" ON "AdvisorCohortStat"("kind", "cohortKey", "discountBand");
CREATE INDEX IF NOT EXISTS "AdvisorRecommendation_companyId_subjectId_idx" ON "AdvisorRecommendation"("companyId", "subjectId");
CREATE INDEX IF NOT EXISTS "AdvisorRecommendation_companyId_kind_idx" ON "AdvisorRecommendation"("companyId", "kind");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdvisorRecommendation_companyId_fkey'
  ) THEN
    ALTER TABLE "AdvisorRecommendation"
      ADD CONSTRAINT "AdvisorRecommendation_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
