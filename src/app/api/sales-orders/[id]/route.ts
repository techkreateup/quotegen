import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, salesOrderUpdateSchema } from "@/lib/schemas";
import { buildLineage } from "@/lib/lineage";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const so = await prisma.salesOrder.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: true },
  });
  if (!so) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...so,
    clientName: so.client.businessName,
    orderDate: so.orderDate.toISOString().split("T")[0],
    dueDate: so.dueDate?.toISOString().split("T")[0] || "",
    clientPoDate: so.clientPoDate?.toISOString().split("T")[0] || "",
    related: await buildLineage("salesOrder", id),
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(salesOrderUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    const { items, clientName, client, ...soData } = data;

    delete soData.id;
    delete soData.createdAt;
    if (soData.orderDate) soData.orderDate = new Date(soData.orderDate);
    if (soData.dueDate) soData.dueDate = new Date(soData.dueDate); else soData.dueDate = null;
    if (soData.clientPoDate) soData.clientPoDate = new Date(soData.clientPoDate); else soData.clientPoDate = null;

    if (items !== undefined) {
      await prisma.salesOrderLineItem.deleteMany({ where: { salesOrderId: id } });
    }

    const so = await prisma.salesOrder.update({
      where: { id },
      data: { ...soData, ...(items !== undefined ? { items: { create: sanitizeLineItems(items) } } : {}) },
      include: { items: true },
    });
    return NextResponse.json(so);
  } catch (err: unknown) {
    console.error("PUT /api/sales-orders/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That sales order number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    await prisma.salesOrder.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/sales-orders/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That sales order number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
