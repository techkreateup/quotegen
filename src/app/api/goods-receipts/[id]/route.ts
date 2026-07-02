import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, goodsReceiptUpdateSchema } from "@/lib/schemas";
import { buildLineage } from "@/lib/lineage";

function grnItems(items: unknown): Record<string, unknown>[] {
  return sanitizeLineItems(items).map((it, i) => {
    const raw = (Array.isArray(items) ? items[i] : {}) as Record<string, unknown>;
    return { ...it, orderedQty: raw.orderedQty != null ? raw.orderedQty : it.quantity, rejectedQty: raw.rejectedQty != null ? raw.rejectedQty : 0 };
  });
}

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const grn = await prisma.goodsReceiptNote.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, vendor: true },
  });
  if (!grn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...grn,
    vendorName: grn.vendor.name,
    receiptDate: grn.receiptDate.toISOString().split("T")[0],
    related: await buildLineage("goodsReceiptNote", id),
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(goodsReceiptUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    const { items, vendorName, vendor, ...grnData } = data;

    delete grnData.id;
    delete grnData.createdAt;
    if (grnData.receiptDate) grnData.receiptDate = new Date(grnData.receiptDate);

    if (items !== undefined) {
      await prisma.gRNLineItem.deleteMany({ where: { goodsReceiptNoteId: id } });
    }
    const grn = await prisma.goodsReceiptNote.update({
      where: { id },
      data: { ...grnData, ...(items !== undefined ? { items: { create: grnItems(items) } } : {}) },
      include: { items: true },
    });
    return NextResponse.json(grn);
  } catch (err: unknown) {
    console.error("PUT /api/goods-receipts/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    await prisma.goodsReceiptNote.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/goods-receipts/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
