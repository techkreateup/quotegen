"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { AuditLogEntry } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import {
  Shield, ChevronDown, ChevronUp, Filter, ChevronLeft, ChevronRight,
  Plus, Edit2, Trash2, RefreshCw, ArrowRightLeft, AlertTriangle, Download,
} from "lucide-react";

const ENTITIES = ["All", "Client", "Invoice", "Quotation", "Employee", "Salary", "Voucher", "Vendor", "Subscription", "Project", "Transaction"];
const ACTIONS = ["All", "CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"];

const ACTION_ICON: Record<string, { icon: typeof Plus; color: string; bg: string }> = {
  CREATE:        { icon: Plus,           color: "#059669", bg: "#ECFDF5" },
  UPDATE:        { icon: Edit2,          color: "#2563EB", bg: "#EFF6FF" },
  DELETE:        { icon: Trash2,         color: "#DC2626", bg: "#FEF2F2" },
  STATUS_CHANGE: { icon: ArrowRightLeft, color: "#D97706", bg: "#FFFBEB" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Days until this entry is auto-deleted, given the createdAt and retention window.
function daysUntilDelete(createdAtIso: string, retentionDays: number): number {
  const deleteAt = new Date(createdAtIso).getTime() + retentionDays * 86_400_000;
  return Math.ceil((deleteAt - Date.now()) / 86_400_000);
}

function ExpiryBadge({ days }: { days: number }) {
  const urgent = days <= 2;
  const soon = days <= 5;
  const color = urgent ? "#DC2626" : soon ? "#D97706" : "#6B7280";
  const bg = urgent ? "#FEF2F2" : soon ? "#FFFBEB" : "#F3F4F6";
  const label = days <= 0 ? "deleting soon" : days === 1 ? "1 day left" : `${days} days left`;
  return (
    <span title="Time until automatic deletion" style={{ fontSize: 10.5, fontWeight: 600, color, background: bg, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function JsonDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  if (!before && !after) return <span style={{ color: "#9CA3AF", fontSize: 12 }}>No data recorded</span>;

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changes: { key: string; old: unknown; new_: unknown }[] = [];

  for (const key of allKeys) {
    const oldVal = before?.[key];
    const newVal = after?.[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ key, old: oldVal, new_: newVal });
    }
  }

  if (changes.length === 0) return <span style={{ color: "#9CA3AF", fontSize: 12 }}>No changes detected</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      {changes.slice(0, 10).map((c) => (
        <div key={c.key} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontWeight: 600, color: "#374151", minWidth: 100 }}>{c.key}</span>
          {c.old !== undefined && (
            <span style={{ color: "#DC2626", background: "#FEF2F2", padding: "1px 6px", borderRadius: 4, textDecoration: "line-through" }}>
              {String(c.old ?? "null").slice(0, 60)}
            </span>
          )}
          <span style={{ color: "#6B7280" }}>→</span>
          {c.new_ !== undefined && (
            <span style={{ color: "#059669", background: "#ECFDF5", padding: "1px 6px", borderRadius: 4 }}>
              {String(c.new_ ?? "null").slice(0, 60)}
            </span>
          )}
        </div>
      ))}
      {changes.length > 10 && <span style={{ color: "#9CA3AF" }}>+{changes.length - 10} more fields</span>}
    </div>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entityFilter, setEntityFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (entityFilter !== "All") params.set("entity", entityFilter);
      if (actionFilter !== "All") params.set("action", actionFilter);
      const data = await apiGet<{
        logs: AuditLogEntry[];
        total: number;
        page: number;
        totalPages: number;
        retentionDays: number;
      }>(`/api/audit-logs?${params.toString()}`);
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setRetentionDays(data.retentionDays);
    } catch {}
  }, [page, entityFilter, actionFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Track all changes across your company"
      />

      {retentionDays != null && (
        <div role="status" style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #FDE68A", background: "#FFFBEB", color: "#92400E", fontSize: 13 }}>
          <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>Audit logs are automatically deleted after <strong>{retentionDays} days</strong> to conserve storage. Export important records before they expire.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={14} style={{ color: "#6B7280" }} />
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          style={{
            padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D1D5E0",
            fontSize: 13, fontWeight: 500, background: "#fff", color: "#374151",
            cursor: "pointer", minHeight: 40,
          }}
        >
          {ENTITIES.map((e) => <option key={e} value={e}>{e === "All" ? "All Entities" : e}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          style={{
            padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D1D5E0",
            fontSize: 13, fontWeight: 500, background: "#fff", color: "#374151",
            cursor: "pointer", minHeight: 40,
          }}
        >
          {ACTIONS.map((a) => <option key={a} value={a}>{a === "All" ? "All Actions" : a}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "#9CA3AF", marginLeft: 8 }}>
          {total} record{total !== 1 ? "s" : ""}
        </span>
        <a
          href={`/api/audit-logs/export?${new URLSearchParams({
            ...(entityFilter !== "All" ? { entity: entityFilter } : {}),
            ...(actionFilter !== "All" ? { action: actionFilter } : {}),
          }).toString()}`}
          style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 14px", borderRadius: 8, border: "1.5px solid #4F46E5",
            background: "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 600,
            textDecoration: "none", minHeight: 40,
          }}
        >
          <Download size={14} /> Download CSV
        </a>
      </div>

      {/* Log list */}
      <div style={{ background: "#fff", border: "1.5px solid #D1D5E0", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 8px rgba(15,23,42,0.06)" }}>
        {logs.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <Shield size={32} style={{ color: "#D1D5DB", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, color: "#6B7280", fontWeight: 600 }}>No audit logs found</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Actions will be recorded as they happen</div>
          </div>
        ) : (
          logs.map((log) => {
            const cfg = ACTION_ICON[log.action] || ACTION_ICON.UPDATE;
            const Icon = cfg.icon;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} style={{ borderBottom: "1px solid #F5F6FA" }}>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 20px", cursor: "pointer",
                    transition: "background 120ms",
                    background: isExpanded ? "#FAFBFF" : "transparent",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "#F9FAFF"; }}
                  onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: cfg.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={14} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                      <span style={{ color: cfg.color, fontWeight: 700 }}>{log.action}</span>
                      <span style={{ color: "#D1D5E0", margin: "0 6px" }}>·</span>
                      <span>{log.entity}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2 }}>
                      by {log.userName || "System"} · {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                  {retentionDays != null && <ExpiryBadge days={daysUntilDelete(log.createdAt, retentionDays)} />}
                  <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "monospace", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.entityId.slice(0, 12)}...
                  </span>
                  {isExpanded ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                </div>

                {isExpanded && (
                  <div style={{ padding: "8px 20px 16px 66px", background: "#FAFBFF" }}>
                    <JsonDiff
                      before={log.before as Record<string, unknown> | null}
                      after={log.after as Record<string, unknown> | null}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: "10px 16px", borderRadius: 8, border: "1.5px solid #D1D5E0",
              background: "#fff", cursor: page === 1 ? "default" : "pointer",
              opacity: page === 1 ? 0.4 : 1,
              display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, minHeight: 44,
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: 13, color: "#6B7280" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: "10px 16px", borderRadius: 8, border: "1.5px solid #D1D5E0",
              background: "#fff", cursor: page === totalPages ? "default" : "pointer",
              opacity: page === totalPages ? 0.4 : 1,
              display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, minHeight: 44,
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
