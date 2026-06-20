"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { StatCard, Card, MiniBars } from "@/components/platform/ui";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface Analytics {
  totals: {
    companies: number;
    activeCompanies: number;
    inactiveCompanies: number;
    users: number;
    activeUsers7d: number;
    signups30d: number;
    signupTrendPct: number;
    onboardingCompletionRate: number;
    urgentOpenIssues: number;
  };
  issues: Record<string, number>;
  plans: Record<string, number>;
  monthlySignups: { label: string; signups: number }[];
  featureUsage: { event: string; count: number }[];
  companyActivity: { companyId: string; name: string; events: number }[];
  dormantCompanies: { id: string; name: string; createdAt: string }[];
}

export default function AdminDashboard() {
  const [a, setA] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setA(d)))
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const t = a?.totals;
  const openIssues = (a?.issues?.OPEN ?? 0) + (a?.issues?.IN_PROGRESS ?? 0);

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Platform Dashboard"
          subtitle="Health, growth, and risk across every company on QuoteGen"
          breadcrumbs={[{ label: "Platform" }, { label: "Dashboard" }]}
        />
      </div>
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}

      {/* Alert strip */}
      {t && (t.inactiveCompanies > 0 || t.urgentOpenIssues > 0 || (a?.dormantCompanies.length ?? 0) > 0) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {t.urgentOpenIssues > 0 && (
            <Link href="/support/issues" className="flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-100">
              <AlertTriangle size={15} /> {t.urgentOpenIssues} urgent issue{t.urgentOpenIssues > 1 ? "s" : ""} open
            </Link>
          )}
          {(a?.dormantCompanies.length ?? 0) > 0 && (
            <span className="flex items-center gap-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={15} /> {a!.dormantCompanies.length} dormant compan{a!.dormantCompanies.length > 1 ? "ies" : "y"} (no activity 30d)
            </span>
          )}
          {t.inactiveCompanies > 0 && (
            <Link href="/admin/companies?status=inactive" className="flex items-center gap-2 text-sm font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-100">
              {t.inactiveCompanies} disabled compan{t.inactiveCompanies > 1 ? "ies" : "y"}
            </Link>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard loading={loading} label="Companies" value={t?.companies ?? 0} hint={`${t?.activeCompanies ?? 0} active`} />
        <StatCard loading={loading} label="Users" value={t?.users ?? 0} />
        <StatCard loading={loading} label="Active users (7d)" value={t?.activeUsers7d ?? 0} />
        <StatCard loading={loading} label="Signups (30d)" value={t?.signups30d ?? 0} trend={t?.signupTrendPct ?? 0} />
        <StatCard loading={loading} label="Onboarded" value={t != null ? `${t.onboardingCompletionRate}%` : "0%"} />
        <StatCard loading={loading} label="Open issues" value={openIssues} hint={`${t?.urgentOpenIssues ?? 0} urgent`} />
      </div>

      {/* Trend + plan mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Signups — last 6 months" className="lg:col-span-2">
          {a ? (
            <MiniBars data={a.monthlySignups.map((m) => ({ label: m.label, value: m.signups }))} />
          ) : (
            <p className="text-sm text-slate-400">{loading ? "…" : "No data"}</p>
          )}
        </Card>
        <Card title="Plan mix">
          {["Starter", "Professional", "Enterprise"].map((p) => (
            <div key={p} className="flex justify-between py-1.5 text-sm">
              <span className="text-slate-500">{p}</span>
              <span className="font-semibold text-slate-800">{a?.plans?.[p] ?? 0}</span>
            </div>
          ))}
          <Link href="/admin/plans" className="text-xs font-semibold text-indigo-600 hover:underline mt-2 inline-flex items-center gap-1">
            Manage plans <ArrowRight size={12} />
          </Link>
        </Card>
      </div>

      {/* Activity / dormant / feature usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Most active companies (30d)">
          {(a?.companyActivity ?? []).slice(0, 6).map((c) => (
            <div key={c.companyId} className="flex justify-between py-1 text-sm">
              <Link href={`/admin/companies/${c.companyId}`} className="text-indigo-600 hover:underline truncate mr-2">{c.name}</Link>
              <span className="font-semibold text-slate-800">{c.events}</span>
            </div>
          ))}
          {!loading && (a?.companyActivity ?? []).length === 0 && <p className="text-sm text-slate-400">No activity yet</p>}
        </Card>

        <Card title="Dormant companies (no activity 30d)">
          {(a?.dormantCompanies ?? []).slice(0, 6).map((c) => (
            <div key={c.id} className="flex justify-between py-1 text-sm">
              <Link href={`/admin/companies/${c.id}`} className="text-amber-700 hover:underline truncate mr-2">{c.name}</Link>
              <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
          {!loading && (a?.dormantCompanies ?? []).length === 0 && <p className="text-sm text-emerald-600">All companies active 🎉</p>}
          <Link href="/admin/inactive" className="text-xs font-semibold text-indigo-600 hover:underline mt-2 inline-flex items-center gap-1">
            Track & nudge inactive <ArrowRight size={12} />
          </Link>
        </Card>

        <Card title="Feature usage (30d)">
          {(a?.featureUsage ?? []).slice(0, 6).map((f) => (
            <div key={f.event} className="flex justify-between py-1 text-sm">
              <span className="text-slate-500 truncate mr-2">{f.event}</span>
              <span className="font-semibold text-slate-800">{f.count}</span>
            </div>
          ))}
          {!loading && (a?.featureUsage ?? []).length === 0 && <p className="text-sm text-slate-400">No events yet</p>}
        </Card>
      </div>
    </PlatformShell>
  );
}
