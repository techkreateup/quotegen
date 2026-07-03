import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, deliveryChallanUpdateSchema } from "@/lib/schemas";
import { buildLineage } from "@/lib/lineage";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dc = await prisma.deliveryChallan.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: true },
  });
  if (!dc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...dc,
    clientName: dc.client.businessName,
    challanDate: dc.challanDate.toISOString().split("T")[0],
    related: await buildLineage("deliveryChallan", id),
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(deliveryChallanUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    const { items, clientName, client, ...dcData } = data;

    delete dcData.id;
    delete dcData.createdAt;
    if (dcData.challanDate) dcData.challanDate = new Date(dcData.challanDate);

    if (items !== undefined) {
      await prisma.deliveryChallanLineItem.deleteMany({ where: { deliveryChallanId: id } });
    }

    const dc = await prisma.deliveryChallan.update({
      where: { id },
      data: { ...dcData, ...(items !== undefined ? { items: { create: sanitizeLineItems(items) } } : {}) },
      include: { items: true },
    });
    return NextResponse.json(dc);
  } catch (err: unknown) {
    console.error("PUT /api/delivery-challans/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That challan number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    await prisma.deliveryChallan.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/delivery-challans/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That challan number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
