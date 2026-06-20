-- Performance indexes for admin / multi-tenant queries.
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- Apply with:
--   npx prisma db execute --file prisma/sql/2026-06-17-indexes.sql --schema prisma/schema.prisma
--
-- NOTE: Prisma already generates single-column companyId indexes for the
-- tenant tables via `@@index([companyId])` (named like "User_companyId_idx",
-- "Invoice_companyId_idx", "Quotation_companyId_idx", "PaymentReceipt_companyId_idx").
-- The requested idx_user_company / idx_invoice_company are therefore redundant
-- and intentionally omitted to avoid duplicate indexes on the same column.
-- The statements below add only indexes that are NOT already covered.

-- AuditLog: the viewer and the retention-cleanup cron both filter by company
-- and order by createdAt. A composite (companyId, createdAt) serves the
-- per-company timeline and, via leftmost prefix, plain companyId lookups too.
CREATE INDEX IF NOT EXISTS "idx_audit_company" ON "AuditLog" ("companyId", "createdAt");

-- Company list filters in the super-admin console (Companies page + exports).
CREATE INDEX IF NOT EXISTS "idx_company_plan" ON "Company" ("plan");
CREATE INDEX IF NOT EXISTS "idx_company_active" ON "Company" ("isActive");
