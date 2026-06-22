import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { enabledFeatureCount, FEATURE_KEYS, type FeatureMap } from "@/lib/features";

// SUPER_ADMIN only (enforced by proxy on /api/admin/**)
async function GET_handler(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status"); // active | inactive
  const plan = sp.get("plan"); // Starter | Professional | Enterprise

  const where: Record<string, unknown> = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (plan) where.plan = plan;

  const companies = await prismaUnscoped.company.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, clients: true, invoices: true, issues: true } },
      onboarding: { select: { completedAt: true, skippedAt: true } },
    },
  });

  return NextResponse.json({
    companies: companies.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      slug: c.slug,
      plan: c.plan,
      isActive: c.isActive,
      maxUsers: c.maxUsers,
      featuresEnabled: enabledFeatureCount(c.featureOverrides as FeatureMap),
      featuresTotal: FEATURE_KEYS.length,
      createdAt: c.createdAt,
      onboardingCompletedAt: c.onboardingCompletedAt,
      onboardingSkipped: !!c.onboarding?.skippedAt,
      users: c._count.users,
      clients: c._count.clients,
      invoices: c._count.invoices,
      issues: c._count.issues,
    })),
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
