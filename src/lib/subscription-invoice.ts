import { prismaUnscoped } from "@/lib/db";

const GST_RATE = 0.18; // 18% on SaaS (SAC 9983)
// State of the SaaS provider's GST registration. Intra-state → CGST+SGST, else IGST.
const PROVIDER_STATE = (process.env.PROVIDER_GST_STATE || "Tamil Nadu").toLowerCase();

/**
 * Generates a GST invoice for a captured billing payment (idempotent on
 * billingPaymentId). `amountPaise` is the gross amount Razorpay captured; we
 * treat it as GST-inclusive and back out the taxable value.
 */
export async function generateSubscriptionInvoice(billingPaymentId: string) {
  const existing = await prismaUnscoped.subscriptionInvoice.findUnique({
    where: { billingPaymentId },
  });
  if (existing) return existing;

  const payment = await prismaUnscoped.billingPayment.findUnique({
    where: { id: billingPaymentId },
  });
  if (!payment) throw new Error(`BillingPayment ${billingPaymentId} not found`);

  const settings = await prismaUnscoped.companySettings.findFirst({
    where: { companyId: payment.companyId },
    select: { gstin: true, state: true },
  });

  const gross = payment.amount / 100; // paise → rupees
  const taxableValue = Math.round((gross / (1 + GST_RATE)) * 100) / 100;
  const totalTax = Math.round((gross - taxableValue) * 100) / 100;

  const intraState = (settings?.state || "").toLowerCase() === PROVIDER_STATE;
  const cgst = intraState ? Math.round((totalTax / 2) * 100) / 100 : 0;
  const sgst = cgst;
  const igst = intraState ? 0 : totalTax;

  // Invoice number series: SUB/YYYY/<sequential>
  const year = new Date().getFullYear();
  const count = await prismaUnscoped.subscriptionInvoice.count();
  const invoiceNumber = `SUB/${year}/${String(count + 1).padStart(5, "0")}`;

  return prismaUnscoped.subscriptionInvoice.create({
    data: {
      companyId: payment.companyId,
      billingPaymentId,
      invoiceNumber,
      customerGstin: settings?.gstin || "",
      placeOfSupply: settings?.state || "",
      sacCode: "9983",
      taxableValue,
      cgst,
      sgst,
      igst,
      total: gross,
    },
  });
}
