import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { autoCreateReceipt } from "@/lib/receipt-helper";

async function POST_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const paymentMethod = body.paymentMethod || "Bank Transfer";

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Update invoice status
    await prisma.invoice.update({
      where: { id },
      data: { status: "Paid", paymentDate: new Date() },
    });

    const receipt = await autoCreateReceipt(id, paymentMethod);
    return NextResponse.json(receipt);
  } catch (err: unknown) {
    console.error("POST /api/invoices/[id]/mark-paid error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler);
