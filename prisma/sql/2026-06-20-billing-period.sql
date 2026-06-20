-- Sprint 5.1 — mid-cycle upgrade proration: track the current paid billing window
-- AlterTable
ALTER TABLE "Company" ADD COLUMN "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
