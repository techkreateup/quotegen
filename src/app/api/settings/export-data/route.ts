import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

// GET /api/settings/export-data
// DPDP-compliant full export of the company's data as a JSON download.
// Uses the tenant-scoped client, so every query returns only this company's rows.
// Admin-only: this dumps payroll + financials, so the coarse `settings:view`
// permission is not sufficient — require the in-tenant system admin.
async function GET_handler(request: NextRequest) {
  if (request.headers.get("x-user-system-admin") !== "true") {
    return NextResponse.json(
      { error: "Only a company administrator can export company data." },
      { status: 403 }
    );
  }
  const companyId = requireCompanyId();

  const [
    company, settings, clients, quotations, invoices, receipts, creditNotes,
    employees, salaryRecords, vouchers, vendors, vendorPayments, projects,
    transactions, recurringInvoices, catalogItems,
  ] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.companySettings.findFirst(),
    prisma.client.findMany(),
    prisma.quotation.findMany({ include: { items: true } }),
    prisma.invoice.findMany({ include: { items: true } }),
    prisma.paymentReceipt.findMany(),
    prisma.creditNote.findMany({ include: { items: true } }),
    prisma.employee.findMany(),
    prisma.salaryRecord.findMany(),
    prisma.paymentVoucher.findMany(),
    prisma.vendor.findMany(),
    prisma.vendorPayment.findMany(),
    prisma.project.findMany({ include: { tasks: true } }),
    prisma.transaction.findMany(),
    prisma.recurringInvoice.findMany(),
    prisma.catalogItem.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    company,
    settings,
    clients,
    quotations,
    invoices,
    receipts,
    creditNotes,
    employees,
    salaryRecords,
    vouchers,
    vendors,
    vendorPayments,
    projects,
    transactions,
    recurringInvoices,
    catalogItems,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="quotegen-export-${companyId}-${Date.now()}.json"`,
    },
  });
}

export const GET = withApi(GET_handler);
