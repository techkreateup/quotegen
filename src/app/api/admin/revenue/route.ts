import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// Platform revenue metrics (Sprint 4.3). Aggregates across all companies via the
// unscoped client. Amounts are converted from paise to rupees.
async function GET_handler() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [captured, statusGroups, planGroups, monthCaptured, canceledThisMonth, activeStart] =
    await Promise.all([
      prismaUnscoped.billingPayment.findMany({
        where: { status: "CAPTURED" },
        select: { amount: true, planName: true, createdAt: true },
      }),
      prismaUnscoped.company.groupBy({ by: ["subscriptionStatus"], _count: true }),
      prismaUnscoped.company.groupBy({
        by: ["plan"],
        where: { subscriptionStatus: "ACTIVE" },
        _count: true,
      }),
      prismaUnscoped.billingPayment.aggregate({
        _sum: { amount: true },
        where: { status: "CAPTURED", createdAt: { gte: monthStart } },
      }),
      prismaUnscoped.company.count({
        where: { subscriptionStatus: "CANCELED", updatedAt: { gte: monthStart } },
      }),
      prismaUnscoped.company.count({ where: { subscriptionStatus: "ACTIVE" } }),
    ]);

  const totalRevenue = captured.reduce((s, p) => s + p.amount, 0) / 100;
  const mrr = (monthCaptured._sum.amount ?? 0) / 100;

  const statusCounts: Record<string, number> = {};
  for (const g of statusGroups) statusCounts[g.subscriptionStatus] = g._count;

  const activeSubs = statusCounts.ACTIVE ?? 0;
  const trialing = statusCounts.TRIALING ?? 0;
  // Trial→paid conversion: active / (active + still-trialing) as a rough rate.
  const conversionRate = activeSubs + trialing > 0 ? activeSubs / (activeSubs + trialing) : 0;
  // Churn: canceled this month / active at month start (approx via current active + canceled).
  const churnRate = activeStart + canceledThisMonth > 0
    ? canceledThisMonth / (activeStart + canceledThisMonth)
    : 0;

  // Monthly revenue trend (last 6 months).
  const trend: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const sum = captured
      .filter((p) => p.createdAt >= start && p.createdAt < end)
      .reduce((s, p) => s + p.amount, 0) / 100;
    trend.push({ month: start.toLocaleString("en-IN", { month: "short", year: "2-digit" }), revenue: sum });
  }

  return NextResponse.json({
    mrr,
    totalRevenue,
    activeSubscriptions: activeSubs,
    trialing,
    churnRate,
    conversionRate,
    statusCounts,
    byPlan: planGroups.map((p) => ({ plan: p.plan, count: p._count })),
    trend,
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
