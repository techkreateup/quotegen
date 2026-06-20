-- Sprint 7.3 — admin-editable free-trial duration
-- AlterTable
ALTER TABLE "PlanDefinition" ADD COLUMN "trialDurationDays" INTEGER NOT NULL DEFAULT 90;
