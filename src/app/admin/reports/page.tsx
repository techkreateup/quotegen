"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card, StatCard, MiniBars } from "@/components/platform/ui";

const inr = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

interface Report {
  growth: {
    totalCompanies: number;
    activeCompanies: number;
    activationRate: number;
    funnel: { completed: number; skipped: number; inProgress: number };
  };
  adoption: {
    totalUsers: number;
    activeUsers30d: number;
    stickiness: number;
    invoices: number;
    quotations: number;
    receipts: number;
    topActive: { id: string; name: string; events: number }[];
  };
  support: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    avgResolutionHours: number;
    lockedUsers: number;
    disabledCompanies: number;
  };
  sales: {
    invoiced: number;
    received: number;
    outstanding: number;
    collectionRate: number;
    invoiceCount: number;
    paidInvoices: number;
    quotationCount: number;
    conversionRate: number;
    revenueTrend: { label: string; value: number }[];
    topByRevenue: { id: string; name: string; revenue: number }[];
  };
}

export default function ReportsPage() {
  const [r, setR] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/reports")
      .then((x) => x.json())
      .then((d) => (d.error ? setError(d.error) : setR(d)))
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  function exportCsv() {
    if (!r) return;
    const lines = [
      ["Metric", "Value"],
      ["Total companies", r.growth.totalCompanies],
      ["Active companies", r.growth.activeCompanies],
      ["Activation rate %", r.growth.activationRate],
      ["Onboarding completed", r.growth.funnel.completed],
      ["Onboarding skipped", r.growth.funnel.skipped],
      ["Onboarding in progress", r.growth.funnel.inProgress],
      ["Total users", r.adoption.totalUsers],
      ["Active users 30d", r.adoption.activeUsers30d],
      ["Stickiness %", r.adoption.stickiness],
      ["Invoices", r.adoption.invoices],
      ["Quotations", r.adoption.quotations],
      ["Receipts", r.adoption.receipts],
      ["Avg resolution (h)", r.support.avgResolutionHours],
      ["Locked users", r.support.lockedUsers],
      ["Disabled companies", r.support.disabledCompanies],
      ["Total invoiced (INR)", r.sales.invoiced],
      ["Total received (INR)", r.sales.received],
      ["Outstanding (INR)", r.sales.outstanding],
      ["Collection rate %", r.sales.collectionRate],
      ["Invoice count", r.sales.invoiceCount],
      ["Paid invoices", r.sales.paidInvoices],
      ["Quotations", r.sales.quotationCount],
      ["Quote→Invoice conversion %", r.sales.conversionRate],
      [],
      ["Top companies by revenue", "Revenue (INR)"],
      ...r.sales.topByRevenue.map((t) => [t.name, t.revenue]),
    ];
    const csv = lines.map((l) => l.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `quotegen-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fn = r?.growth.funnel;
  const fnTotal = fn ? fn.completed + fn.skipped + fn.inProgress : 0;

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Reports"
          subtitle="Growth, adoption, and support health across the platform"
          breadcrumbs={[{ label: "Platform" }, { label: "Reports" }]}
          action={
            <button onClick={exportCsv} disabled={!r} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              Export CSV
            </button>
          }
        />
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

      {/* Growth & activation */}
      <h2 className="text-sm font-bold text-slate-700 mb-3">Growth &amp; activation</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard loading={loading} label="Companies" value={r?.growth.totalCompanies ?? 0} />
        <StatCard loading={loading} label="Active" value={r?.growth.activeCompanies ?? 0} />
        <StatCard loading={loading} label="Activation rate" value={`${r?.growth.activationRate ?? 0}%`} />
        <StatCard loading={loading} label="In onboarding" value={r?.growth.funnel.inProgress ?? 0} />
      </div>
      <Card title="Onboarding funnel" className="mb-6">
        {fn && fnTotal > 0 ? (
          <div className="space-y-2">
            {([["Completed", fn.completed, "bg-emerald-500"], ["Skipped", fn.skipped, "bg-amber-400"], ["In progress", fn.inProgress, "bg-slate-300"]] as const).map(([label, val, color]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-24">{label}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color}`} style={{ width: `${Math.round((val / fnTotal) * 100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-600 w-10 text-right">{val}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-400">No data</p>}
      </Card>

      {/* Usage & adoption */}
      <h2 className="text-sm font-bold text-slate-700 mb-3">Usage &amp; adoption</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatCard loading={loading} label="Total users" value={r?.adoption.totalUsers ?? 0} />
        <StatCard loading={loading} label="Active (30d)" value={r?.adoption.activeUsers30d ?? 0} />
        <StatCard loading={loading} label="Stickiness" value={`${r?.adoption.stickiness ?? 0}%`} />
        <StatCard loading={loading} label="Invoices" value={r?.adoption.invoices ?? 0} />
        <StatCard loading={loading} label="Quotations" value={r?.adoption.quotations ?? 0} />
        <StatCard loading={loading} label="Receipts" value={r?.adoption.receipts ?? 0} />
      </div>
      <Card title="Most active companies (30d)" className="mb-6">
        {(r?.adoption.topActive ?? []).map((c) => (
          <div key={c.id} className="flex justify-between py-1 text-sm">
            <Link href={`/admin/companies/${c.id}`} className="text-indigo-600 hover:underline truncate mr-2">{c.name}</Link>
            <span className="font-semibold text-slate-800">{c.events}</span>
          </div>
        ))}
        {!loading && (r?.adoption.topActive ?? []).length === 0 && <p className="text-sm text-slate-400">No activity</p>}
      </Card>

      {/* Sales & revenue */}
      <h2 className="text-sm font-bold text-slate-700 mb-3">Sales &amp; revenue (platform-wide)</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatCard loading={loading} label="Invoiced" value={inr(r?.sales.invoiced ?? 0)} />
        <StatCard loading={loading} label="Received" value={inr(r?.sales.received ?? 0)} />
        <StatCard loading={loading} label="Outstanding" value={inr(r?.sales.outstanding ?? 0)} />
        <StatCard loading={loading} label="Collection" value={`${r?.sales.collectionRate ?? 0}%`} />
        <StatCard loading={loading} label="Conversion" value={`${r?.sales.conversionRate ?? 0}%`} hint="quote → invoice" />
        <StatCard loading={loading} label="Invoices" value={r?.sales.invoiceCount ?? 0} hint={`${r?.sales.paidInvoices ?? 0} paid`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Revenue invoiced — last 6 months" className="lg:col-span-2">
          {r ? <MiniBars data={r.sales.revenueTrend} color="#10B981" /> : <p className="text-sm text-slate-400">{loading ? "…" : "No data"}</p>}
        </Card>
        <Card title="Top companies by revenue">
          {(r?.sales.topByRevenue ?? []).map((c) => (
            <div key={c.id} className="flex justify-between py-1 text-sm">
              <Link href={`/admin/companies/${c.id}`} className="text-indigo-600 hover:underline truncate mr-2">{c.name}</Link>
              <span className="font-semibold text-slate-800">{inr(c.revenue)}</span>
            </div>
          ))}
          {!loading && (r?.sales.topByRevenue ?? []).length === 0 && <p className="text-sm text-slate-400">No revenue yet</p>}
        </Card>
      </div>

      {/* Support & health */}
      <h2 className="text-sm font-bold text-slate-700 mb-3">Support &amp; health</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard loading={loading} label="Open issues" value={(r?.support.byStatus?.OPEN ?? 0) + (r?.support.byStatus?.IN_PROGRESS ?? 0)} />
        <StatCard loading={loading} label="Avg resolution" value={`${r?.support.avgResolutionHours ?? 0}h`} />
        <StatCard loading={loading} label="Locked users" value={r?.support.lockedUsers ?? 0} />
        <StatCard loading={loading} label="Disabled companies" value={r?.support.disabledCompanies ?? 0} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Issues by status">
          {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
            <div key={s} className="flex justify-between py-1 text-sm">
              <span className="text-slate-500">{s.replace("_", " ")}</span>
              <span className="font-semibold text-slate-800">{r?.support.byStatus?.[s] ?? 0}</span>
            </div>
          ))}
        </Card>
        <Card title="Issues by priority">
          {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => (
            <div key={p} className="flex justify-between py-1 text-sm">
              <span className="text-slate-500">{p}</span>
              <span className="font-semibold text-slate-800">{r?.support.byPriority?.[p] ?? 0}</span>
            </div>
          ))}
        </Card>
      </div>
    </PlatformShell>
  );
}
