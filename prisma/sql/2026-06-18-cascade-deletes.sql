-- Sprint 1.5 — ON DELETE CASCADE for client/invoice relations.
-- Drops the existing FK (default NO ACTION) and re-adds it with CASCADE.
-- Constraint names follow Prisma's "<Model>_<field>_fkey" convention.

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_clientId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Quotation" DROP CONSTRAINT IF EXISTS "Quotation_clientId_fkey";
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_clientId_fkey";
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_invoiceId_fkey";
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditNote" DROP CONSTRAINT IF EXISTS "CreditNote_clientId_fkey";
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_clientId_fkey";
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringInvoice" DROP CONSTRAINT IF EXISTS "RecurringInvoice_clientId_fkey";
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
