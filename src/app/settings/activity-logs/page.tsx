"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { ChevronDown, ChevronUp, Download, Search } from "lucide-react";

interface UserRef { id: string; name: string; email: string }
interface AuditEntry {
  id: string; userId: string; entity: string; entityId: string;
  action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; createdAt: string;
  ip: string | null; user: UserRef | null;
}

const ENTITIES = ["All", "User", "UserRole", "Invoice", "Quotation", "Client", "Employee", "Salary", "PaymentReceipt", "Vendor", "Transaction", "CreditNote", "Subscription", "Project"];
const ACTIONS_LIST = ["All", "CREATE", "UPDATE", "DELETE"];

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams({ page: String(page), limit: "40" });
    if (entityFilter !== "All") params.set("entity", entityFilter);
    if (actionFilter !== "All") params.set("action", actionFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    apiGet<{ logs: AuditEntry[]; total: number }>(`/api/settings/activity-logs?${params}`)
      .then(r => { setLogs(r.logs); setTotal(r.total); }).catch(() => {});
  };

  useEffect(() => { load(); }, [page, entityFilter, actionFilter, dateFrom, dateTo]);

  const fmtDate = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const exportCsv = () => {
    const rows = [["Timestamp", "User", "Action", "Entity", "Entity ID"].join(",")];
    logs.forEach(l => {
      rows.push([new Date(l.createdAt).toISOString(), l.user?.name || l.userId, l.action, l.entity, l.entityId].map(v => `"${v}"`).join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "activity-logs.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / 40);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Activity Logs"
        subtitle="Global audit trail of all user actions"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Activity Logs" }]}
        action={<button onClick={exportCsv} className="btn btn-outline"><Download size={14} /> Export CSV</button>}
      />

      {/* Filters */}
      <div className="card" style={{ padding: "12px 16px" }}>
        <div className="flex flex-wrap items-center gap-3">
          <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }} className="inp" style={{ width: "auto", height: 36, fontSize: 12, padding: "0 10px" }}>
            {ENTITIES.map(e => <option key={e} value={e}>{e === "All" ? "All Entities" : e}</option>)}
          </select>
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }} className="inp" style={{ width: "auto", height: 36, fontSize: 12, padding: "0 10px" }}>
            {ACTIONS_LIST.map(a => <option key={a} value={a}>{a === "All" ? "All Actions" : a}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>From</span>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="inp" style={{ width: "auto", height: 36, fontSize: 12, padding: "0 10px" }} />
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>To</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="inp" style={{ width: "auto", height: 36, fontSize: 12, padding: "0 10px" }} />
          </div>
          {(entityFilter !== "All" || actionFilter !== "All" || dateFrom || dateTo) && (
            <button onClick={() => { setEntityFilter("All"); setActionFilter("All"); setDateFrom(""); setDateTo(""); setPage(1); }}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", cursor: "pointer", background: "none", border: "none" }}>Clear filters</button>
          )}
          <span className="ml-auto" style={{ fontSize: 12, color: "var(--text-4)" }}>{total} total entries</span>
        </div>
      </div>

      {/* Log List */}
      <div className="card">
        {logs.map(log => (
          <div key={log.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
            <button
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              className="w-full text-left flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
              style={{ padding: "10px 16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                log.action === "CREATE" ? "bg-green-50 text-green-700" :
                log.action === "UPDATE" ? "bg-blue-50 text-blue-700" :
                "bg-red-50 text-red-700"
              }`}>{log.action}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)", minWidth: 0 }}>
                {log.entity} <span style={{ color: "var(--text-4)" }}>#{log.entityId.slice(-6)}</span>
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>by <span style={{ fontWeight: 600, color: "var(--text-2)" }}>{log.user?.name || "System"}</span></span>
              <span className="ml-auto" style={{ fontSize: 11, color: "var(--text-4)", flexShrink: 0 }}>{fmtDate(log.createdAt)}</span>
              {expanded === log.id ? <ChevronUp size={13} style={{ color: "var(--text-4)" }} /> : <ChevronDown size={13} style={{ color: "var(--text-4)" }} />}
            </button>
            {expanded === log.id && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ padding: "0 16px 12px" }}>
                {log.before && (
                  <div style={{ background: "#FEF2F2", borderRadius: "var(--radius)", padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", marginBottom: 4 }}>BEFORE</div>
                    <pre style={{ fontSize: 11, color: "var(--text-2)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(log.before, null, 2)}</pre>
                  </div>
                )}
                {log.after && (
                  <div style={{ background: "#ECFDF5", borderRadius: "var(--radius)", padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", marginBottom: 4 }}>AFTER</div>
                    <pre style={{ fontSize: 11, color: "var(--text-2)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(log.after, null, 2)}</pre>
                  </div>
                )}
                {log.ip && <div style={{ fontSize: 11, color: "var(--text-4)" }} className="col-span-full">IP: {log.ip}</div>}
              </div>
            )}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="empty">
            <div className="empty-icon"><Search size={20} /></div>
            <p style={{ fontSize: 13, color: "var(--text-4)" }}>No activity logs found</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2" style={{ padding: 16, borderTop: "1px solid var(--border-light)" }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-outline btn-sm">Previous</button>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-outline btn-sm">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
