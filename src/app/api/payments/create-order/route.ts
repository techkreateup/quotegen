import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { razorpay } from "@/lib/razorpay";
import { rateLimit } from "@/lib/rate-limit";
import { getPlanDef } from "@/lib/plans-db";
import { PLANS, type Plan } from "@/lib/features";
import { computeProration } from "@/lib/proration";

async function POST_handler(request: NextRequest) {
  const companyId = requireCompanyId();

  // 10 orders / minute / company.
  if (!(await rateLimit(`razorpay-order:${companyId}`, 10, 60_000))) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const currency = (body.currency || "INR").toString().toUpperCase();
  const planName = body.planName ? String(body.planName) : null;

  if (!Number.isInteger(amount) || amount < 100) {
    return NextResponse.json(
      { error: "amount must be an integer ≥ 100 (paise)" },
      { status: 400 }
    );
  }
  if (currency !== "INR") {
    return NextResponse.json({ error: "Only INR is supported" }, { status: 400 });
  }

  // The plan's DB price is the source of truth. Reject any client-submitted amount
  // that doesn't match it (prevents tampering with the checkout amount).
  if (!planName || !PLANS.includes(planName as Plan)) {
    return NextResponse.json({ error: "A valid plan is required" }, { status: 400 });
  }
  const planDef = await getPlanDef(planName as Plan);
  if (!planDef || planDef.comingSoon || planDef.priceInPaise < 100) {
    return NextResponse.json({ error: "This plan isn't available for purchase" }, { status: 400 });
  }

  // Determine the authoritative amount server-side. If the company is currently on
  // a different paid plan with a live billing window, an upgrade is prorated:
  // credit the unused portion of the current plan against the new plan's price.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionStatus: true, currentPlanId: true, currentPeriodStart: true, currentPeriodEnd: true },
  });

  let expectedAmount = planDef.priceInPaise;
  let creditInPaise = 0;
  if (
    company?.subscriptionStatus === "ACTIVE" &&
    company.currentPlanId &&
    company.currentPlanId !== planName
  ) {
    const currentDef = await getPlanDef(company.currentPlanId as Plan);
    if (currentDef) {
      const pr = computeProration({
        currentPriceInPaise: currentDef.priceInPaise,
        newPriceInPaise: planDef.priceInPaise,
        periodStart: company.currentPeriodStart,
        periodEnd: company.currentPeriodEnd,
      });
      if (pr.isUpgrade) {
        expectedAmount = pr.chargeInPaise;
        creditInPaise = pr.creditInPaise;
      }
    }
  }

  // Razorpay requires ≥ 100 paise. A prorated charge below that is treated as
  // effectively covered — clamp up so a valid order can still be created.
  if (expectedAmount < 100) expectedAmount = 100;

  // The client-submitted amount must match the server's authoritative figure.
  if (amount !== expectedAmount) {
    return NextResponse.json(
      { error: "amount does not match the plan price", expectedAmount },
      { status: 400 }
    );
  }

  const order = await razorpay.orders.create({
    amount,
    currency,
    receipt: `co_${companyId.slice(-12)}_${Date.now()}`,
    notes: { companyId, ...(planName ? { planName } : {}), ...(creditInPaise ? { proratedCredit: String(creditInPaise) } : {}) },
  });

  await prisma.billingPayment.create({
    data: {
      companyId,
      razorpayOrderId: order.id,
      amount,
      currency,
      planName,
      status: "CREATED",
      notes: creditInPaise ? { proratedCredit: creditInPaise } : {},
    },
  });

  return NextResponse.json(
    { orderId: order.id, amount, currency },
    { status: 201 }
  );
}

export const POST = withApi(POST_handler);
