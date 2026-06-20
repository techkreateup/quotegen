"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { User, Mail, Shield, Clock, Calendar, ChevronDown, ChevronUp } from "lucide-react";

interface UserData {
  id: string; name: string; email: string; isActive: boolean;
  roleId: string | null; userRole: { id: string; name: string } | null;
  mustResetPassword: boolean; lastLoginAt: string | null; createdAt: string;
}

interface AuditEntry {
  id: string; entity: string; entityId: string; action: string;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null; createdAt: string; ip: string | null;
}

const ENTITIES = ["All", "User", "Invoice", "Quotation", "Client", "Employee", "Salary", "PaymentReceipt", "Vendor", "Transaction", "CreditNote"];
const ACTIONS_LIST = ["All", "CREATE", "UPDATE", "DELETE"];

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserData | null>(null);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ user: UserData }>(`/api/settings/users/${id}`).then(r => setUser(r.user)).catch(() => {});
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (entityFilter !== "All") params.set("entity", entityFilter);
    if (actionFilter !== "All") params.set("action", actionFilter);
    apiGet<{ logs: AuditEntry[]; total: number }>(`/api/settings/users/${id}/activity?${params}`)
      .then(r => { setLogs(r.logs); setTotal(r.total); }).catch(() => {});
  }, [id, page, entityFilter, actionFilter]);

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  if (!user) return <div style={{ padding: 32, textAlign: "center", color: "var(--text-4)" }}>Loading...</div>;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={user.name}
        subtitle="User profile and activity"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Users", href: "/settings/users" }, { label: user.name }]}
      />

      {/* Profile Card */}
      <div className="card" style={{ padding: 20 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="av av-md" style={{ background: "var(--primary-light)" }}><User size={16} style={{ color: "var(--primary)" }} /></div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-4)", fontWeight: 500 }}>Name</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{user.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="av av-md" style={{ background: "#EFF6FF" }}><Mail size={16} style={{ color: "#2563EB" }} /></div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-4)", fontWeight: 500 }}>Email</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="av av-md" style={{ background: "#F5F3FF" }}><Shield size={16} style={{ color: "#7C3AED" }} /></div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-4)", fontWeight: 500 }}>Role</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{user.userRole?.name || "No Role"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="av av-md" style={{ background: "#ECFDF5" }}><Clock size={16} style={{ color: "var(--success)" }} /></div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-4)", fontWeight: 500 }}>Status</div>
              <div className="flex items-center gap-2">
                <StatusBadge status={user.isActive ? "Active" : "Inactive"} />
                {user.mustResetPassword && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600">Must Reset PW</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-6" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-light)", fontSize: 12, color: "var(--text-3)" }}>
          <span className="flex items-center gap-1.5"><Calendar size={12} /> Joined {fmtDate(user.createdAt)}</span>
          <span className="flex items-center gap-1.5"><Clock size={12} /> Last login {fmtDate(user.lastLoginAt)}</span>
        </div>
      </div>

      {/* Activity Log */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-light)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Activity Log <span style={{ color: "var(--text-4)", fontWeight: 400, fontSize: 12 }}>({total} entries)</span></h3>
          <div className="flex items-center gap-2">
            <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }} className="inp" style={{ width: "auto", height: 34, fontSize: 12, padding: "0 10px" }}>
              {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }} className="inp" style={{ width: "auto", height: 34, fontSize: 12, padding: "0 10px" }}>
              {ACTIONS_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {logs.map(log => (
          <div key={log.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
            <button
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              className="w-full text-left flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
              style={{ padding: "10px 16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                log.action === "CREATE" ? "bg-green-50 text-green-700" :
                log.action === "UPDATE" ? "bg-blue-50 text-blue-700" :
                "bg-red-50 text-red-700"
              }`}>{log.action}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)", flex: 1 }}>{log.entity} <span style={{ color: "var(--text-4)" }}>#{log.entityId.slice(-6)}</span></span>
              <span style={{ fontSize: 11, color: "var(--text-4)" }}>{fmtDate(log.createdAt)}</span>
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
              </div>
            )}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="empty">
            <p style={{ fontSize: 13, color: "var(--text-4)" }}>No activity found</p>
          </div>
        )}

        {total > 30 && (
          <div className="flex items-center justify-center gap-2" style={{ padding: 16, borderTop: "1px solid var(--border-light)" }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-outline btn-sm">Previous</button>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Page {page} of {Math.ceil(total / 30)}</span>
            <button disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)} className="btn btn-outline btn-sm">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
