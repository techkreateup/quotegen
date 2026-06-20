import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, employeeUpdateSchema } from "@/lib/schemas";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(employeeUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.employeeCode;

    const { dateOfJoining, salary, ...rest } = data;

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...rest,
        salary: salary !== undefined ? Number(salary) : undefined,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
      },
    });
    return NextResponse.json(employee);
  } catch (err: unknown) {
    console.error("PUT /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Cascade: delete salary records → vouchers → transactions
    const salaryRecords = await prisma.salaryRecord.findMany({ where: { employeeId: id }, select: { id: true } });
    for (const sr of salaryRecords) {
      const voucher = await prisma.paymentVoucher.findFirst({ where: { salaryRecordId: sr.id } });
      if (voucher) {
        await prisma.transaction.deleteMany({ where: { voucherId: voucher.id } });
        await prisma.paymentVoucher.delete({ where: { id: voucher.id } }).catch(() => {});
      }
      await prisma.salaryRecord.delete({ where: { id: sr.id } });
    }

    // Delete any remaining vouchers for this employee (non-salary ones)
    const vouchers = await prisma.paymentVoucher.findMany({ where: { employeeId: id }, select: { id: true } });
    for (const v of vouchers) {
      await prisma.transaction.deleteMany({ where: { voucherId: v.id } });
    }
    await prisma.paymentVoucher.deleteMany({ where: { employeeId: id } });

    // Disconnect user link if exists
    await prisma.user.updateMany({ where: { employeeId: id }, data: { employeeId: null } }).catch(() => {});

    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/employees/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
