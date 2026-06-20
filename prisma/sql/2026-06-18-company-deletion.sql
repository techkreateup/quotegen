-- Sprint 2.3 — DPDP soft-delete marker on Company.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);
