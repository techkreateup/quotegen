import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { razorpay } from "@/lib/razorpay";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { transitionSubscription, canTransition } from "@/lib/subscription";

// POST /api/admin/payments/refund { billingPaymentId, amount?, cancelSubscription? }
// Super-admin only. Lives under /api/admin so the platform-staff proxy guard
// allows it (the proxy blocks platform staff from non-admin company APIs).
// Issues a Razorpay refund and marks the payment REFUNDED.
//
// If `cancelSubscription` is true (default for full refund), the company's
// active subscription is moved to CANCELED so they don't keep the paid plan
// for free until the next cron tick.
async function POST_handler(request: NextRequest) {
  const platformRole = request.headers.get("x-platform-role");
  if (platformRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only a super admin can issue refunds." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const billingPaymentId = String(body.billingPaymentId || "");
  if (!billingPaymentId) {
    return NextResponse.json({ error: "billingPaymentId is required" }, { status: 400 });
  }

  const payment = await prismaUnscoped.billingPayment.findUnique({ where: { id: billingPaymentId } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (payment.status !== "CAPTURED" || !payment.razorpayPaymentId) {
    return NextResponse.json({ error: "Only captured payments can be refunded." }, { status: 400 });
  }

  // Optional partial amount (paise); defaults to full refund.
  const amount = body.amount ? Number(body.amount) : undefined;
  const isFullRefund = !amount || amount >= payment.amount;
  // Default behavior: full refund → cancel subscription. Partial → leave intact.
  // Caller can override with explicit cancelSubscription flag.
  const cancelSubscription =
    body.cancelSubscription !== undefined ? !!body.cancelSubscription : isFullRefund;

  // Race-safe claim: only proceed if status is still CAPTURED. A second concurrent
  // refund attempt sees count === 0 and bails before hitting Razorpay.
  const claim = await prismaUnscoped.billingPayment.updateMany({
    where: { id: billingPaymentId, status: "CAPTURED" },
    data: { notes: { ...(payment.notes as object || {}), refundInProgress: true } },
  });
  if (claim.count === 0) {
    return NextResponse.json(
      { error: "This payment is already being refunded or its status changed." },
      { status: 409 }
    );
  }

  let refund;
  try {
    refund = await razorpay.payments.refund(payment.razorpayPaymentId, amount ? { amount } : {});
  } catch (e: unknown) {
    // Roll back the claim flag so a retry is possible.
    await prismaUnscoped.billingPayment.update({
      where: { id: billingPaymentId },
      data: { notes: (payment.notes as object) || {} },
    });
    const msg = e instanceof Error ? e.message : "Refund failed at Razorpay";
    console.error(`[refund] ${billingPaymentId} failed:`, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await prismaUnscoped.billingPayment.update({
    where: { id: billingPaymentId },
    data: {
      status: "REFUNDED",
      notes: {
        ...(payment.notes as object || {}),
        refundId: refund.id,
        refundedAt: new Date().toISOString(),
        refundedAmount: amount ?? payment.amount,
      },
    },
  });

  // Revert subscription so the customer doesn't keep paid access for free.
  let subscriptionAction: string | null = null;
  if (cancelSubscription) {
    try {
      const company = await prismaUnscoped.company.findUnique({
        where: { id: payment.companyId },
        select: { subscriptionStatus: true },
      });
      if (company && canTransition(company.subscriptionStatus, "CANCELED")) {
        await transitionSubscription(payment.companyId, "CANCELED");
        subscriptionAction = "canceled";
      } else if (company) {
        subscriptionAction = `skipped (current state ${company.subscriptionStatus} cannot transition to CANCELED)`;
      }
    } catch (e) {
      console.error(`[refund] subscription cancel for ${payment.companyId} failed:`, (e as Error).message);
      subscriptionAction = "cancel-failed";
    }
  }

  const userId = request.headers.get("x-user-id") || "system";
  logAudit({
    userId,
    entity: "BillingPayment",
    entityId: billingPaymentId,
    action: "STATUS_CHANGE",
    after: { status: "REFUNDED", refundId: refund.id, subscriptionAction },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true, refundId: refund.id, subscriptionAction });
}

export const POST = withApi(POST_handler, { allowPlatform: true });
