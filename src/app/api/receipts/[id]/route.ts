import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await prisma.paymentReceipt.findUnique({
    where: { id },
    include: { client: true, invoice: true },
  });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...receipt,
    clientName: receipt.client?.businessName || "",
    invoiceNo: receipt.invoice?.invoiceNo || "",
    receiptDate: receipt.receiptDate.toISOString().split("T")[0],
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();

    const receipt = await prisma.paymentReceipt.update({
      where: { id },
      data: {
        receiptDate: data.receiptDate ? new Date(data.receiptDate) : undefined,
        invoiceId: data.invoiceId || undefined,
        clientId: data.clientId || undefined,
        amount: data.amount !== undefined ? Number(data.amount) : undefined,
        paymentMethod: data.paymentMethod || undefined,
        referenceNo: data.referenceNo ?? undefined,
        notes: data.notes ?? undefined,
        status: data.status || undefined,
      },
    });
    return NextResponse.json(receipt);
  } catch (err: unknown) {
    console.error("PUT /api/receipts/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    await prisma.paymentReceipt.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/receipts/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
