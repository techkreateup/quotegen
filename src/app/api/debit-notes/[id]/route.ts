import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, debitNoteUpdateSchema } from "@/lib/schemas";
import { buildLineage } from "@/lib/lineage";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dn = await prisma.debitNote.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, vendor: true },
  });
  if (!dn) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...dn,
    vendorName: dn.vendor.name,
    debitNoteDate: dn.debitNoteDate.toISOString().split("T")[0],
    related: await buildLineage("debitNote", id),
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(debitNoteUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    const { items, vendorName, vendor, ...dnData } = data;

    delete dnData.id;
    delete dnData.createdAt;
    if (dnData.debitNoteDate) dnData.debitNoteDate = new Date(dnData.debitNoteDate);

    if (items !== undefined) {
      await prisma.debitNoteLineItem.deleteMany({ where: { debitNoteId: id } });
    }
    const dn = await prisma.debitNote.update({
      where: { id },
      data: { ...dnData, ...(items !== undefined ? { items: { create: sanitizeLineItems(items) } } : {}) },
      include: { items: true },
    });
    return NextResponse.json(dn);
  } catch (err: unknown) {
    console.error("PUT /api/debit-notes/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That debit note number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    await prisma.debitNote.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/debit-notes/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That debit note number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
