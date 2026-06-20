-- Sprint 7.1 — admin-editable plan pricing
-- AlterTable
ALTER TABLE "PlanDefinition" ADD COLUMN     "billingPeriod" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN     "priceInPaise" INTEGER NOT NULL DEFAULT 0;

-- Seed default prices (paise). Free=0, Starter=49900, Professional=99900, Enterprise=249900.
-- Only updates rows that exist; missing plans fall back to features.ts defaults.
UPDATE "PlanDefinition" SET "priceInPaise" = 0      WHERE "name" = 'Free';
UPDATE "PlanDefinition" SET "priceInPaise" = 49900  WHERE "name" = 'Starter';
UPDATE "PlanDefinition" SET "priceInPaise" = 99900  WHERE "name" = 'Professional';
UPDATE "PlanDefinition" SET "priceInPaise" = 249900 WHERE "name" = 'Enterprise';
