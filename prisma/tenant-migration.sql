BEGIN;

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'COMPANY_ADMIN', 'COMPANY_USER');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- DropIndex
DROP INDEX "CreditNote_creditNoteNo_key";

-- DropIndex
DROP INDEX "Employee_email_key";

-- DropIndex
DROP INDEX "Employee_employeeCode_key";

-- DropIndex
DROP INDEX "GstFiling_month_year_returnType_key";

-- DropIndex
DROP INDEX "Invoice_invoiceNo_key";

-- DropIndex
DROP INDEX "PaymentReceipt_receiptNo_key";

-- DropIndex
DROP INDEX "PaymentVoucher_voucherNo_key";

-- DropIndex
DROP INDEX "Quotation_quotationNo_key";

-- DropIndex
DROP INDEX "UserRole_name_key";

-- DropIndex
DROP INDEX "Workflow_module_trigger_key";

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy',
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "EntityActivity" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "EntityNote" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "GstChallan" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "GstFiling" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "InvoiceReminder" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "PaymentReceipt" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "PaymentVoucher" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "ProjectTask" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "PurchaseBill" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "RecurringInvoice" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "SalaryRecord" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "SubscriptionPayment" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'COMPANY_USER';

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "VendorPayment" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- AlterTable
ALTER TABLE "WorkflowInstance" ADD COLUMN     "companyId" TEXT NOT NULL DEFAULT 'cmp_legacy';

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueComment" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '{}',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "skippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Issue_companyId_idx" ON "Issue"("companyId");

-- CreateIndex
CREATE INDEX "Issue_status_priority_idx" ON "Issue"("status", "priority");

-- CreateIndex
CREATE INDEX "Issue_assigneeId_idx" ON "Issue"("assigneeId");

-- CreateIndex
CREATE INDEX "IssueComment_issueId_idx" ON "IssueComment"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_companyId_key" ON "OnboardingProgress"("companyId");

-- CreateIndex
CREATE INDEX "UsageEvent_companyId_event_createdAt_idx" ON "UsageEvent"("companyId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_event_createdAt_idx" ON "UsageEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_companyId_idx" ON "ActivityLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "CatalogItem_companyId_idx" ON "CatalogItem"("companyId");

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE INDEX "CreditNote_companyId_idx" ON "CreditNote"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_companyId_creditNoteNo_key" ON "CreditNote"("companyId", "creditNoteNo");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_employeeCode_key" ON "Employee"("companyId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_email_key" ON "Employee"("companyId", "email");

-- CreateIndex
CREATE INDEX "EntityActivity_companyId_idx" ON "EntityActivity"("companyId");

-- CreateIndex
CREATE INDEX "EntityNote_companyId_idx" ON "EntityNote"("companyId");

-- CreateIndex
CREATE INDEX "GstChallan_companyId_idx" ON "GstChallan"("companyId");

-- CreateIndex
CREATE INDEX "GstFiling_companyId_idx" ON "GstFiling"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "GstFiling_companyId_month_year_returnType_key" ON "GstFiling"("companyId", "month", "year", "returnType");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNo_key" ON "Invoice"("companyId", "invoiceNo");

-- CreateIndex
CREATE INDEX "InvoiceReminder_companyId_idx" ON "InvoiceReminder"("companyId");

-- CreateIndex
CREATE INDEX "PaymentReceipt_companyId_idx" ON "PaymentReceipt"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_companyId_receiptNo_key" ON "PaymentReceipt"("companyId", "receiptNo");

-- CreateIndex
CREATE INDEX "PaymentVoucher_companyId_idx" ON "PaymentVoucher"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentVoucher_companyId_voucherNo_key" ON "PaymentVoucher"("companyId", "voucherNo");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "ProjectTask_companyId_idx" ON "ProjectTask"("companyId");

-- CreateIndex
CREATE INDEX "PurchaseBill_companyId_idx" ON "PurchaseBill"("companyId");

-- CreateIndex
CREATE INDEX "Quotation_companyId_idx" ON "Quotation"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_companyId_quotationNo_key" ON "Quotation"("companyId", "quotationNo");

-- CreateIndex
CREATE INDEX "RecurringInvoice_companyId_idx" ON "RecurringInvoice"("companyId");

-- CreateIndex
CREATE INDEX "SalaryRecord_companyId_idx" ON "SalaryRecord"("companyId");

-- CreateIndex
CREATE INDEX "Subscription_companyId_idx" ON "Subscription"("companyId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_companyId_idx" ON "SubscriptionPayment"("companyId");

-- CreateIndex
CREATE INDEX "Transaction_companyId_idx" ON "Transaction"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "UserRole_companyId_idx" ON "UserRole"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_companyId_name_key" ON "UserRole"("companyId", "name");

-- CreateIndex
CREATE INDEX "Vendor_companyId_idx" ON "Vendor"("companyId");

-- CreateIndex
CREATE INDEX "VendorPayment_companyId_idx" ON "VendorPayment"("companyId");

-- CreateIndex
CREATE INDEX "Workflow_companyId_idx" ON "Workflow"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_companyId_module_trigger_key" ON "Workflow"("companyId", "module", "trigger");

-- CreateIndex
CREATE INDEX "WorkflowInstance_companyId_idx" ON "WorkflowInstance"("companyId");

-- ─── BACKFILL: existing data becomes the legacy company ─────────────────────
INSERT INTO "Company" ("id", "name", "slug", "isActive", "onboardingCompletedAt", "createdAt", "updatedAt")
SELECT 'cmp_legacy', COALESCE(NULLIF(cs."businessName", ''), 'Legacy Company'), 'legacy', true, NOW(), NOW(), NOW()
FROM "CompanySettings" cs
LIMIT 1;

-- Fallback if CompanySettings row is missing
INSERT INTO "Company" ("id", "name", "slug", "isActive", "onboardingCompletedAt", "createdAt", "updatedAt")
SELECT 'cmp_legacy', 'Legacy Company', 'legacy', true, NOW(), NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Company" WHERE "id" = 'cmp_legacy');

-- All existing users belong to the legacy company
UPDATE "User" SET "companyId" = 'cmp_legacy';
UPDATE "User" SET "platformRole" = 'COMPANY_ADMIN'
WHERE "roleId" IN (SELECT "id" FROM "UserRole" WHERE "name" = 'Admin');

-- Existing audit logs belong to the legacy company
UPDATE "AuditLog" SET "companyId" = 'cmp_legacy';

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueComment" ADD CONSTRAINT "IssueComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVoucher" ADD CONSTRAINT "PaymentVoucher_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstFiling" ADD CONSTRAINT "GstFiling_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GstChallan" ADD CONSTRAINT "GstChallan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityActivity" ADD CONSTRAINT "EntityActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityNote" ADD CONSTRAINT "EntityNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceReminder" ADD CONSTRAINT "InvoiceReminder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── DROP TEMPORARY DEFAULTS (companyId must be set explicitly from now on) ──
ALTER TABLE "ActivityLog" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "CatalogItem" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "CompanySettings" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "CreditNote" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "EntityActivity" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "EntityNote" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "GstChallan" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "GstFiling" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "InvoiceReminder" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "PaymentReceipt" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "PaymentVoucher" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "ProjectTask" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "PurchaseBill" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Quotation" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "RecurringInvoice" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "SalaryRecord" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "SubscriptionPayment" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Transaction" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "UserRole" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Vendor" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "VendorPayment" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "Workflow" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "WorkflowInstance" ALTER COLUMN "companyId" DROP DEFAULT;

COMMIT;
