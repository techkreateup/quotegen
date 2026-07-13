import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parseBankCsv, reconcile, type OpenDoc } from "@/lib/bank-recon";

// POST { csv } → parsed bank rows + match suggestions against open invoices
// (credits) and unpaid vendor bills (debits). Read-only: confirming a match is
// done client-side through the existing receipt / payment endpoints.
async function POST_handler(request: NextRequest) {
  try {
    const { csv } = await request.json();
    if (typeof csv !== "string" || !csv.trim()) {
      return NextResponse.json({ error: "csv text is required" }, { status: 400 });
    }
    if (csv.length > 2_000_000) {
      return NextResponse.json({ error: "File too large (2 MB max)" }, { status: 413 });
    }
    const rows = parseBankCsv(csv);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Could not find a header row with Date + Description/Narration columns" }, { status: 422 });
    }

    const [invoices, bills, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { deletedAt: null, status: { in: ["Unpaid", "PartiallyPaid", "Overdue"] } },
        select: { id: true, invoiceNo: true, totalAmount: true, clientId: true, client: { select: { businessName: true } }, receipts: { where: { deletedAt: null, status: "Settled" }, select: { amount: true } } },
      }),
      prisma.purchaseBill.findMany({
        where: { deletedAt: null, status: { not: "Paid" } },
        select: { id: true, billNo: true, totalAmount: true, vendorId: true, vendor: { select: { name: true } } },
      }),
      prisma.vendorPayment.findMany({ select: { amount: true, description: true } }),
    ]);
    void payments;

    const openInvoices: OpenDoc[] = invoices
      .map((i) => ({
        id: i.id, number: i.invoiceNo, party: i.client.businessName, partyId: i.clientId,
        outstanding: Math.round((i.totalAmount - i.receipts.reduce((s, r) => s + Number(r.amount), 0)) * 100) / 100,
      }))
      .filter((d) => d.outstanding > 0);
    const openBills: OpenDoc[] = bills.map((b) => ({
      id: b.id, number: b.billNo, party: b.vendor.name, partyId: b.vendorId, outstanding: b.totalAmount,
    }));

    return NextResponse.json({ suggestions: reconcile(rows, openInvoices, openBills), openInvoices: openInvoices.length, openBills: openBills.length });
  } catch (err) {
    console.error("POST /api/cash/bank-recon error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler, { requireVerified: true });
