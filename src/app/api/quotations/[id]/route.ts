import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sanitizeLineItems } from "@/lib/line-items";
import { parse, quotationUpdateSchema } from "@/lib/schemas";
import { requireCompanyId } from "@/lib/tenant-context";
import { recordQuoteOutcome } from "@/lib/advisor/ingest";
import { buildLineage } from "@/lib/lineage";

const TERMINAL_STATUSES = new Set(["Won", "Lost"]);

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
    related: await buildLineage("quotation", id),
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

    // Capture the prior status so we can detect a transition into a terminal
    // (Won/Lost) state for the Decision Advisor.
    const prev = await prisma.quotation.findUnique({
      where: { id },
      select: { status: true },
    });

    // Delete old items and recreate
    await prisma.quotationLineItem.deleteMany({ where: { quotationId: id } });

    const quotation = await prisma.quotation.update({
      where: { id },
      data: {
        ...quotationData,
        items: { create: sanitizeLineItems(items) },
      },
      include: { items: true, client: { select: { industry: true, state: true } } },
    });

    // Decision Advisor: on a fresh transition into Won/Lost, contribute one
    // de-identified outcome event. Best-effort — recordQuoteOutcome never throws.
    if (
      TERMINAL_STATUSES.has(quotation.status) &&
      prev?.status !== quotation.status
    ) {
      await recordQuoteOutcome({
        companyId: requireCompanyId(),
        status: quotation.status,
        subtotal: quotation.subtotal,
        totalDiscount: quotation.totalDiscount,
        totalAmount: quotation.totalAmount,
        currency: quotation.currency,
        industry: quotation.client?.industry ?? "",
        region: quotation.client?.state ?? "",
      });
    }

    return NextResponse.json(quotation);
  } catch (err: unknown) {
    console.error("PUT /api/quotations/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That quotation number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Soft delete into recycle bin (line items stay attached for easy restore).
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    await prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/quotations/[id] error:", err);
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") { return NextResponse.json({ error: "That quotation number is already in use. Pick another." }, { status: 409 }); }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
