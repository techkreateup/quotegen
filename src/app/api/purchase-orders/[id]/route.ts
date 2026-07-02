import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, purchaseOrderUpdateSchema } from "@/lib/schemas";
import { buildLineage } from "@/lib/lineage";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, vendor: true },
  });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...po,
    vendorName: po.vendor.name,
    orderDate: po.orderDate.toISOString().split("T")[0],
    expectedDate: po.expectedDate?.toISOString().split("T")[0] || "",
    related: await buildLineage("purchaseOrder", id),
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(purchaseOrderUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    const { items, vendorName, vendor, ...poData } = data;

    delete poData.id;
    delete poData.createdAt;
    if (poData.orderDate) poData.orderDate = new Date(poData.orderDate);
    if (poData.expectedDate) poData.expectedDate = new Date(poData.expectedDate); else poData.expectedDate = null;

    if (items !== undefined) {
      await prisma.purchaseOrderLineItem.deleteMany({ where: { purchaseOrderId: id } });
    }

    const po = await prisma.purchaseOrder.update({
      where: { id },
      data: { ...poData, ...(items !== undefined ? { items: { create: sanitizeLineItems(items) } } : {}) },
      include: { items: true },
    });
    return NextResponse.json(po);
  } catch (err: unknown) {
    console.error("PUT /api/purchase-orders/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    await prisma.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/purchase-orders/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
