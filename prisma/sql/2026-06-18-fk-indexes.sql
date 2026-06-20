-- Sprint 1.4 — Foreign-key indexes on hot relations.
-- Plain CREATE INDEX (not CONCURRENTLY) is fine pre-launch and avoids the
-- "CONCURRENTLY cannot run inside a transaction" pitfall with db execute.
-- Safe to re-run: every statement uses IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS "idx_invoice_client" ON "Invoice"("clientId");
CREATE INDEX IF NOT EXISTS "idx_quotation_client" ON "Quotation"("clientId");
CREATE INDEX IF NOT EXISTS "idx_receipt_client" ON "PaymentReceipt"("clientId");
CREATE INDEX IF NOT EXISTS "idx_receipt_invoice" ON "PaymentReceipt"("invoiceId");
CREATE INDEX IF NOT EXISTS "idx_creditnote_client" ON "CreditNote"("clientId");
CREATE INDEX IF NOT EXISTS "idx_project_client" ON "Project"("clientId");
CREATE INDEX IF NOT EXISTS "idx_recurring_client" ON "RecurringInvoice"("clientId");
CREATE INDEX IF NOT EXISTS "idx_salary_employee" ON "SalaryRecord"("employeeId");
CREATE INDEX IF NOT EXISTS "idx_voucher_employee" ON "PaymentVoucher"("employeeId");
CREATE INDEX IF NOT EXISTS "idx_invoice_quotation" ON "Invoice"("quotationId");
