import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler() {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const invoices = await prisma.invoice.findMany({
      where: { invoiceDate: { gte: twelveMonthsAgo } },
      select: { totalAmount: true, invoiceDate: true, status: true, clientId: true, client: { select: { businessName: true } } },
    });

    // Monthly revenue (12 months)
    const monthlyRevenue: { month: string; label: string; amount: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const amount = invoices
        .filter((inv) => {
          const id = new Date(inv.invoiceDate);
          return id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth();
        })
        .reduce((s, inv) => s + inv.totalAmount, 0);
      monthlyRevenue.push({ month: key, label, amount });
    }

    // Top 5 clients by revenue
    const clientRevenue: Record<string, { name: string; total: number }> = {};
    for (const inv of invoices) {
      const cid = inv.clientId;
      if (!clientRevenue[cid]) clientRevenue[cid] = { name: inv.client.businessName, total: 0 };
      clientRevenue[cid].total += inv.totalAmount;
    }
    const topClients = Object.values(clientRevenue)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const inv of invoices) {
      statusBreakdown[inv.status] = (statusBreakdown[inv.status] || 0) + 1;
    }

    // This month vs last month
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthRevenue = invoices
      .filter((i) => new Date(i.invoiceDate) >= thisMonth)
      .reduce((s, i) => s + i.totalAmount, 0);
    const lastMonthRevenue = invoices
      .filter((i) => { const d = new Date(i.invoiceDate); return d >= lastMonth && d < thisMonth; })
      .reduce((s, i) => s + i.totalAmount, 0);
    const thisMonthCount = invoices.filter((i) => new Date(i.invoiceDate) >= thisMonth).length;
    const lastMonthCount = invoices.filter((i) => { const d = new Date(i.invoiceDate); return d >= lastMonth && d < thisMonth; }).length;

    return NextResponse.json({
      monthlyRevenue,
      topClients,
      statusBreakdown,
      comparison: { thisMonthRevenue, lastMonthRevenue, thisMonthCount, lastMonthCount },
    });
  } catch (e) {
    console.error("Analytics API error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
