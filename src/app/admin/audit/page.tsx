"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Badge, EmptyRow } from "@/components/platform/ui";
import { downloadCSV } from "@/lib/csv";
import { AlertTriangle, Download } from "lucide-react";

interface Log {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  actor: { name: string; email: string; role: string } | null;
  company: { id: string; name: string } | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

function actionTone(a: string): "green" | "red" | "amber" | "slate" | "indigo" {
  if (/CREATE|ENABLE|ACTIVATE|UNLOCK/i.test(a)) return "green";
  if (/DELETE|DISABLE|DEACTIVATE/i.test(a)) return "red";
  if (/RESET|PLAN|FEATURE/i.test(a)) return "amber";
  return "indigo";
}

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [retention, setRetention] = useState("15");
  const [savingRetention, setSavingRetention] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => { if (d.settings?.audit_retention_days) setRetention(String(d.settings.audit_retention_days)); })
      .catch(() => {});
  }, []);

  async function changeRetention(value: string) {
    setRetention(value);
    setSavingRetention(true);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "audit_retention_days", value }),
    }).catch(() => {});
    setSavingRetention(false);
  }

  function exportCSV() {
    const headers = ["Date", "Actor", "Email", "Action", "Entity", "Company", "IP"];
    const rows = logs.map((l) => [
      new Date(l.createdAt).toLocaleString(),
      l.actor?.name ?? "system",
      l.actor?.email ?? "",
      l.action,
      l.entity,
      l.company?.name ?? "platform",
      l.ip ?? "",
    ]);
    downloadCSV(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entity) params.set("entity", entity);
      if (action) params.set("action", action);
      params.set("page", String(page));
      const d = await fetch(`/api/admin/audit?${params}`).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setLogs(d.logs);
      setPages(d.pages);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [entity, action, page]);

  useEffect(() => { load(); }, [entity, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Audit & Security"
          subtitle={`${total} logged action${total === 1 ? "" : "s"} across the platform`}
          breadcrumbs={[{ label: "Platform" }, { label: "Audit" }]}
          action={
            <button
              onClick={exportCSV}
              disabled={logs.length === 0}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={14} /> Export (CSV)
            </button>
          }
        />
      </div>

      <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>Audit logs are automatically deleted after <strong>{retention} days</strong>. Download logs before they expire.</span>
      </div>

      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 flex flex-wrap gap-2 border-b border-slate-100">
          <select value={entity} onChange={(e) => { setPage(1); setEntity(e.target.value); }} aria-label="Filter by entity" className="h-9 px-2 rounded-lg border border-slate-300 text-sm">
            <option value="">All entities</option>
            <option value="Company">Company</option>
            <option value="User">User</option>
            <option value="Invoice">Invoice</option>
            <option value="Quotation">Quotation</option>
          </select>
          <input value={action} onChange={(e) => setAction(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())} placeholder="Action contains…" aria-label="Filter by action" className="h-9 px-3 rounded-lg border border-slate-300 text-sm" />
          <button onClick={() => { setPage(1); load(); }} className="h-9 px-3 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900">Filter</button>
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            Retention
            <select
              value={retention}
              onChange={(e) => changeRetention(e.target.value)}
              disabled={savingRetention}
              aria-label="Audit log retention period"
              className="h-9 px-2 rounded-lg border border-slate-300 text-sm disabled:opacity-50"
            >
              <option value="15">15 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Actor</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Entity</th>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={6} label="Loading…" />
              ) : logs.length === 0 ? (
                <EmptyRow colSpan={6} label="No audit entries" />
              ) : (
                logs.map((l) => (
                  <Fragment key={l.id}>
                    <tr className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {l.actor ? (
                          <>
                            <p className="text-slate-700 font-medium">{l.actor.name}</p>
                            <p className="text-xs text-slate-400">{l.actor.email}</p>
                          </>
                        ) : <span className="text-slate-400">system</span>}
                      </td>
                      <td className="px-4 py-3"><Badge tone={actionTone(l.action)}>{l.action}</Badge></td>
                      <td className="px-4 py-3 text-slate-600">{l.entity}</td>
                      <td className="px-4 py-3">
                        {l.company ? <Link href={`/admin/companies/${l.company.id}`} className="text-indigo-600 hover:underline">{l.company.name}</Link> : <span className="text-slate-400">platform</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Boolean(l.before || l.after) && (
                          <button onClick={() => setExpanded(expanded === l.id ? null : l.id)} className="text-xs font-semibold text-indigo-600 hover:underline">
                            {expanded === l.id ? "Hide" : "Details"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === l.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div><p className="font-semibold text-slate-500 mb-1">Before</p><pre className="bg-white border border-slate-200 rounded-lg p-2 overflow-x-auto">{JSON.stringify(l.before ?? {}, null, 2)}</pre></div>
                            <div><p className="font-semibold text-slate-500 mb-1">After</p><pre className="bg-white border border-slate-200 rounded-lg p-2 overflow-x-auto">{JSON.stringify(l.after ?? {}, null, 2)}</pre></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="p-3 flex items-center justify-between border-t border-slate-100 text-sm">
            <span className="text-slate-400">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40">Prev</button>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </PlatformShell>
  );
}
