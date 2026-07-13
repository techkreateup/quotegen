import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { hasCompanyFeature } from "@/lib/feature-gate";

async function GET_handler() {
  const companyId = requireCompanyId();
  let settings = await prisma.companySettings.findUnique({ where: { companyId } });
  if (!settings) {
    settings = await prisma.companySettings.create({ data: { companyId } });
  }
  const hasWhiteLabel = await hasCompanyFeature(companyId, "white-label");
  return NextResponse.json({ ...settings, hasWhiteLabel });
}

// Whitelist of editable CompanySettings columns. The client form carries extra
// keys (gstEnabled, updatedAt, id, companyId) that are NOT columns — spreading
// the raw body into Prisma throws a validation error ("Unknown argument …"),
// which surfaced as "Failed to save settings". We only persist known columns.
const STRING_FIELDS = [
  "businessName", "address", "city", "state", "country", "pincode", "gstin", "pan",
  "email", "bankName", "accountName", "accountNumber", "ifsc", "accountType", "logoUrl",
  "themeColor", "contactFooter", "documentFooter", "website",
  "quotationPrefix", "invoicePrefix", "receiptPrefix", "voucherPrefix", "creditNotePrefix",
  "proformaPrefix", "salesOrderPrefix", "challanPrefix", "poPrefix", "grnPrefix",
  "debitNotePrefix", "nonGstInvoicePrefix",
  "checkedByName", "checkedBySig", "checkedByRole",
  "approvedByName", "approvedBySig", "approvedByRole",
  "paidByName", "paidBySig", "paidByRole",
  "defaultCurrency",
] as const;
const INT_FIELDS = [
  "nextQuotationNo", "nextInvoiceNo", "nextReceiptNo", "nextVoucherNo",
  "nextEmployeeNo", "nextCreditNoteNo", "fiscalYearStart",
  "nextProformaNo", "nextSalesOrderNo", "nextChallanNo", "nextPoNo", "nextGrnNo",
  "nextDebitNoteNo", "nextNonGstInvoiceNo",
] as const;
const FLOAT_FIELDS = ["matchTolerancePct"] as const;
const ARRAY_FIELDS = ["phones"] as const;
const BOOL_FIELDS = ["gstEnabled", "separateGstInvoices"] as const;
// Feature-gated boolean columns — only writable if the plan grants them.
const GATED_BOOL_FIELDS: Record<string, string> = {
  hideDefaultBrand: "white-label",
};

async function PUT_handler(request: NextRequest) {
  const companyId = requireCompanyId();
  const body = await request.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  for (const f of STRING_FIELDS) {
    if (f in body && body[f] != null) data[f] = String(body[f]);
  }
  for (const f of INT_FIELDS) {
    if (f in body && body[f] != null && body[f] !== "") {
      const n = Number(body[f]);
      if (Number.isFinite(n)) data[f] = Math.trunc(n);
    }
  }
  for (const f of FLOAT_FIELDS) {
    if (f in body && body[f] != null && body[f] !== "") {
      const n = Number(body[f]);
      if (Number.isFinite(n)) data[f] = n;
    }
  }
  for (const f of ARRAY_FIELDS) {
    if (Array.isArray(body[f])) data[f] = body[f].map((v: unknown) => String(v));
  }
  for (const f of BOOL_FIELDS) {
    if (typeof body[f] === "boolean") data[f] = body[f];
  }
  for (const [field, featureKey] of Object.entries(GATED_BOOL_FIELDS)) {
    if (typeof body[field] === "boolean") {
      const allowed = await hasCompanyFeature(companyId, featureKey);
      // If plan doesn't grant this feature, silently force it off — never let
      // client-facing branding disappear on non-white-label plans.
      data[field] = allowed ? body[field] : false;
    }
  }

  const settings = await prisma.companySettings.upsert({
    where: { companyId },
    update: data,
    create: { companyId, ...data },
  });
  return NextResponse.json(settings);
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
