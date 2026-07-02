import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { computeTds } from "@/lib/tds";

// Batch payment run (Track A A5 completion). Accepts an array of
// { vendorId, grossAmount, paidDate, paymentMethod, description, tdsSection,
//   tdsRate } entries and records each one as its own VendorPayment +
// Transaction row within a single transaction so the whole run succeeds
// or rolls back atomically. Returns the list of created payment ids so
// the caller can jump straight to the batch remittance if it wants to.

interface PayRunEntry {
  vendorId: string;
  grossAmount: number;
  paidDate?: string;
  paymentMethod?: string;
  description?: string;
  tdsSection?: string;
  tdsRate?: number;
}

async function POST_handler(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { entries?: PayRunEntry[] };
  const entries = Array.isArray(body.entries) ? body.entries.filter(e => e && e.vendorId && e.grossAmount > 0) : [];
  if (entries.length === 0) return NextResponse.json({ error: "No payments in the run" }, { status: 400 });

  const companyId = requireCompanyId();
  const created: { id: string; vendorId: string; amount: number; tdsAmount: number }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const e of entries) {
      const vendor = await tx.vendor.findFirst({ where: { id: e.vendorId }, select: { name: true, tdsSection: true, tdsRate: true } });
      if (!vendor) throw new Error(`Vendor ${e.vendorId} not found`);
      const gross = Number(e.grossAmount);
      const section = e.tdsSection ?? vendor.tdsSection ?? "";
      const rate = e.tdsRate !== undefined ? Number(e.tdsRate) : (vendor.tdsRate || 0);
      const { tds, net } = computeTds(gross, rate);
      const paidDate = e.paidDate ? new Date(e.paidDate) : new Date();

      const payment = await tx.vendorPayment.create({
        data: {
          companyId,
          vendorId: e.vendorId,
          amount: net,
          grossAmount: gross,
          tdsSection: section,
          tdsRate: rate,
          tdsAmount: tds,
          paidDate,
          description: e.description || "Batch payment run",
          paymentMethod: e.paymentMethod || "Bank Transfer",
          notes: "",
        },
      });
      await tx.transaction.create({
        data: {
          companyId,
          date: paidDate,
          type: "VendorPayment",
          category: "Vendor Payment",
          description: `Payment to ${vendor.name}${tds > 0 ? ` (net of ${section || "TDS"} ₹${tds})` : ""}`,
          amount: net,
          direction: "OUT",
          referenceType: "vendor",
          referenceId: e.vendorId,
          vendorPaymentId: payment.id,
        },
      });
      created.push({ id: payment.id, vendorId: e.vendorId, amount: net, tdsAmount: tds });
    }
  });

  return NextResponse.json({ ok: true, created, count: created.length });
}

export const POST = withApi(POST_handler);
