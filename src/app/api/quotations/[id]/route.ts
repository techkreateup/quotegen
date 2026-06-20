import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, quotationUpdateSchema } from "@/lib/schemas";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: true },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...quotation,
    clientName: quotation.client.businessName,
    quotationDate: quotation.quotationDate.toISOString().split("T")[0],
    dueDate: quotation.dueDate?.toISOString().split("T")[0] || "",
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(quotationUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    const { items, clientName, client, ...quotationData } = data;

    delete quotationData.id;
    delete quotationData.createdAt;
    if (quotationData.quotationDate) quotationData.quotationDate = new Date(quotationData.quotationDate);
    if (quotationData.dueDate) quotationData.dueDate = new Date(quotationData.dueDate);
    else quotationData.dueDate = null;

    // Delete old items and recreate
    await prisma.quotationLineItem.deleteMany({ where: { quotationId: id } });

    const quotation = await prisma.quotation.update({
      where: { id },
      data: {
        ...quotationData,
        items: { create: sanitizeLineItems(items) },
      },
      include: { items: true },
    });
    return NextResponse.json(quotation);
  } catch (err: unknown) {
    console.error("PUT /api/quotations/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Clean up related entity data
    await prisma.entityActivity.deleteMany({ where: { entityType: "Quotation", entityId: id } }).catch(() => {});
    await prisma.entityNote.deleteMany({ where: { entityType: "Quotation", entityId: id } }).catch(() => {});
    await prisma.quotationLineItem.deleteMany({ where: { quotationId: id } });
    await prisma.quotation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/quotations/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
