-- Sprint 2.5 — GST invoices for subscription charges.
CREATE TABLE IF NOT EXISTS "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "billingPaymentId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerGstin" TEXT NOT NULL DEFAULT '',
    "placeOfSupply" TEXT NOT NULL DEFAULT '',
    "sacCode" TEXT NOT NULL DEFAULT '9983',
    "taxableValue" DOUBLE PRECISION NOT NULL,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvoice_billingPaymentId_key" ON "SubscriptionInvoice"("billingPaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "idx_subinvoice_company" ON "SubscriptionInvoice"("companyId");
DO $$ BEGIN
  ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
