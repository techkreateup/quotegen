import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, creditNoteSchema } from "@/lib/schemas";

async function GET_handler() {
  try {
    const creditNotes = await prisma.creditNote.findMany({
      where: { deletedAt: null },
      include: { items: { orderBy: { sortOrder: "asc" } }, client: true, invoice: true },
      orderBy: { createdAt: "desc" },
    });
    const result = creditNotes.map((cn) => ({
      ...cn,
      clientName: cn.client.businessName,
      invoiceNo: cn.invoice?.invoiceNo || "",
      creditNoteDate: cn.creditNoteDate.toISOString().split("T")[0],
    }));
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("GET /api/credit-notes error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That credit note number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(creditNoteSchema, data);
    if (!v.ok) return v.response!;
    const { items, clientName, invoiceNo, ...cnData } = data;

    const companyId = requireCompanyId();
    cnData.creditNoteDate = cnData.creditNoteDate ? new Date(cnData.creditNoteDate) : new Date();
    if (!cnData.invoiceId) delete cnData.invoiceId;

    const creditNote = await prisma.$transaction(async (tx) => {
      if (!cnData.creditNoteNo) {
        cnData.creditNoteNo = (await nextDocNumber(tx, "nextCreditNoteNo")).formatted;
      }
      return tx.creditNote.create({
        data: {
          companyId,
          ...cnData,
          items: { create: sanitizeLineItems(items) },
        },
        include: { items: true },
      });
    });
    return NextResponse.json(creditNote, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/credit-notes error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That credit note number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
