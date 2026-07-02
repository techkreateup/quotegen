import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Single vendor payment fetch for the remittance-advice page. Bundles vendor,
// company settings (letterhead), and this vendor's open bill ledger so the
// advice can show which bills are covered by the payment.

async function GET_handler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await prisma.vendorPayment.findUnique({ where: { id }, include: { vendor: true } });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [settings, bills, debitNotes, allPayments] = await Promise.all([
    prisma.companySettings.findFirst(),
    prisma.purchaseBill.findMany({
      where: { vendorId: payment.vendorId, status: { not: "Cancelled" } },
      select: { id: true, billNo: true, billDate: true, dueDate: true, totalAmount: true },
      orderBy: { billDate: "asc" },
    }),
    prisma.debitNote.findMany({ where: { vendorId: payment.vendorId, status: { not: "Cancelled" } }, select: { totalAmount: true } }),
    prisma.vendorPayment.findMany({ where: { vendorId: payment.vendorId }, select: { id: true, amount: true, paidDate: true } }),
  ]);

  return NextResponse.json({ payment, settings, bills, debitNotes, allPayments });
}

export const GET = withApi(GET_handler);
