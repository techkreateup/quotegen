import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await prisma.purchaseBill.findUnique({
    where: { id },
    include: { vendor: true, items: true, purchaseOrder: { select: { id: true, purchaseOrderNo: true, status: true } }, debitNotes: { select: { id: true, debitNoteNo: true, totalAmount: true, status: true } } },
  });
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bill);
}

const ALLOWED = ["billNo", "billDate", "dueDate", "description", "status", "itcEligible", "isReverseCharge", "notes"] as const;
async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (!(k in body)) continue;
    const v = body[k];
    if (k === "billDate" || k === "dueDate") {
      data[k] = v ? new Date(v as string) : null;
    } else data[k] = v;
  }
  const row = await prisma.purchaseBill.update({ where: { id }, data: data as never });
  return NextResponse.json(row);
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Soft delete into recycle bin. Line items stay attached.
  const userId = request.headers.get("x-user-id") || "system";
  const userName = request.headers.get("x-user-name") || "";
  await prisma.purchaseBill.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
  });
  return NextResponse.json({ ok: true, softDeleted: true });
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
