import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { transitionSubscription } from "@/lib/subscription";
import { generateSubscriptionInvoice } from "@/lib/subscription-invoice";
import { sendEmail, paymentFailedEmail } from "@/lib/email";
import type { BillingPaymentStatus } from "@/generated/prisma/enums";

// Razorpay payment entity fields we care about.
interface RzpPayment {
  id: string;
  order_id: string;
  status: string;
}

async function POST_handler(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let event: { event: string; payload?: Record<string, { entity?: RzpPayment }> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;

  // Map webhook events to our payment status.
  const statusByEvent: Record<string, BillingPaymentStatus> = {
    "payment.captured": "CAPTURED",
    "subscription.charged": "CAPTURED",
    "payment.failed": "FAILED",
    "subscription.halted": "FAILED",
  };
  const newStatus = statusByEvent[event.event];

  if (newStatus && payment?.order_id) {
    const record = await prismaUnscoped.billingPayment.findUnique({
      where: { razorpayOrderId: payment.order_id },
    });

    // Idempotency: skip if we've already recorded this captured payment.
    if (record && !(record.status === "CAPTURED" && record.razorpayPaymentId === payment.id)) {
      await prismaUnscoped.billingPayment.update({
        where: { razorpayOrderId: payment.order_id },
        data: {
          status: newStatus,
          razorpayPaymentId: payment.id,
          notes: { lastEvent: event.event },
        },
      });

      // Drive the company's subscription state machine off the webhook.
      try {
        if (newStatus === "CAPTURED") {
          await transitionSubscription(record.companyId, "ACTIVE", {
            planId: record.planName ?? undefined,
          });
          await generateSubscriptionInvoice(record.id).catch((e) =>
            console.error("[webhook] subscription invoice failed:", (e as Error).message)
          );
        } else if (newStatus === "FAILED") {
          await transitionSubscription(record.companyId, "PAST_DUE");
          const settings = await prismaUnscoped.companySettings.findFirst({
            where: { companyId: record.companyId },
            select: { email: true, businessName: true },
          });
          if (settings?.email) {
            const appUrl = process.env.APP_URL || "";
            sendEmail({
              to: settings.email,
              subject: "Action needed: payment failed — QuoteGen",
              html: paymentFailedEmail(settings.businessName || "there", `${appUrl}/checkout?plan=${record.planName || ""}`),
            }).catch(() => {});
          }
        }
      } catch (err) {
        // Invalid transition (e.g. already in target state) — log and move on;
        // the payment record is still updated above.
        console.warn("[razorpay webhook] transition skipped:", (err as Error).message);
      }
    }
  }

  // Always 200 so Razorpay stops retrying once we've accepted the event.
  return NextResponse.json({ received: true });
}

export const POST = withApi(POST_handler, { public: true });
