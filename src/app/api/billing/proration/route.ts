import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { getPlanDef } from "@/lib/plans-db";
import { PLANS, type Plan } from "@/lib/features";
import { computeProration } from "@/lib/proration";

// GET /api/billing/proration?plan=Professional
// Previews what the company would actually be charged for switching to `plan`,
// applying upgrade proration (credit for the unused part of the current plan).
// Checkout reads this so the displayed amount matches what create-order will charge.
async function GET_handler(request: NextRequest) {
  const companyId = requireCompanyId();
  const planName = new URL(request.url).searchParams.get("plan") || "";

  if (!PLANS.includes(planName as Plan)) {
    return NextResponse.json({ error: "A valid plan is required" }, { status: 400 });
  }
  const planDef = await getPlanDef(planName as Plan);
  if (!planDef || planDef.comingSoon) {
    return NextResponse.json({ error: "This plan isn't available for purchase" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionStatus: true, currentPlanId: true, currentPeriodStart: true, currentPeriodEnd: true },
  });

  let creditInPaise = 0;
  let chargeInPaise = planDef.priceInPaise;
  let isUpgrade = false;
  let remainingDays = 0;

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
        creditInPaise = pr.creditInPaise;
        chargeInPaise = Math.max(planDef.priceInPaise < 100 ? planDef.priceInPaise : 100, pr.chargeInPaise);
        isUpgrade = true;
        remainingDays = pr.remainingDays;
      }
    }
  }

  return NextResponse.json({
    plan: planName,
    billingPeriod: planDef.billingPeriod,
    fullPriceInPaise: planDef.priceInPaise,
    creditInPaise,
    chargeInPaise,
    isUpgrade,
    remainingDays,
    currentPlanId: company?.currentPlanId ?? null,
  });
}

export const GET = withApi(GET_handler);
