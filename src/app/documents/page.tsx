"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useUploadThing } from "@/lib/uploadthing-client";
import {
  FileText, Upload, Trash2, Download, Search, Loader2, AlertTriangle, HardDrive, CalendarClock,
} from "lucide-react";

interface Doc {
  id: string;
  name: string;
  fileUrl: string;
  format: string;
  sizeBytes: number;
  category: string;
  description: string;
  expiresAt: string | null;
  uploadedByName: string;
  createdAt: string;
}

interface Storage {
  companyBytes: number;
  globalBytes: number;
  limitBytes: number;
  safetyBytes: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

const CATEGORIES = ["Onboarding", "HR", "Legal", "Finance", "Payroll", "Compliance", "Tax", "Personal", "Other"];
const CAT_COLOR: Record<string, string> = {
  Onboarding: "#0ea5e9", HR: "#8b5cf6", Legal: "#ef4444", Finance: "#10b981",
  Payroll: "#f59e0b", Compliance: "#ec4899", Tax: "#6366f1", Personal: "#64748b", Other: "#94a3b8",
};

function expiryBadge(expiresAt: string | null) {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Expired", color: "#dc2626", bg: "#fef2f2" };
  if (days <= 30) return { label: `${days}d left`, color: "#b45309", bg: "#fffbeb" };
  return { label: new Date(expiresAt).toLocaleDateString(), color: "#64748b", bg: "#f8fafc" };
}

export default function DocumentsPage() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Other");
  const [uploadExpiry, setUploadExpiry] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "All") params.set("category", filter);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/documents?${params}`);
    const data = await res.json();
    setDocs(data.documents ?? []);
    setStorage(data.storage ?? null);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q]);

  const { startUpload, isUploading } = useUploadThing("document", {
    onClientUploadComplete: () => {
      toast.success("Document uploaded");
      setUploadExpiry("");
      load();
    },
    onUploadError: (e) => toast.error(e.message || "Upload failed"),
  });

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This permanently removes the file.`)) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Deleted");
      load();
    } else {
      toast.error("Delete failed");
    }
  }

  const usedPct = useMemo(() => {
    if (!storage) return 0;
    return Math.min(100, Math.round((storage.globalBytes / storage.limitBytes) * 100));
  }, [storage]);

  const nearFull = usedPct >= 90;
  const expiringSoon = docs.filter((d) => {
    const b = expiryBadge(d.expiresAt);
    return b && (b.label === "Expired" || b.label.endsWith("d left"));
  }).length;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Document Vault"
        subtitle="One secure home for every company, HR, legal, payroll & compliance document"
      />

      {/* Storage + expiry summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card" style={{ padding: 16 }}>
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={15} className="text-indigo-500" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Storage</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>
              {storage ? `${formatBytes(storage.globalBytes)} / ${formatBytes(storage.limitBytes)}` : "—"}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
            <div style={{ width: `${usedPct}%`, height: "100%", background: nearFull ? "#dc2626" : "#6366f1", transition: "width .3s" }} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 6 }}>
            This company: {storage ? formatBytes(storage.companyBytes) : "—"}
            {nearFull && <span style={{ color: "#dc2626", fontWeight: 600 }}> · Almost full — delete old files</span>}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock size={15} className="text-amber-500" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Expiry watch</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: expiringSoon ? "#b45309" : "var(--text-1)" }}>{expiringSoon}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>documents expired or expiring within 30 days</div>
        </div>
      </div>

      {/* Upload */}
      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="lbl">Category</label>
            <select className="inp" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} style={{ minWidth: 150 }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Expiry (optional)</label>
            <input type="date" className="inp" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} />
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading || nearFull}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {isUploading ? "Uploading…" : "Upload document"}
          </button>
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>PDF, image, or office file · up to 16MB</span>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              startUpload([file], {
                category: uploadCategory as never,
                expiresAt: uploadExpiry || undefined,
              });
            }}
          />
        </div>
        {nearFull && (
          <div className="flex items-center gap-2 mt-3 text-[12px]" style={{ color: "#dc2626" }}>
            <AlertTriangle size={14} /> Storage is nearly full. Delete some documents before uploading.
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className="px-3 h-8 rounded-full text-[12.5px] font-semibold transition-colors"
            style={{
              background: filter === c ? "#4f46e5" : "#fff",
              color: filter === c ? "#fff" : "var(--text-2)",
              border: "1px solid " + (filter === c ? "#4f46e5" : "#e2e5ef"),
            }}
          >
            {c}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="inp" placeholder="Search documents…" value={q} onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 32, minWidth: 220 }}
          />
        </div>
      </div>

      {/* List */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="p-10 text-center">
            <FileText size={28} className="mx-auto text-slate-300 mb-2" />
            <div className="text-slate-500 text-sm font-medium">No documents yet</div>
            <div className="text-slate-400 text-[12.5px]">Upload your first document above.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.map((d) => {
              const badge = expiryBadge(d.expiresAt);
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: (CAT_COLOR[d.category] || "#94a3b8") + "18" }}>
                    <FileText size={16} style={{ color: CAT_COLOR[d.category] || "#94a3b8" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)" }} className="truncate">{d.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold shrink-0" style={{ background: (CAT_COLOR[d.category] || "#94a3b8") + "1a", color: CAT_COLOR[d.category] || "#64748b" }}>{d.category}</span>
                      {badge && <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold shrink-0" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }} className="truncate">
                      {d.format.toUpperCase() || "FILE"} · {formatBytes(d.sizeBytes)} · {d.uploadedByName || "—"} · {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600" title="Download / view">
                    <Download size={16} />
                  </a>
                  <button onClick={() => remove(d.id, d.name)} className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
