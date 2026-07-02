import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { computeTds, tdsRateFor } from "@/lib/tds";

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

    // TDS: treat `amount` as gross unless the caller sent grossAmount explicitly.
    // Section defaults from the vendor; caller can override rate/section/amount.
    const gross = Number(body.grossAmount ?? amount);
    const section = String(body.tdsSection ?? vendor.tdsSection ?? "");
    const rate = body.tdsRate !== undefined ? Number(body.tdsRate) : (vendor.tdsRate || tdsRateFor(section));
    const auto = computeTds(gross, rate);
    const tdsAmount = body.tdsAmount !== undefined ? Math.max(0, Number(body.tdsAmount)) : auto.tds;
    const net = Math.round((gross - tdsAmount) * 100) / 100;

    const payment = await prisma.vendorPayment.create({
      data: {
        companyId,
        vendorId: id,
        amount: net,
        grossAmount: gross,
        tdsSection: section,
        tdsRate: rate,
        tdsAmount,
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
        description: `Payment to ${vendor.name}: ${description || ""}${tdsAmount > 0 ? ` (net of ${section || "TDS"} ₹${tdsAmount})` : ""}`,
        amount: net,
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
