import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getPlatformBrandAndGst } from "@/lib/platform-brand";
import { renderBillingDoc } from "@/lib/billing-pdf-template";

// GET /api/billing/invoices/:id — printable HTML GST tax invoice.
// Append ?variant=receipt to get the payment receipt variant of the same data.
async function GET_handler(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const variant = url.searchParams.get("variant") === "receipt" ? "receipt" : "invoice";

  const inv = await prisma.subscriptionInvoice.findUnique({ where: { id } });
  // findUnique is tenant-scoped, so a foreign invoice resolves to null.
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const [payment, settings, { brand, gst }] = await Promise.all([
    prisma.billingPayment.findUnique({ where: { id: inv.billingPaymentId } }),
    prisma.companySettings.findFirst(),
    getPlatformBrandAndGst(),
  ]);

  if (!payment) return NextResponse.json({ error: "Payment record missing" }, { status: 404 });

  const html = renderBillingDoc({
    variant,
    brand,
    gst,
    invoice: {
      invoiceNumber: inv.invoiceNumber,
      createdAt: inv.createdAt,
      taxableValue: inv.taxableValue,
      cgst: inv.cgst,
      sgst: inv.sgst,
      igst: inv.igst,
      total: inv.total,
      customerGstin: inv.customerGstin,
      placeOfSupply: inv.placeOfSupply,
      sacCode: inv.sacCode,
    },
    payment: {
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      amount: payment.amount,
      currency: payment.currency,
      planName: payment.planName,
      createdAt: payment.createdAt,
      paymentMethod: null,
    },
    customer: {
      businessName: settings?.businessName || "Customer",
      email: settings?.email || "",
      address: settings?.address || "",
      city: settings?.city || "",
      state: settings?.state || "",
      pincode: settings?.pincode || "",
      country: settings?.country || "India",
      gstin: inv.customerGstin || settings?.gstin || "",
    },
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const GET = withApi(GET_handler);
