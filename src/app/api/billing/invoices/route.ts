import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/billing/invoices — combined billing history for this company.
// Returns every BillingPayment (incl. CREATED/FAILED/REFUNDED) joined with its
// SubscriptionInvoice (if one was issued). Drives the /billing page.
async function GET_handler() {
  const [payments, invoices] = await Promise.all([
    prisma.billingPayment.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.subscriptionInvoice.findMany(),
  ]);
  const invByPayment = new Map(invoices.map((i) => [i.billingPaymentId, i] as const));
  const rows = payments.map((p) => {
    const inv = invByPayment.get(p.id);
    return {
      id: p.id,
      createdAt: p.createdAt,
      planName: p.planName,
      amount: p.amount, // paise
      currency: p.currency,
      status: p.status,
      razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId,
      invoice: inv
        ? {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            taxableValue: inv.taxableValue,
            cgst: inv.cgst,
            sgst: inv.sgst,
            igst: inv.igst,
            total: inv.total,
          }
        : null,
    };
  });
  return NextResponse.json({ rows, invoices });
}

export const GET = withApi(GET_handler);
