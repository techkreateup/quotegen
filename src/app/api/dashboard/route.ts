import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getPendingApprovalsForUser } from "@/lib/workflow";

async function GET_handler(request: NextRequest) {
  try {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      clientCount,
      employeeCount,
      activeProjectCount,
      activeSubCount,
      vendorCount,
      invoices,
      quotations,
      receipts,
      transactions,
      salaryPending,
      overdueInvoices,
      upcomingRenewals,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.employee.count({ where: { status: "Active" } }),
      prisma.project.count({ where: { status: { in: ["Pending", "InProgress"] } } }),
      prisma.subscription.count({ where: { status: "Active" } }),
      prisma.vendor.count(),
      prisma.invoice.findMany({
        where: { deletedAt: null },
        select: { totalAmount: true, status: true, invoiceDate: true, createdAt: true },
      }),
      prisma.quotation.findMany({
        where: { deletedAt: null },
        select: { totalAmount: true, status: true, createdAt: true },
      }),
      prisma.paymentReceipt.findMany({
        select: { amount: true, receiptDate: true },
      }),
      prisma.transaction.findMany({
        where: { date: { gte: sixMonthsAgo } },
        select: { date: true, amount: true, direction: true, type: true },
        orderBy: { date: "asc" },
      }),
      prisma.salaryRecord.count({ where: { status: "Pending" } }),
      prisma.invoice.count({
        where: {
          status: { in: ["Unpaid", "Overdue"] },
          dueDate: { lt: now },
        },
      }),
      prisma.subscription.count({
        where: {
          status: "Active",
          nextRenewalDate: { lte: new Date(now.getTime() + 7 * 86400000) },
        },
      }),
    ]);

    const totalRevenue = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const paidAmount = receipts.reduce((s, r) => s + Number(r.amount), 0);
    const unpaidAmount = invoices
      .filter((i) => i.status === "Unpaid" || i.status === "Overdue")
      .reduce((s, i) => s + i.totalAmount, 0);

    const thisMonthRevenue = invoices
      .filter((i) => new Date(i.invoiceDate) >= thisMonth)
      .reduce((s, i) => s + i.totalAmount, 0);

    const quotationsWon = quotations.filter((q) => q.status === "Won").length;
    const quotationsPending = quotations.filter(
      (q) => q.status === "Created" || q.status === "Sent"
    ).length;

    const monthlyData: Record<string, { income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = { income: 0, expense: 0 };
    }

    for (const t of transactions) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyData[key]) {
        if (t.direction === "IN") monthlyData[key].income += t.amount;
        else monthlyData[key].expense += t.amount;
      }
    }

    const monthlyTrend = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      }),
      ...data,
    }));

    const expenseByType: Record<string, number> = {};
    for (const t of transactions) {
      if (t.direction === "OUT") {
        expenseByType[t.type] = (expenseByType[t.type] || 0) + t.amount;
      }
    }

    const userId = request.headers.get("x-user-id") || "";
    let pendingApprovals: unknown[] = [];
    if (userId) {
      try { pendingApprovals = await getPendingApprovalsForUser(userId); } catch {}
    }

    return NextResponse.json({
      pendingApprovals: pendingApprovals.length,
      stats: {
        totalRevenue,
        paidAmount,
        unpaidAmount,
        thisMonthRevenue,
        totalClients: clientCount,
        totalEmployees: employeeCount,
        activeProjects: activeProjectCount,
        activeSubscriptions: activeSubCount,
        totalVendors: vendorCount,
        totalInvoices: invoices.length,
        totalQuotations: quotations.length,
        quotationsWon,
        quotationsPending,
        salaryPending,
        overdueInvoices,
        upcomingRenewals,
      },
      monthlyTrend,
      expenseByType,
    });
  } catch (e: unknown) {
    console.error("Dashboard API error:", e);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
