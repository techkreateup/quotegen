"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { FileText, FolderOpen } from "lucide-react";

interface Doc { id: string; code: string; name: string; category: string; status: string; format: string; createdAt: string; }

const STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#f1f5f9", fg: "#475569", label: "Draft" },
  pending_approval: { bg: "#fef3c7", fg: "#b45309", label: "Pending" },
  approved: { bg: "#dcfce7", fg: "#15803d", label: "Approved" },
  rejected: { bg: "#fee2e2", fg: "#b91c1c", label: "Rejected" },
};

// Documents linked to a given employee / client / project. Embedded on the
// entity detail pages so a record's paperwork lives alongside it.
export default function EntityDocuments({ entity, id }: { entity: "employee" | "client" | "project"; id: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const param = `${entity}Id`;

  useEffect(() => {
    apiGet<{ documents: Doc[] }>(`/api/documents?${param}=${id}`)
      .then((d) => setDocs(d.documents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [param, id]);

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="sec-title" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>
          <span className="inline-flex items-center gap-1.5"><FolderOpen size={15} /> Documents ({docs.length})</span>
        </h3>
        <Link href={`/documents?${param}=${id}`} className="text-[12.5px] font-semibold text-indigo-600">View vault →</Link>
      </div>
      {loading ? (
        <p style={{ fontSize: 12.5, color: "var(--text-4)" }}>Loading…</p>
      ) : docs.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-4)" }}>No documents linked to this record yet.</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map((d) => {
            const st = STATUS[d.status] || STATUS.approved;
            return (
              <Link key={d.id} href={`/documents/${d.id}`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50" style={{ textDecoration: "none" }}>
                <FileText size={15} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }} className="truncate">{d.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{d.code} · {d.category}</div>
                </div>
                <span style={{ background: st.bg, color: st.fg, fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }} className="shrink-0">{st.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
