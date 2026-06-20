"use client";

import { useEffect, useState } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard, MiniBars } from "@/components/platform/ui";

const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;
const pct = (n: number) => `${Math.round((n ?? 0) * 100)}%`;

interface Revenue {
  mrr: number;
  totalRevenue: number;
  activeSubscriptions: number;
  trialing: number;
  churnRate: number;
  conversionRate: number;
  statusCounts: Record<string, number>;
  byPlan: { plan: string; count: number }[];
  trend: { month: string; revenue: number }[];
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<Revenue | null>(null);

  useEffect(() => {
    fetch("/api/admin/revenue").then((r) => r.json()).then((d) => (d.error ? null : setData(d))).catch(() => {});
  }, []);

  return (
    <PlatformShell>
      <PageHeader title="Revenue" subtitle="Subscription revenue & growth metrics" breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Revenue" }]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="MRR (this month)" value={inr(data?.mrr ?? 0)} loading={!data} />
        <StatCard label="Total revenue" value={inr(data?.totalRevenue ?? 0)} loading={!data} />
        <StatCard label="Active subscriptions" value={data?.activeSubscriptions ?? 0} loading={!data} />
        <StatCard label="Trialing" value={data?.trialing ?? 0} loading={!data} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <StatCard label="Trial → Paid conversion" value={pct(data?.conversionRate ?? 0)} loading={!data} />
        <StatCard label="Monthly churn" value={pct(data?.churnRate ?? 0)} loading={!data} />
      </div>

      <Card title="Revenue trend (6 months)" className="mb-4">
        {data ? (
          <MiniBars data={data.trend.map((t) => ({ label: t.month, value: t.revenue }))} color="#10B981" />
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </Card>

      <Card title="Active subscriptions by plan">
        {data && data.byPlan.length > 0 ? (
          <div className="space-y-2">
            {data.byPlan.map((p) => (
              <div key={p.plan} className="flex justify-between text-sm">
                <span className="text-slate-600">{p.plan}</span>
                <span className="font-semibold text-slate-900">{p.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No active paid subscriptions yet.</p>
        )}
      </Card>
    </PlatformShell>
  );
}
