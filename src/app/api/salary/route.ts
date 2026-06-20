import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { parse, salarySchema } from "@/lib/schemas";

async function GET_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const where: Record<string, unknown> = {};
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);

    const records = await prisma.salaryRecord.findMany({
      where,
      include: { employee: { select: { name: true, employeeCode: true, designation: true, department: true } }, voucher: { select: { id: true, voucherNo: true } } },
      orderBy: { createdAt: "desc" },
    });

    const mapped = records.map((r) => ({
      ...r,
      employeeCode: r.employee.employeeCode,
      employeeName: r.employee.name,
      designation: r.employee.designation,
      department: r.employee.department,
      voucherId: r.voucher?.id ?? null,
      voucherNo: r.voucher?.voucherNo ?? null,
    }));

    return NextResponse.json(mapped);
  } catch (err: unknown) {
    console.error("GET /api/salary error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(salarySchema, data);
    if (!v.ok) return v.response!;
    const { employeeId, month, year, basicSalary, deductions, bonuses, notes } = data;

    const netSalary = Number(basicSalary) - Number(deductions || 0) + Number(bonuses || 0);

    // Check for existing record (unique constraint: employeeId+month+year)
    const existing = await prisma.salaryRecord.findFirst({
      where: { employeeId, month: Number(month), year: Number(year) },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Salary already generated for this employee for ${month}/${year}` },
        { status: 409 }
      );
    }

    const record = await prisma.salaryRecord.create({
      data: {
        companyId: requireCompanyId(),
        employeeId,
        month: Number(month),
        year: Number(year),
        basicSalary: Number(basicSalary),
        deductions: Number(deductions || 0),
        bonuses: Number(bonuses || 0),
        netSalary,
        notes: notes || "",
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/salary error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
