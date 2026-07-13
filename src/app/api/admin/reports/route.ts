import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

// Platform reports across the three priority areas:
//   Growth & activation · Usage & adoption · Support & health
async function GET_handler() {
  const now = Date.now();
  const d30 = new Date(now - 30 * DAY);
  const d90 = new Date(now - 90 * DAY);

  const [
    totalCompanies,
    activeCompanies,
    onboardCompleted,
    onboardSkipped,
    onboardInProgress,
    activeUsers30d,
    totalUsers,
    docVolume,
    issuesByStatus,
    issuesByPriority,
    resolvedIssues,
    lockedUsers,
    topActive,
  ] = await Promise.all([
    prismaUnscoped.company.count(),
    prismaUnscoped.company.count({ where: { isActive: true } }),
    prismaUnscoped.company.count({ where: { onboardingCompletedAt: { not: null } } }),
    prismaUnscoped.onboardingProgress.count({ where: { skippedAt: { not: null }, completedAt: null } }),
    prismaUnscoped.onboardingProgress.count({ where: { skippedAt: null, completedAt: null } }),
    prismaUnscoped.usageEvent.findMany({
      where: { event: "login", createdAt: { gte: d30 }, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prismaUnscoped.user.count({ where: { companyId: { not: null } } }),
    Promise.all([
      prismaUnscoped.invoice.count(),
      prismaUnscoped.quotation.count(),
      prismaUnscoped.paymentReceipt.count(),
    ]),
    prismaUnscoped.issue.groupBy({ by: ["status"], _count: { _all: true } }),
    prismaUnscoped.issue.groupBy({ by: ["priority"], _count: { _all: true } }),
    prismaUnscoped.issue.findMany({
      where: { resolvedAt: { not: null, gte: d90 } },
      select: { createdAt: true, resolvedAt: true },
    }),
    prismaUnscoped.user.count({ where: { lockedUntil: { gt: new Date() } } }),
    prismaUnscoped.usageEvent.groupBy({
      by: ["companyId"],
      _count: { _all: true },
      where: { createdAt: { gte: d30 }, companyId: { not: null } },
      orderBy: { _count: { companyId: "desc" } },
      take: 10,
    }),
  ]);

  // ── Sales analytics (platform-wide) ──────────────────────────────────────
  const [invoiceAgg, receiptAgg, quotationCount, invoiceCount, paidInvoices, topRevenueRaw] = await Promise.all([
    prismaUnscoped.invoice.aggregate({ _sum: { totalAmount: true }, where: { status: { not: "Cancelled" } } }),
    prismaUnscoped.paymentReceipt.aggregate({ _sum: { amount: true } }),
    prismaUnscoped.quotation.count(),
    prismaUnscoped.invoice.count({ where: { status: { not: "Cancelled" } } }),
    prismaUnscoped.invoice.count({ where: { status: "Paid" } }),
    prismaUnscoped.invoice.groupBy({
      by: ["companyId"],
      _sum: { totalAmount: true },
      where: { status: { not: "Cancelled" } },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 8,
    }),
  ]);

  const invoiced = invoiceAgg._sum.totalAmount ?? 0;
  const received = Number(receiptAgg._sum.amount ?? 0);

  // 6-month revenue trend (invoiced by invoiceDate month).
  const revenueTrend: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date();
    start.setMonth(start.getMonth() - i, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const agg = await prismaUnscoped.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: "Cancelled" }, invoiceDate: { gte: start, lt: end } },
    });
    revenueTrend.push({ label: start.toLocaleString("default", { month: "short" }), value: Math.round(agg._sum.totalAmount ?? 0) });
  }

  const revNames = await prismaUnscoped.company.findMany({
    where: { id: { in: topRevenueRaw.map((t) => t.companyId) } },
    select: { id: true, name: true },
  });
  const revNameMap = Object.fromEntries(revNames.map((n) => [n.id, n.name]));

  // Mean resolution time (hours).
  const resHours = resolvedIssues
    .map((i) => (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 3_600_000)
    .filter((h) => h >= 0);
  const avgResolutionHours = resHours.length ? Math.round(resHours.reduce((a, b) => a + b, 0) / resHours.length) : 0;

  const names = await prismaUnscoped.company.findMany({
    where: { id: { in: topActive.map((t) => t.companyId as string) } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(names.map((n) => [n.id, n.name]));

  return NextResponse.json({
    growth: {
      totalCompanies,
      activeCompanies,
      activationRate: totalCompanies ? Math.round((onboardCompleted / totalCompanies) * 100) : 0,
      funnel: { completed: onboardCompleted, skipped: onboardSkipped, inProgress: onboardInProgress },
    },
    adoption: {
      totalUsers,
      activeUsers30d: activeUsers30d.length,
      stickiness: totalUsers ? Math.round((activeUsers30d.length / totalUsers) * 100) : 0,
      invoices: docVolume[0],
      quotations: docVolume[1],
      receipts: docVolume[2],
      topActive: topActive.map((t) => ({ id: t.companyId, name: nameMap[t.companyId as string] || t.companyId, events: t._count._all })),
    },
    support: {
      byStatus: Object.fromEntries(issuesByStatus.map((i) => [i.status, i._count._all])),
      byPriority: Object.fromEntries(issuesByPriority.map((i) => [i.priority, i._count._all])),
      avgResolutionHours,
      lockedUsers,
      disabledCompanies: totalCompanies - activeCompanies,
    },
    sales: {
      invoiced: Math.round(invoiced),
      received: Math.round(received),
      outstanding: Math.round(Math.max(0, invoiced - received)),
      collectionRate: invoiced > 0 ? Math.round((received / invoiced) * 100) : 0,
      invoiceCount,
      paidInvoices,
      quotationCount,
      conversionRate: quotationCount > 0 ? Math.round((invoiceCount / quotationCount) * 100) : 0,
      revenueTrend,
      topByRevenue: topRevenueRaw.map((t) => ({
        id: t.companyId,
        name: revNameMap[t.companyId] || t.companyId,
        revenue: Math.round(t._sum.totalAmount ?? 0),
      })),
    },
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
