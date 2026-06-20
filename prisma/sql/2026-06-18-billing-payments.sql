-- Sprint 1.1 — Razorpay SaaS billing payments
-- Records a company paying US for the platform subscription.

DO $$ BEGIN
  CREATE TYPE "BillingPaymentStatus" AS ENUM ('CREATED', 'CAPTURED', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "BillingPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "planName" TEXT,
    "notes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingPayment_razorpayOrderId_key" ON "BillingPayment"("razorpayOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPayment_razorpayPaymentId_key" ON "BillingPayment"("razorpayPaymentId");
CREATE INDEX IF NOT EXISTS "idx_billingpayment_company" ON "BillingPayment"("companyId");
CREATE INDEX IF NOT EXISTS "idx_billingpayment_status" ON "BillingPayment"("status");

DO $$ BEGIN
  ALTER TABLE "BillingPayment"
    ADD CONSTRAINT "BillingPayment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
