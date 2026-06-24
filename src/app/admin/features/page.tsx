"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/platform/ui";
import { FEATURE_CATEGORIES } from "@/lib/features";
import type { FeatureDef } from "@/lib/features";
import { Search, Download } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import { confirmDialog, alertDialog } from "@/components/Dialog";

interface Row {
  id: string;
  name: string;
  plan: string;
  isActive: boolean;
  features: Record<string, boolean>;
}

export default function FeatureFlagsPage() {
  const [companies, setCompanies] = useState<Row[]>([]);
  const [features, setFeatures] = useState<FeatureDef[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/admin/features").then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setCompanies(d.companies);
      setFeatures(d.features);
      setCounts(d.counts);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredCompanies = useMemo(() => {
    let rows = companies;
    if (q) {
      const lower = q.toLowerCase();
      rows = rows.filter((c) => c.name.toLowerCase().includes(lower));
    }
    if (planFilter) rows = rows.filter((c) => c.plan === planFilter);
    if (statusFilter === "active") rows = rows.filter((c) => c.isActive);
    else if (statusFilter === "inactive") rows = rows.filter((c) => !c.isActive);
    return rows;
  }, [companies, q, planFilter, statusFilter]);

  const filteredFeatures = useMemo(() => {
    if (!categoryFilter) return features;
    return features.filter((f) => f.category === categoryFilter);
  }, [features, categoryFilter]);

  // Recount based on filtered companies
  const filteredCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of filteredFeatures) {
      c[f.key] = filteredCompanies.filter((r) => r.features[f.key] !== false).length;
    }
    return c;
  }, [filteredCompanies, filteredFeatures]);

  async function toggle(companyId: string, key: string, on: boolean) {
    setBusy(`${companyId}:${key}`);
    setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, features: { ...c.features, [key]: !on } } : c)));
    const res = await fetch(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureOverrides: { [key]: !on } }),
    });
    setBusy(null);
    if (!res.ok) {
      (await alertDialog({ title: "Notice", message: (await res.json()).error || "Failed" }));
      load();
    } else {
      setCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + (on ? -1 : 1) }));
    }
  }

  function exportCSV() {
    const headers = ["Company", "Plan", "Status", ...filteredFeatures.map((f) => f.label)];
    const rows = filteredCompanies.map((c) => [
      c.name, c.plan, c.isActive ? "Active" : "Disabled",
      ...filteredFeatures.map((f) => c.features[f.key] !== false ? "ON" : "OFF"),
    ]);
    downloadCSV(`feature-flags-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  const plans = [...new Set(companies.map((c) => c.plan))].sort();

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Feature Flags"
          subtitle={`${filteredCompanies.length} of ${total} companies · ${filteredFeatures.length} features`}
          breadcrumbs={[{ label: "Platform" }, { label: "Feature Flags" }]}
          action={
            <button
              onClick={exportCSV}
              disabled={loading || filteredCompanies.length === 0}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={14} /> Export (CSV)
            </button>
          }
        />
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search companies…"
            aria-label="Search companies"
            className="h-9 pl-8 pr-3 rounded-lg border border-slate-300 text-sm w-full"
          />
        </div>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} aria-label="Filter by plan" className="h-9 px-2 rounded-lg border border-slate-300 text-sm">
          <option value="">All plans</option>
          {plans.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" className="h-9 px-2 rounded-lg border border-slate-300 text-sm">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Disabled</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category" className="h-9 px-2 rounded-lg border border-slate-300 text-sm">
          <option value="">All categories</option>
          {FEATURE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="p-4 text-slate-400">Loading…</p>
        ) : filteredCompanies.length === 0 ? (
          <p className="p-4 text-slate-400">No companies match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="sticky left-0 bg-white px-3 py-2.5 text-left text-[11px] uppercase tracking-wide text-slate-400 z-10 min-w-[180px]">
                    Company
                  </th>
                  {filteredFeatures.map((f) => (
                    <th key={f.key} className="px-2 py-2.5 text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                      <div>{f.label}</div>
                      <div className="text-[9px] text-slate-300 font-normal">{filteredCounts[f.key] ?? 0}/{filteredCompanies.length}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="sticky left-0 bg-white px-3 py-2 z-10">
                      <Link href={`/admin/companies/${c.id}`} className="font-semibold text-indigo-600 hover:underline">{c.name}</Link>
                      <div className="text-[10px] text-slate-400">{c.plan}{!c.isActive && " · disabled"}</div>
                    </td>
                    {filteredFeatures.map((f) => {
                      const on = c.features[f.key] !== false;
                      const key = `${c.id}:${f.key}`;
                      return (
                        <td key={f.key} className="px-2 py-2 text-center">
                          <button
                            role="switch"
                            aria-checked={on}
                            aria-label={`${on ? "Disable" : "Enable"} ${f.label} for ${c.name}`}
                            disabled={busy === key}
                            onClick={() => toggle(c.id, f.key, on)}
                            className={`w-9 h-5 rounded-full relative transition-colors disabled:opacity-40 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-400 mt-3">Tip: to bulk-set a company to a plan template, open its <strong>Features &amp; Plan</strong> tab and use &quot;Apply plan defaults&quot;.</p>
    </PlatformShell>
  );
}
