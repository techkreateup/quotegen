import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";

async function GET_handler() {
  try {
    const receipts = await prisma.paymentReceipt.findMany({
      include: { client: true, invoice: true },
      orderBy: { createdAt: "desc" },
    });
    const result = receipts.map((r) => ({
      ...r,
      clientName: r.client?.businessName || "",
      invoiceNo: r.invoice?.invoiceNo || "",
      receiptDate: r.receiptDate.toISOString().split("T")[0],
    }));
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("GET /api/receipts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.invoiceId) return NextResponse.json({ error: "Invoice is required" }, { status: 400 });
    if (!data.clientId) return NextResponse.json({ error: "Client is required" }, { status: 400 });
    if (!data.receiptDate) return NextResponse.json({ error: "Receipt date is required" }, { status: 400 });

    const companyId = requireCompanyId();
    const receipt = await prisma.$transaction(async (tx) => {
      const { formatted: receiptNo } = await nextDocNumber(tx, "nextReceiptNo");
      return tx.paymentReceipt.create({
        data: {
          companyId,
          receiptNo,
          receiptDate: new Date(data.receiptDate),
          invoiceId: data.invoiceId,
          clientId: data.clientId,
          amount: Number(data.amount) || 0,
          paymentMethod: data.paymentMethod || "Bank Transfer",
          referenceNo: data.referenceNo || "",
          notes: data.notes || "",
          status: data.status || "Settled",
        },
      });
    });
    return NextResponse.json(receipt, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/receipts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
