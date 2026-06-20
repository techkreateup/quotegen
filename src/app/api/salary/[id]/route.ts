import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, salaryUpdateSchema } from "@/lib/schemas";

async function GET_handler(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.salaryRecord.findUnique({
    where: { id },
    include: { employee: true, voucher: true },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(record);
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(salaryUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    const { basicSalary, deductions, bonuses, notes, status, paymentMode } = data;

    const update: Record<string, unknown> = {};
    if (basicSalary !== undefined) update.basicSalary = Number(basicSalary);
    if (deductions !== undefined) update.deductions = Number(deductions);
    if (bonuses !== undefined) update.bonuses = Number(bonuses);
    if (notes !== undefined) update.notes = notes;
    if (status !== undefined) update.status = status;
    if (paymentMode !== undefined) update.paymentMode = paymentMode;

    if (update.basicSalary !== undefined || update.deductions !== undefined || update.bonuses !== undefined) {
      const existing = await prisma.salaryRecord.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const basic = (update.basicSalary as number) ?? existing.basicSalary;
      const ded = (update.deductions as number) ?? existing.deductions;
      const bon = (update.bonuses as number) ?? existing.bonuses;
      update.netSalary = basic - ded + bon;
    }

    const record = await prisma.salaryRecord.update({ where: { id }, data: update });
    return NextResponse.json(record);
  } catch (err: unknown) {
    console.error("PUT /api/salary/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Find associated voucher (voucher has salaryRecordId pointing to this record)
    const voucher = await prisma.paymentVoucher.findFirst({ where: { salaryRecordId: id } });

    if (voucher) {
      // Delete transaction linked to this voucher
      await prisma.transaction.deleteMany({ where: { voucherId: voucher.id } });
      // Delete the voucher
      await prisma.paymentVoucher.delete({ where: { id: voucher.id } }).catch(() => {});
    }

    await prisma.salaryRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/salary/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
