import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { resolveFeatures, type FeatureMap } from "@/lib/features";

// Tenant-facing: the current company's plan + resolved feature access.
// Read-only; used by the in-app Plans / upgrade page.
async function GET_handler(request: NextRequest) {
  const companyId = request.headers.get("x-company-id");
  if (!companyId) return NextResponse.json({ error: "Company context required" }, { status: 400 });

  const company = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: {
      plan: true, featureOverrides: true, maxUsers: true, createdAt: true,
      subscriptionStatus: true, trialEndsAt: true, currentPlanId: true,
      currentPeriodStart: true, currentPeriodEnd: true, currentBillingInterval: true,
      _count: { select: { users: true } },
    },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  return NextResponse.json({
    plan: company.plan,
    maxUsers: company.maxUsers,
    seatsUsed: company._count.users,
    createdAt: company.createdAt,
    subscriptionStatus: company.subscriptionStatus,
    trialEndsAt: company.trialEndsAt,
    currentPlanId: company.currentPlanId,
    currentPeriodStart: company.currentPeriodStart,
    currentPeriodEnd: company.currentPeriodEnd,
    currentBillingInterval: company.currentBillingInterval,
    features: resolveFeatures(company.featureOverrides as FeatureMap),
  });
}

export const GET = withApi(GET_handler);
