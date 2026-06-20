"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";

interface IssueRow {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
  company: { id: string; name: string };
  reporter: { name: string; email: string };
  assignee: { id: string; name: string } | null;
  _count: { comments: number };
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

export default function SupportIssuesPage() {
  return (
    <Suspense>
      <IssuesContent />
    </Suspense>
  );
}

function IssuesContent() {
  const searchParams = useSearchParams();
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    assigneeId: "",
    companyId: searchParams.get("companyId") || "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/support/staff").then((r) => r.json()).then((d) => setStaff(d.staff ?? []));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
      const d = await fetch(`/api/support/issues?${params}`).then((r) => r.json());
      setIssues(d.issues ?? []);
      setLoading(false);
    })();
  }, [filters]);

  const selectCls = "h-9 px-2 rounded-lg border border-slate-300 text-sm";

  return (
    <PlatformShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <PageHeader
          title="Issue Queue"
          subtitle="Customer-reported issues across all companies"
          breadcrumbs={[{ label: "Platform" }, { label: "Issues" }]}
        />
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filter status" className={selectCls} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select aria-label="Filter priority" className={selectCls} value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
            <option value="">All priorities</option>
            {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select aria-label="Filter assignee" className={selectCls} value={filters.assigneeId} onChange={(e) => setFilters({ ...filters, assigneeId: e.target.value })}>
            <option value="">All assignees</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {filters.companyId && (
            <button onClick={() => setFilters({ ...filters, companyId: "" })} className="text-xs text-indigo-600 font-semibold hover:underline">
              Clear company filter ✕
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th className="px-4 py-2.5">Issue</th>
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Priority</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Assignee</th>
              <th className="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : issues.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No issues match these filters 🎉</td></tr>
            ) : (
              issues.map((i) => (
                <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <a href={`/support/issues/${i.id}`} className="font-semibold text-indigo-600 hover:underline">{i.title}</a>
                    <p className="text-xs text-slate-400">by {i.reporter.name} · {i._count.comments} comments</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.company.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[i.priority]}`}>{i.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[i.status]}`}>{i.status.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.assignee?.name ?? <span className="text-slate-300">unassigned</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(i.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}
