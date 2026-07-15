import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped as prisma } from "@/lib/db";
import { verifyShareToken } from "@/lib/share-token";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ type: string; id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { type, id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("t") || "";
  if (!verifyShareToken(type, id, token)) return NextResponse.json({ error: "invalid token" }, { status: 403 });

  let doc: unknown = null;
  let companyId: string | null = null;
  let clientId: string | null = null;

  const inc = { items: { orderBy: { sortOrder: "asc" as const } } };
  if (type === "invoice") {
    const r = await prisma.invoice.findUnique({ where: { id }, include: inc });
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
    doc = r; companyId = r.companyId; clientId = r.clientId;
  } else if (type === "quotation") {
    const r = await prisma.quotation.findUnique({ where: { id }, include: inc });
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
    doc = r; companyId = r.companyId; clientId = r.clientId;
  } else if (type === "receipt") {
    const r = await prisma.paymentReceipt.findUnique({ where: { id }, include: { invoice: true } });
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
    doc = { ...r, invoiceNo: r.invoice?.invoiceNo || "", clientName: "" };
    companyId = r.companyId; clientId = r.clientId;
  } else if (type === "salesOrder") {
    const r = await prisma.salesOrder.findUnique({ where: { id }, include: inc });
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
    doc = r; companyId = r.companyId; clientId = r.clientId;
  } else if (type === "deliveryChallan") {
    const r = await prisma.deliveryChallan.findUnique({ where: { id }, include: inc });
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
    doc = r; companyId = r.companyId; clientId = r.clientId;
  } else if (type === "purchaseOrder") {
    const r = await prisma.purchaseOrder.findUnique({ where: { id }, include: inc });
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
    doc = r; companyId = r.companyId;
  } else if (type === "debitNote") {
    const r = await prisma.debitNote.findUnique({ where: { id }, include: inc });
    if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
    doc = r; companyId = r.companyId;
  } else {
    return NextResponse.json({ error: "unsupported type" }, { status: 400 });
  }

  const settingsRow = companyId ? await prisma.companySettings.findUnique({ where: { companyId } }) : null;
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;

  return NextResponse.json({ doc, settings: settingsRow, client });
}
