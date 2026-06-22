"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Badge, EmptyRow } from "@/components/platform/ui";
import { Search, ChevronUp, ChevronDown, Download } from "lucide-react";

function SortTh({ label, k, sortKey, sortDir, onSort }: {
  label: string; k: keyof CompanyRow; sortKey: keyof CompanyRow; sortDir: "asc" | "desc"; onSort: (k: keyof CompanyRow) => void;
}) {
  const active = sortKey === k;
  return (
    <th className="px-4 py-2.5">
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 uppercase tracking-wide ${active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}>
        {label}
        {active && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </button>
    </th>
  );
}

interface CompanyRow {
  id: string;
  code: string | null;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  maxUsers: number | null;
  featuresEnabled: number;
  featuresTotal: number;
  createdAt: string;
  onboardingCompletedAt: string | null;
  onboardingSkipped: boolean;
  users: number;
  clients: number;
  invoices: number;
  issues: number;
}

export default function CompaniesListPage() {
  return (
    <Suspense>
      <CompaniesListInner />
    </Suspense>
  );
}

function CompaniesListInner() {
  const initialStatus = useSearchParams().get("status") ?? "";
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<keyof CompanyRow>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: keyof CompanyRow) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...companies].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (plan) params.set("plan", plan);
      const c = await fetch(`/api/admin/companies?${params}`).then((r) => r.json());
      if (c.error) throw new Error(c.error);
      setCompanies(c.companies ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [q, status, plan]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, plan]);

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Companies"
          subtitle={`${companies.length} ${companies.length === 1 ? "company" : "companies"} on the platform`}
          breadcrumbs={[{ label: "Platform" }, { label: "Companies" }]}
          action={
            <a
              href={`/api/admin/companies/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(plan ? { plan } : {}) })}`}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 inline-flex items-center gap-1.5 no-underline"
            >
              <Download size={14} /> Export (CSV)
            </a>
          }
        />
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search companies…"
              aria-label="Search companies"
              className="h-9 pl-8 pr-3 rounded-lg border border-slate-300 text-sm w-full"
            />
          </div>
          <div className="flex gap-2">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Filter by plan" className="h-9 px-2 rounded-lg border border-slate-300 text-sm">
              <option value="">All plans</option>
              <option value="Starter">Starter</option>
              <option value="Professional">Professional</option>
              <option value="Enterprise">Enterprise</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="h-9 px-2 rounded-lg border border-slate-300 text-sm">
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Disabled</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <SortTh label="Company" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Plan" k="plan" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Users" k="users" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Invoices" k="invoices" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Issues" k="issues" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Features" k="featuresEnabled" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-2.5">Onboarding</th>
                <SortTh label="Status" k="isActive" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={8} label="Loading…" />
              ) : sorted.length === 0 ? (
                <EmptyRow colSpan={8} label="No companies found" />
              ) : (
                sorted.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/companies/${c.id}`} className="font-semibold text-indigo-600 hover:underline">{c.name}</Link>
                      <p className="text-xs text-slate-400">{c.code ? <span className="font-mono font-semibold text-slate-500">{c.code}</span> : null} · since {new Date(c.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3"><Badge tone="indigo">{c.plan}</Badge></td>
                    <td className="px-4 py-3">{c.users}{c.maxUsers != null && <span className="text-slate-400">/{c.maxUsers}</span>}</td>
                    <td className="px-4 py-3">{c.invoices}</td>
                    <td className="px-4 py-3">{c.issues}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.featuresEnabled}/{c.featuresTotal}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.onboardingCompletedAt ? (
                        <span className="text-emerald-600 font-semibold">Completed</span>
                      ) : c.onboardingSkipped ? (
                        <span className="text-amber-600 font-semibold">Skipped</span>
                      ) : (
                        <span className="text-slate-400">In progress</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.isActive ? "green" : "red"}>{c.isActive ? "Active" : "Disabled"}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PlatformShell>
  );
}
