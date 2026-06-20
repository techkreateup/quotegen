import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

async function GET_handler() {
  const now = Date.now();
  const d7 = new Date(now - 7 * DAY);
  const d30 = new Date(now - 30 * DAY);
  const d60 = new Date(now - 60 * DAY);

  const [
    totalCompanies,
    activeCompanies,
    totalUsers,
    onboardedCompanies,
    issuesByStatus,
    activeUsers7d,
    signups30d,
    signupsPrev30d,
    featureUsage,
    companyActivityRaw,
    planGroups,
    urgentOpenIssues,
    dormantCompanies,
  ] = await Promise.all([
    prismaUnscoped.company.count(),
    prismaUnscoped.company.count({ where: { isActive: true } }),
    prismaUnscoped.user.count({ where: { companyId: { not: null } } }),
    prismaUnscoped.company.count({ where: { onboardingCompletedAt: { not: null } } }),
    prismaUnscoped.issue.groupBy({ by: ["status"], _count: { _all: true } }),
    prismaUnscoped.usageEvent.findMany({
      where: { event: "login", createdAt: { gte: d7 }, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prismaUnscoped.usageEvent.count({ where: { event: "company_created", createdAt: { gte: d30 } } }),
    prismaUnscoped.usageEvent.count({
      where: { event: "company_created", createdAt: { gte: d60, lt: d30 } },
    }),
    prismaUnscoped.usageEvent.groupBy({
      by: ["event"],
      _count: { _all: true },
      where: { createdAt: { gte: d30 } },
      orderBy: { _count: { event: "desc" } },
      take: 12,
    }),
    prismaUnscoped.usageEvent.groupBy({
      by: ["companyId"],
      _count: { _all: true },
      where: { createdAt: { gte: d30 }, companyId: { not: null } },
      orderBy: { _count: { companyId: "desc" } },
      take: 8,
    }),
    prismaUnscoped.company.groupBy({ by: ["plan"], _count: { _all: true } }),
    prismaUnscoped.issue.count({ where: { priority: "URGENT", status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    // Active companies with NO usage event in the last 30 days (at-risk / dormant).
    prismaUnscoped.company.findMany({
      where: { isActive: true, usageEvents: { none: { createdAt: { gte: d30 } } } },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // Company names for the activity leaderboard.
  const companyNames = await prismaUnscoped.company.findMany({
    where: { id: { in: companyActivityRaw.map((c) => c.companyId as string) } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(companyNames.map((c) => [c.id, c.name]));

  // 6-month signup trend.
  const monthly: { label: string; signups: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date();
    start.setMonth(start.getMonth() - i, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const signups = await prismaUnscoped.company.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    monthly.push({ label: start.toLocaleString("default", { month: "short" }), signups });
  }

  const signupTrendPct = signupsPrev30d > 0
    ? Math.round(((signups30d - signupsPrev30d) / signupsPrev30d) * 100)
    : signups30d > 0 ? 100 : 0;

  return NextResponse.json({
    totals: {
      companies: totalCompanies,
      activeCompanies,
      inactiveCompanies: totalCompanies - activeCompanies,
      users: totalUsers,
      activeUsers7d: activeUsers7d.length,
      signups30d,
      signupTrendPct,
      onboardingCompletionRate: totalCompanies ? Math.round((onboardedCompanies / totalCompanies) * 100) : 0,
      urgentOpenIssues,
    },
    issues: Object.fromEntries(issuesByStatus.map((i) => [i.status, i._count._all])),
    plans: Object.fromEntries(planGroups.map((p) => [p.plan, p._count._all])),
    monthlySignups: monthly,
    featureUsage: featureUsage.map((f) => ({ event: f.event, count: f._count._all })),
    companyActivity: companyActivityRaw.map((c) => ({
      companyId: c.companyId,
      name: nameMap[c.companyId as string] || c.companyId,
      events: c._count._all,
    })),
    dormantCompanies: dormantCompanies.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt })),
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
