import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { razorpay } from "@/lib/razorpay";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

// POST /api/admin/payments/refund { billingPaymentId, amount? }
// Super-admin only. Lives under /api/admin so the platform-staff proxy guard
// allows it (the proxy blocks platform staff from non-admin company APIs).
// Issues a Razorpay refund and marks the payment REFUNDED.
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

  const refund = await razorpay.payments.refund(payment.razorpayPaymentId, amount ? { amount } : {});

  await prismaUnscoped.billingPayment.update({
    where: { id: billingPaymentId },
    data: { status: "REFUNDED", notes: { refundId: refund.id } },
  });

  const userId = request.headers.get("x-user-id") || "system";
  logAudit({
    userId,
    entity: "BillingPayment",
    entityId: billingPaymentId,
    action: "STATUS_CHANGE",
    after: { status: "REFUNDED", refundId: refund.id },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true, refundId: refund.id });
}

export const POST = withApi(POST_handler, { allowPlatform: true });
