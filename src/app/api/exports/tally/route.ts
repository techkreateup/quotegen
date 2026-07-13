import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { tallyEnvelope, type TallyVoucherIn } from "@/lib/tally";
import { logAudit } from "@/lib/audit";

// GET /api/exports/tally?from=YYYY-MM-DD&to=YYYY-MM-DD
// → Tally-importable Vouchers XML: Sales (invoices), Purchase (vendor bills),
//   Receipt (payment receipts), Payment (vendor payments).
async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const from = new Date(sp.get("from") ?? "");
    const to = new Date(sp.get("to") ?? "");
    if (isNaN(+from) || isNaN(+to)) {
      return NextResponse.json({ error: "from and to dates (YYYY-MM-DD) are required" }, { status: 400 });
    }
    to.setHours(23, 59, 59, 999);
    const companyId = requireCompanyId();

    const [settings, invoices, bills, receipts, payments] = await Promise.all([
      prisma.companySettings.findUnique({ where: { companyId }, select: { businessName: true } }),
      prisma.invoice.findMany({
        where: { deletedAt: null, invoiceDate: { gte: from, lte: to } },
        select: { invoiceNo: true, invoiceDate: true, subtotal: true, totalCgst: true, totalSgst: true, totalIgst: true, totalAmount: true, client: { select: { businessName: true } } },
      }),
      prisma.purchaseBill.findMany({
        where: { deletedAt: null, billDate: { gte: from, lte: to } },
        select: { billNo: true, billDate: true, subtotal: true, totalCgst: true, totalSgst: true, totalIgst: true, totalAmount: true, vendor: { select: { name: true } } },
      }),
      prisma.paymentReceipt.findMany({
        where: { deletedAt: null, status: "Settled", receiptDate: { gte: from, lte: to } },
        select: { receiptNo: true, receiptDate: true, amount: true, paymentMethod: true, client: { select: { businessName: true } } },
      }),
      prisma.vendorPayment.findMany({
        where: { paidDate: { gte: from, lte: to } },
        select: { id: true, paidDate: true, amount: true, description: true, vendor: { select: { name: true } } },
      }),
    ]);

    const vouchers: TallyVoucherIn[] = [
      ...invoices.map((i): TallyVoucherIn => ({
        kind: "Sales", date: i.invoiceDate, number: i.invoiceNo, party: i.client.businessName,
        subtotal: i.subtotal, cgst: i.totalCgst, sgst: i.totalSgst, igst: i.totalIgst, total: i.totalAmount,
      })),
      ...bills.map((b): TallyVoucherIn => ({
        kind: "Purchase", date: b.billDate, number: b.billNo, party: b.vendor.name,
        subtotal: b.subtotal, cgst: b.totalCgst, sgst: b.totalSgst, igst: b.totalIgst, total: b.totalAmount,
      })),
      ...receipts.map((r): TallyVoucherIn => ({
        kind: "Receipt", date: r.receiptDate, number: r.receiptNo, party: r.client.businessName,
        narration: r.paymentMethod, subtotal: Number(r.amount), cgst: 0, sgst: 0, igst: 0, total: Number(r.amount),
      })),
      ...payments.map((p): TallyVoucherIn => ({
        kind: "Payment", date: p.paidDate, number: p.id.slice(-8).toUpperCase(), party: p.vendor.name,
        narration: p.description, subtotal: p.amount, cgst: 0, sgst: 0, igst: 0, total: p.amount,
      })),
    ];

    const xml = tallyEnvelope(vouchers, settings?.businessName ?? "");
    const userId = request.headers.get("x-user-id") || "system";
    logAudit({ userId, entity: "Export", entityId: "tally", action: "EXPORT", after: { from: sp.get("from"), to: sp.get("to"), vouchers: vouchers.length } });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="tally-vouchers-${sp.get("from")}-to-${sp.get("to")}.xml"`,
      },
    });
  } catch (err) {
    console.error("GET /api/exports/tally error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
