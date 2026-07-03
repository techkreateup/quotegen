import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, creditNoteUpdateSchema } from "@/lib/schemas";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creditNote = await prisma.creditNote.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, client: true, invoice: true },
  });
  if (!creditNote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...creditNote,
    clientName: creditNote.client.businessName,
    invoiceNo: creditNote.invoice?.invoiceNo || "",
    creditNoteDate: creditNote.creditNoteDate.toISOString().split("T")[0],
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(creditNoteUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    const { items, clientName, client, invoiceNo, invoice, ...cnData } = data;

    delete cnData.id;
    delete cnData.createdAt;
    if (cnData.creditNoteDate) cnData.creditNoteDate = new Date(cnData.creditNoteDate);
    if (!cnData.invoiceId) cnData.invoiceId = null;

    await prisma.creditNoteLineItem.deleteMany({ where: { creditNoteId: id } });

    const creditNote = await prisma.creditNote.update({
      where: { id },
      data: {
        ...cnData,
        items: { create: sanitizeLineItems(items) },
      },
      include: { items: true },
    });
    return NextResponse.json(creditNote);
  } catch (err: unknown) {
    console.error("PUT /api/credit-notes/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That credit note number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    await prisma.creditNote.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/credit-notes/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That credit note number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
