import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const voucher = await prisma.paymentVoucher.findUnique({
    where: { id },
    include: { employee: true, salaryRecord: true },
  });
  if (!voucher) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(voucher);
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();

    const update: Record<string, unknown> = {};
    if (data.description !== undefined) update.description = data.description;
    if (data.paymentMethod !== undefined) update.paymentMethod = data.paymentMethod;
    if (data.paidTo !== undefined) update.paidTo = data.paidTo;
    if (data.checkedByName !== undefined) update.checkedByName = data.checkedByName;
    if (data.checkedBySig !== undefined) update.checkedBySig = data.checkedBySig;
    if (data.approvedByName !== undefined) update.approvedByName = data.approvedByName;
    if (data.approvedBySig !== undefined) update.approvedBySig = data.approvedBySig;
    if (data.paidByName !== undefined) update.paidByName = data.paidByName;
    if (data.paidBySig !== undefined) update.paidBySig = data.paidBySig;

    const voucher = await prisma.paymentVoucher.update({ where: { id }, data: update });
    return NextResponse.json(voucher);
  } catch (err: unknown) {
    console.error("PUT /api/vouchers/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "system";
    const userName = request.headers.get("x-user-name") || "";
    // Soft delete into recycle bin — salary link + transaction stay attached
    // so restore is one flag flip.
    await prisma.paymentVoucher.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId, deletedByName: userName },
    });
    return NextResponse.json({ ok: true, softDeleted: true });
  } catch (err: unknown) {
    console.error("DELETE /api/vouchers/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
