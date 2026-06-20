import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";

async function POST_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const record = await prisma.salaryRecord.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (record.status === "Paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });

    const companyId = requireCompanyId();
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });

    const paymentMethod = body.paymentMethod || record.paymentMode || "Bank Transfer";
    const amountInWords = body.amountInWords || "";

    const voucher = await prisma.$transaction(async (tx) => {
      const { formatted: voucherNo } = await nextDocNumber(tx, "nextVoucherNo");
      const voucher = await tx.paymentVoucher.create({
        data: {
          companyId,
          voucherNo,
          voucherDate: new Date(),
          salaryRecordId: id,
          employeeId: record.employeeId,
          paidTo: record.employee.name,
          amount: record.netSalary,
          amountInWords,
          description: `Salary for ${monthName(record.month)} ${record.year}`,
          paymentMethod,
          checkedByName: settings?.checkedByName || "",
          checkedBySig: settings?.checkedBySig || "",
          approvedByName: settings?.approvedByName || "",
          approvedBySig: settings?.approvedBySig || "",
          paidByName: settings?.paidByName || "",
          paidBySig: settings?.paidBySig || "",
        },
      });

      await tx.salaryRecord.update({
        where: { id },
        data: { status: "Paid", paymentDate: new Date(), paymentMode: paymentMethod },
      });

      await tx.transaction.create({
        data: {
          companyId,
          date: new Date(),
          type: "Salary",
          category: "Salary",
          description: `Salary paid to ${record.employee.name} (${record.employee.employeeCode}) for ${monthName(record.month)} ${record.year}`,
          amount: record.netSalary,
          direction: "OUT",
          referenceType: "salary",
          referenceId: id,
          voucherId: voucher.id,
        },
      });

      return voucher;
    });

    return NextResponse.json({ salary: { ...record, status: "Paid" }, voucher });
  } catch (err: unknown) {
    console.error("POST /api/salary/[id]/process error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function monthName(m: number): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] || "";
}

export const POST = withApi(POST_handler);
