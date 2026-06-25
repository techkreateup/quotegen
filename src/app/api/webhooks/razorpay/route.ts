import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { transitionSubscription } from "@/lib/subscription";
import { generateSubscriptionInvoice } from "@/lib/subscription-invoice";
import { sendEmail, paymentFailedEmail } from "@/lib/email";
import type { BillingPaymentStatus } from "@prisma/client";

// Razorpay payment entity fields we care about.
interface RzpPayment {
  id: string;
  order_id: string;
  status: string;
}

// Best-effort logger — never throws or fails the webhook response.
async function logWebhookEvent(args: {
  eventName: string;
  signatureOk: boolean;
  responseCode: number;
  orderId?: string | null;
  paymentId?: string | null;
  companyId?: string | null;
  payload?: unknown;
  error?: string;
}): Promise<void> {
  try {
    await prismaUnscoped.webhookEvent.create({
      data: {
        provider: "razorpay",
        event: args.eventName,
        signatureOk: args.signatureOk,
        responseCode: args.responseCode,
        orderId: args.orderId ?? null,
        paymentId: args.paymentId ?? null,
        companyId: args.companyId ?? null,
        // Cap payload to ~8KB to keep the table sane on giant events.
        payload: JSON.parse(JSON.stringify(args.payload ?? {})),
        error: (args.error ?? "").slice(0, 1000),
      },
    });
  } catch (e) {
    console.warn("[webhook log] write failed:", (e as Error).message);
  }
}

async function POST_handler(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  const signatureOk = verifyWebhookSignature(raw, signature);
  if (!signatureOk) {
    void logWebhookEvent({ eventName: "unknown", signatureOk: false, responseCode: 400, error: "Invalid signature" });
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let event: { event: string; payload?: Record<string, { entity?: RzpPayment }> };
  try {
    event = JSON.parse(raw);
  } catch {
    void logWebhookEvent({ eventName: "unknown", signatureOk: true, responseCode: 400, error: "Invalid JSON" });
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

  let companyId: string | null = null;
  let handlerError = "";
  let alreadyProcessed = false;

  if (newStatus && payment?.order_id) {
    try {
      const record = await prismaUnscoped.billingPayment.findUnique({
        where: { razorpayOrderId: payment.order_id },
      });

      // Race-safe claim: only the first caller (verify endpoint OR webhook) to
      // see a non-CAPTURED row gets to transition it. updateMany with a status
      // filter is atomic at the DB layer; if a concurrent request already moved
      // the row to CAPTURED, count === 0 and we skip side-effects entirely.
      if (record) {
        companyId = record.companyId;
        const targetingCapture = newStatus === "CAPTURED";
        const where = targetingCapture
          ? { razorpayOrderId: payment.order_id, status: { not: "CAPTURED" as BillingPaymentStatus } }
          : { razorpayOrderId: payment.order_id };
        const claim = await prismaUnscoped.billingPayment.updateMany({
          where,
          data: {
            status: newStatus,
            razorpayPaymentId: payment.id,
            notes: { lastEvent: event.event },
          },
        });

        if (claim.count === 0) {
          alreadyProcessed = true;
        } else {
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
                }).catch((e) =>
                  console.error(`[webhook] dunning email to ${settings.email} failed:`, (e as Error).message)
                );
              }
            }
          } catch (err) {
            handlerError = `transition skipped: ${(err as Error).message}`;
            console.warn("[razorpay webhook]", handlerError);
          }
        }
      }
    } catch (err) {
      handlerError = `handler error: ${(err as Error).message}`;
      console.error("[razorpay webhook]", handlerError);
    }
  }

  // Always 200 so Razorpay stops retrying once we've accepted the event.
  void logWebhookEvent({
    eventName: event.event,
    signatureOk: true,
    responseCode: 200,
    orderId: payment?.order_id ?? null,
    paymentId: payment?.id ?? null,
    companyId,
    payload: event,
    error: handlerError || (alreadyProcessed ? "already-processed (idempotent skip)" : ""),
  });
  return NextResponse.json({ received: true, alreadyProcessed });
}

export const POST = withApi(POST_handler, { public: true });
