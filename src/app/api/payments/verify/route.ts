import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId, getTenantContext } from "@/lib/tenant-context";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { transitionSubscription, canTransition } from "@/lib/subscription";
import { generateSubscriptionInvoice } from "@/lib/subscription-invoice";
import { getPlanDef } from "@/lib/plans-db";
import { periodEnd } from "@/lib/proration";
import { type Plan } from "@/lib/features";
import { sendEmail, paymentReceiptEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

async function POST_handler(request: NextRequest) {
  const companyId = requireCompanyId();
  const body = await request.json().catch(() => ({}));

  const orderId = String(body.razorpay_order_id || "");
  const paymentId = String(body.razorpay_payment_id || "");
  const signature = String(body.razorpay_signature || "");

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      { error: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required" },
      { status: 400 }
    );
  }

  // The order must belong to this company — the scoped client adds companyId to
  // the lookup (BillingPayment is in TENANT_MODELS), so a foreign order resolves
  // to null and cannot be claimed.
  const record = await prisma.billingPayment.findUnique({
    where: { razorpayOrderId: orderId },
  });
  if (!record) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  const valid = verifyPaymentSignature({ orderId, paymentId, signature });
  if (!valid) {
    // Do NOT mark as paid on a signature mismatch.
    await prisma.billingPayment.update({
      where: { razorpayOrderId: orderId },
      data: { status: "FAILED", razorpayPaymentId: paymentId },
    });
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  // Idempotent: if already captured, return success without re-applying.
  if (record.status === "CAPTURED") {
    return NextResponse.json({ status: "CAPTURED", alreadyProcessed: true });
  }

  // Race-safe claim: only the first caller (verify OR webhook) to flip the row
  // to CAPTURED triggers the side-effects below. If a concurrent webhook beat
  // us to it, count === 0 and we treat the row as already processed.
  const claim = await prisma.billingPayment.updateMany({
    where: { razorpayOrderId: orderId, status: { not: "CAPTURED" } },
    data: {
      status: "CAPTURED",
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    },
  });
  if (claim.count === 0) {
    return NextResponse.json({ status: "CAPTURED", alreadyProcessed: true });
  }
  const updated = await prisma.billingPayment.findUnique({
    where: { razorpayOrderId: orderId },
  });
  if (!updated) return NextResponse.json({ error: "Payment vanished after capture" }, { status: 500 });

  // Issue a GST invoice for the captured payment (idempotent).
  const subInvoice = await generateSubscriptionInvoice(updated.id).catch((e) => {
    console.error("[verify] subscription invoice failed:", (e as Error).message);
    return null;
  });

  // Email a payment receipt (fire-and-forget).
  const settings = await prisma.companySettings.findFirst({ select: { email: true, businessName: true } });
  if (settings?.email) {
    const invoiceUrl = subInvoice ? `/api/billing/invoices/${subInvoice.id}?variant=receipt` : undefined;
    sendEmail({
      to: settings.email,
      subject: "Payment received — QuoteGen",
      html: paymentReceiptEmail(
        settings.businessName || "there",
        updated.planName || "subscription",
        `₹${(updated.amount / 100).toLocaleString("en-IN")}`,
        subInvoice?.invoiceNumber || "—",
        invoiceUrl,
      ),
    }).catch((e) => {
      // Don't fail the request — Razorpay already captured. But surface for ops:
      // a customer who paid and never got a receipt will likely raise a ticket.
      console.error(
        `[verify] receipt email to ${settings.email} for payment ${updated.id} failed:`,
        (e as Error).message
      );
    });
  }

  // Apply the plan the company paid for and move the subscription to ACTIVE.
  if (updated.planName) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionStatus: true },
    });
    if (company && canTransition(company.subscriptionStatus, "ACTIVE")) {
      await transitionSubscription(companyId, "ACTIVE", { planId: updated.planName });
    } else {
      // Already ACTIVE (e.g. plan change) — just sync the plan.
      await prisma.company.update({
        where: { id: companyId },
        data: { plan: updated.planName, currentPlanId: updated.planName },
      });
    }

    // Open a fresh billing window from now so a later mid-cycle upgrade can be
    // prorated against the unused remainder. The cadence is whichever the
    // customer paid for — read it from order notes (defaults to plan default).
    const planDef = await getPlanDef(updated.planName as Plan);
    const paidPeriod =
      (updated.notes && typeof updated.notes === "object" && "billingPeriod" in updated.notes
        ? String((updated.notes as Record<string, unknown>).billingPeriod)
        : null) || planDef?.billingPeriod || "monthly";
    const start = new Date();
    await prisma.company.update({
      where: { id: companyId },
      data: {
        currentPeriodStart: start,
        currentPeriodEnd: planDef ? periodEnd(start, paidPeriod) : null,
        currentBillingInterval: paidPeriod,
      },
    });
  }

  const userId = getTenantContext()?.userId;
  if (userId) {
    logAudit({
      userId,
      entity: "BillingPayment",
      entityId: updated.id,
      action: "STATUS_CHANGE",
      after: { status: "CAPTURED", razorpayPaymentId: paymentId, planName: updated.planName },
      ip: clientIp(request),
    });
  }

  return NextResponse.json({ status: "CAPTURED" });
}

export const POST = withApi(POST_handler);
