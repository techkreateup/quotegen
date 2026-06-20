import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function POST_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Delete all payment receipts for this invoice
    await prisma.paymentReceipt.deleteMany({ where: { invoiceId: id } });

    // Delete all transactions linked to this invoice
    await prisma.transaction.deleteMany({ where: { invoiceId: id } });

    // Revert invoice status
    await prisma.invoice.update({
      where: { id },
      data: { status: "Unpaid", paymentDate: null },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("POST /api/invoices/[id]/revert-payment error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler);
