import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId, getTenantContext } from "@/lib/tenant-context";
import { transitionSubscription, canTransition } from "@/lib/subscription";
import { logAudit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";

// Switches the company onto a plan. Payment itself flows through
// /api/payments/* ; this endpoint records the chosen plan and moves the
// subscription to ACTIVE (used for free/comped upgrades and post-payment sync).
async function POST_handler(request: NextRequest) {
  const companyId = requireCompanyId();
  const body = await request.json().catch(() => ({}));
  const planId = String(body.planId || "").trim();

  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  const plan = await prisma.planDefinition.findUnique({ where: { name: planId } });
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }
  if (plan.comingSoon) {
    return NextResponse.json({ error: "This plan is not yet available" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { subscriptionStatus: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (!canTransition(company.subscriptionStatus, "ACTIVE")) {
    // Already ACTIVE — treat as a plan change.
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: planId, currentPlanId: planId },
    });
  } else {
    await transitionSubscription(companyId, "ACTIVE", { planId });
  }

  const userId = getTenantContext()?.userId;
  if (userId) {
    logAudit({
      userId,
      entity: "Company",
      entityId: companyId,
      action: "STATUS_CHANGE",
      after: { subscriptionStatus: "ACTIVE", currentPlanId: planId },
      ip: clientIp(request),
    });
  }

  return NextResponse.json({ status: "ACTIVE", planId });
}

export const POST = withApi(POST_handler);
