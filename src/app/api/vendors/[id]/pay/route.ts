import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

async function POST_handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor)
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const { amount, paidDate, description, paymentMethod, notes } = body;
    const companyId = requireCompanyId();

    const payment = await prisma.vendorPayment.create({
      data: {
        companyId,
        vendorId: id,
        amount: Number(amount),
        paidDate: new Date(paidDate),
        description: description || "",
        paymentMethod: paymentMethod || "Bank Transfer",
        notes: notes || "",
      },
    });

    await prisma.transaction.create({
      data: {
        companyId,
        date: new Date(paidDate),
        type: "VendorPayment",
        category: "Vendor Payment",
        description: `Payment to ${vendor.name}: ${description || ""}`,
        amount: Number(amount),
        direction: "OUT",
        referenceType: "vendor",
        referenceId: vendor.id,
        vendorPaymentId: payment.id,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/vendors/[id]/pay error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler);
