import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";

async function GET_handler() {
  try {
    const vouchers = await prisma.paymentVoucher.findMany({
      include: { employee: { select: { name: true, employeeCode: true } }, salaryRecord: { select: { month: true, year: true } } },
      orderBy: { createdAt: "desc" },
    });

    const mapped = vouchers.map((v) => ({
      ...v,
      employeeCode: v.employee.employeeCode,
      employeeName: v.employee.name,
    }));

    return NextResponse.json(mapped);
  } catch (err: unknown) {
    console.error("GET /api/vouchers error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const companyId = requireCompanyId();

    const settings = await prisma.companySettings.findUnique({ where: { companyId } });

    const voucher = await prisma.$transaction(async (tx) => {
      const { formatted: voucherNo } = await nextDocNumber(tx, "nextVoucherNo");
      const voucher = await tx.paymentVoucher.create({
        data: {
          companyId,
          voucherNo,
          voucherDate: data.voucherDate ? new Date(data.voucherDate) : new Date(),
          employeeId: data.employeeId,
          paidTo: data.paidTo,
          amount: Number(data.amount),
          amountInWords: data.amountInWords || "",
          description: data.description || "",
          paymentMethod: data.paymentMethod || "Bank Transfer",
          checkedByName: settings?.checkedByName || "",
          checkedBySig: settings?.checkedBySig || "",
          approvedByName: settings?.approvedByName || "",
          approvedBySig: settings?.approvedBySig || "",
          paidByName: settings?.paidByName || "",
          paidBySig: settings?.paidBySig || "",
        },
      });

      await tx.transaction.create({
        data: {
          companyId,
          date: voucher.voucherDate,
          type: "Salary",
          category: "Salary",
          description: `Payment voucher ${voucher.voucherNo} - ${data.description || data.paidTo}`,
          amount: voucher.amount,
          direction: "OUT",
          referenceType: "voucher",
          referenceId: voucher.id,
          voucherId: voucher.id,
        },
      });

      return voucher;
    });

    return NextResponse.json(voucher, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/vouchers error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
