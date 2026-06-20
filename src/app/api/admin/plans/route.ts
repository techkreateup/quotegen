import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPlanDefinitions, invalidatePlanCache } from "@/lib/plans-db";
import { FEATURES, FEATURE_KEYS, PLANS, type Plan } from "@/lib/features";

async function GET_handler() {
  const plans = await getPlanDefinitions();
  return NextResponse.json({ plans, features: FEATURES });
}

const BILLING_PERIODS = ["monthly", "yearly", "one-time"];

// PUT: upsert plan definitions. Body: { plans: [{ name, description, features[],
// maxUsers, comingSoon, price, priceInPaise, billingPeriod }] }. Changes reflect
// everywhere (landing, signup, in-app, gem markers) via the shared plans cache.
async function PUT_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const body = await request.json();
  const incoming = Array.isArray(body.plans) ? body.plans : [];

  const before = await getPlanDefinitions();

  for (const p of incoming) {
    const name = String(p.name) as Plan;
    if (!PLANS.includes(name)) continue;
    const features = Array.isArray(p.features) ? p.features.filter((f: string) => FEATURE_KEYS.includes(f)) : [];
    const maxUsers = p.maxUsers === null || p.maxUsers === undefined || p.maxUsers === "" ? null : Number(p.maxUsers);
    const priceInPaiseNum = Math.round(Number(p.priceInPaise));
    const priceInPaise = Number.isFinite(priceInPaiseNum) && priceInPaiseNum >= 0 ? priceInPaiseNum : 0;
    const billingPeriod = BILLING_PERIODS.includes(p.billingPeriod) ? p.billingPeriod : "monthly";
    const trialNum = Math.round(Number(p.trialDurationDays));
    const trialDurationDays = Number.isFinite(trialNum) && trialNum >= 0 ? trialNum : 90;
    await prismaUnscoped.planDefinition.upsert({
      where: { name },
      create: {
        name,
        description: String(p.description ?? ""),
        features,
        maxUsers: Number.isFinite(maxUsers) ? maxUsers : null,
        comingSoon: !!p.comingSoon,
        price: String(p.price ?? ""),
        priceInPaise,
        billingPeriod,
        trialDurationDays,
        sortOrder: PLANS.indexOf(name),
      },
      update: {
        description: String(p.description ?? ""),
        features,
        maxUsers: Number.isFinite(maxUsers) ? maxUsers : null,
        comingSoon: !!p.comingSoon,
        price: String(p.price ?? ""),
        priceInPaise,
        billingPeriod,
        trialDurationDays,
      },
    });
  }

  invalidatePlanCache();
  const after = await getPlanDefinitions();
  logAudit({ userId: adminId, entity: "PlanDefinition", entityId: "all", action: "PLAN_DEFS_UPDATE", before: { plans: before }, after: { plans: after } });

  return NextResponse.json({ plans: after });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const PUT = withApi(PUT_handler, { allowPlatform: true });
