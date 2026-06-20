"use client";

import { useEffect, useState } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Search } from "lucide-react";

interface CompanyRow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  onboarding: string;
  adminContact: { name: string; email: string } | null;
  users: number;
  openIssues: number;
}

export default function SupportCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const d = await fetch(`/api/support/companies${params}`).then((r) => r.json());
    setCompanies(d.companies ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PlatformShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <PageHeader
          title="Customer Companies"
          subtitle="Onboarding status and contacts for every workspace"
          breadcrumbs={[{ label: "Platform" }, { label: "Companies" }]}
        />
        <div className="relative shrink-0">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search…"
            aria-label="Search companies"
            className="h-9 pl-8 pr-3 rounded-lg border border-slate-300 text-sm w-56"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Admin contact</th>
              <th className="px-4 py-2.5">Users</th>
              <th className="px-4 py-2.5">Onboarding</th>
              <th className="px-4 py-2.5">Open issues</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No companies found</td></tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400">since {new Date(c.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-4 py-3">
                    {c.adminContact ? (
                      <>
                        <p className="text-slate-700">{c.adminContact.name}</p>
                        <p className="text-xs text-slate-400">{c.adminContact.email}</p>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.users}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${c.onboarding === "completed" ? "text-emerald-600" : c.onboarding === "skipped" ? "text-amber-600" : "text-slate-500"}`}>
                      {c.onboarding}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.openIssues > 0 ? (
                      <a href={`/support/issues?companyId=${c.id}`} className="font-bold text-red-600 hover:underline">{c.openIssues}</a>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {c.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}
