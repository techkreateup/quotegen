"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { useUploadThing } from "@/lib/uploadthing-client";
import { DOC_TEMPLATES, renderDocument, DOC_CSS, type Brand } from "@/lib/doc-templates";
import {
  FileText, Upload, Trash2, Download, Search, Loader2, AlertTriangle, HardDrive,
  CalendarClock, ShieldCheck, Eye, LayoutTemplate, ArrowRight, ArrowUpDown,
} from "lucide-react";

interface Doc {
  id: string; code: string; name: string; fileUrl: string; format: string; mimeType?: string;
  sizeBytes: number; category: string; description: string; expiresAt: string | null;
  uploadedByName: string; createdAt: string;
}
interface Storage { companyBytes: number; quotaBytes: number | null; totalBytes: number }
interface Compliance { score: number; present: string[]; missing: string[] }

const CATEGORIES = ["Onboarding", "HR", "Legal", "Finance", "Payroll", "Compliance", "Tax", "Personal", "Other"];
const CAT_COLOR: Record<string, string> = {
  Onboarding: "#0ea5e9", HR: "#8b5cf6", Legal: "#ef4444", Finance: "#10b981",
  Payroll: "#f59e0b", Compliance: "#ec4899", Tax: "#6366f1", Personal: "#64748b", Other: "#94a3b8",
};
const FEATURED = ["offer-letter", "salary-slip", "nda", "experience-letter"];
const SAMPLE: Record<string, string> = {
  employee: "Riya Sharma", party: "Riya Sharma", role: "Software Engineer", ctc: "8,00,000",
  gross: "70,000", deductions: "8,000", net: "62,000", month: "June 2026", purpose: "employment",
  signatory: "Priya Menon", designation: "HR Manager", empId: "EMP-014",
};
function sampleVals(fields: { key: string; type?: string }[]) {
  const v: Record<string, string> = {};
  for (const f of fields) v[f.key] = f.type === "date" ? new Date().toLocaleDateString() : (SAMPLE[f.key] ?? "");
  return v;
}

function fmt(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  const u = ["KB", "MB", "GB", "TB"]; let v = n / 1024; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}
function expiryBadge(expiresAt: string | null) {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: "Expired", color: "#dc2626", bg: "#fef2f2" };
  if (days <= 30) return { label: `${days}d left`, color: "#b45309", bg: "#fffbeb" };
  return { label: new Date(expiresAt).toLocaleDateString(), color: "#64748b", bg: "#f8fafc" };
}

export default function DocumentsPage() {
  const toast = useToast();
  const dialog = useDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Other");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [sort, setSort] = useState("recent");
  const [brand, setBrand] = useState<Brand>({ name: "Your Company", accent: "#6366f1", showLogo: true });

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      const s = d.settings ?? d;
      if (s) setBrand((b) => ({ ...b, name: s.businessName || b.name, logoUrl: s.logoUrl || undefined, address: s.address || undefined, accent: s.themeColor || b.accent }));
    }).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "All") params.set("category", filter);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/documents?${params}`);
    const data = await res.json();
    setDocs(data.documents ?? []);
    setStorage(data.storage ?? null);
    setCompliance(data.compliance ?? null);
    setLoading(false);
  }
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q]);

  const { startUpload, isUploading } = useUploadThing("document", {
    onClientUploadComplete: () => { toast.success("Document uploaded"); setUploadExpiry(""); load(); },
    onUploadError: (e) => toast.error(e.message || "Upload failed"),
  });

  async function remove(id: string, name: string) {
    const ok = await dialog.confirm({ title: "Delete document?", message: `"${name}" will be permanently removed. This can't be undone.`, confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); load(); } else toast.error("Delete failed");
  }

  const hasCap = !!(storage && storage.quotaBytes);
  const usedPct = useMemo(() => (storage?.quotaBytes ? Math.min(100, Math.round((storage.companyBytes / storage.quotaBytes) * 100)) : 0), [storage]);
  const nearFull = hasCap && usedPct >= 90;
  const expiringSoon = docs.filter((d) => { const b = expiryBadge(d.expiresAt); return b && (b.label === "Expired" || b.label.endsWith("d left")); }).length;
  const sortedDocs = useMemo(() => {
    const arr = [...docs];
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "size") arr.sort((a, b) => b.sizeBytes - a.sizeBytes);
    else if (sort === "oldest") arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    else if (sort === "expiry") arr.sort((a, b) => (a.expiresAt ? +new Date(a.expiresAt) : Infinity) - (b.expiresAt ? +new Date(b.expiresAt) : Infinity));
    else arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return arr;
  }, [docs, sort]);

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Document Vault" subtitle="Your company's single source of truth for every document" />

      {/* Templates highlight — header + glimpse thumbnails of available templates */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="flex items-center gap-4 p-4" style={{ background: "linear-gradient(110deg,#4F46E5 0%,#6366F1 55%,#7C3AED 100%)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}>
            <LayoutTemplate size={24} color="#fff" />
          </div>
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "#fff" }}>Create from a template</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.88)" }} className="truncate">Branded with your logo, fully editable — print or save straight to your vault</div>
          </div>
          <Link href="/documents/templates" className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg shrink-0" style={{ background: "#fff", color: "#4F46E5", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            Browse all <ArrowRight size={15} />
          </Link>
        </div>
        {/* Glimpses */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4" style={{ background: "#f8fafc" }}>
          {FEATURED.map((tid) => {
            const t = DOC_TEMPLATES.find((x) => x.id === tid);
            if (!t) return null;
            return (
              <Link key={tid} href={`/documents/templates/${tid}`} className="group block rounded-xl overflow-hidden bg-white hover:shadow-md transition-all" style={{ border: "1px solid #eef0f5", textDecoration: "none" }}>
                <div style={{ height: 132, overflow: "hidden", position: "relative", background: "#f1f5f9" }}>
                  <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%) scale(0.34)", transformOrigin: "top center", width: 595, height: 842, background: "#fff", boxShadow: "0 3px 12px rgba(15,23,42,0.1)", padding: 40, pointerEvents: "none" }}
                    dangerouslySetInnerHTML={{ __html: `<style>${DOC_CSS}</style>${renderDocument(t, sampleVals(t.fields), brand)}` }} />
                </div>
                <div className="flex items-center justify-between px-3 py-2.5" style={{ borderTop: "1px solid #eef0f5" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-1)" }} className="truncate">{t.title}</span>
                  <ArrowRight size={13} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card" style={{ padding: 16 }}>
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={15} className="text-indigo-500" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Storage used</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>{storage ? (hasCap ? `${fmt(storage.companyBytes)} / ${fmt(storage.quotaBytes!)}` : fmt(storage.companyBytes)) : "—"}</span>
          </div>
          {hasCap ? (
            <>
              <div style={{ height: 8, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}><div style={{ width: `${usedPct}%`, height: "100%", background: nearFull ? "#dc2626" : "#6366f1" }} /></div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 6 }}>{usedPct}% used{nearFull && <span style={{ color: "#dc2626", fontWeight: 600 }}> · Almost full</span>}</div>
            </>
          ) : (
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-1)" }}>{docs.length}<span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-3)", marginLeft: 6 }}>documents</span></div>
          )}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="flex items-center gap-2 mb-2"><CalendarClock size={15} className="text-amber-500" /><span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Expiry watch</span></div>
          <div style={{ fontSize: 26, fontWeight: 800, color: expiringSoon ? "#b45309" : "var(--text-1)" }}>{expiringSoon}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>expired or expiring within 30 days</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="flex items-center gap-2 mb-2"><ShieldCheck size={15} className="text-emerald-500" /><span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Compliance</span><span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: (compliance?.score ?? 0) >= 80 ? "#059669" : (compliance?.score ?? 0) >= 40 ? "#b45309" : "#dc2626" }}>{compliance ? `${compliance.score}%` : "—"}</span></div>
          {compliance && compliance.missing.length > 0
            ? <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Missing: <span style={{ color: "#b45309", fontWeight: 600 }}>{compliance.missing.join(", ")}</span></div>
            : <div style={{ fontSize: 11.5, color: "#059669" }}>All key document types present 🎉</div>}
        </div>
      </div>

      {/* Upload */}
      <div className="card" style={{ padding: 16 }}>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="lbl">Category</label><select className="inp" value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} style={{ minWidth: 150 }}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="lbl">Expiry (optional)</label><input type="date" className="inp" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} /></div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading || nearFull} className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50">{isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{isUploading ? "Uploading…" : "Upload document"}</button>
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>PDF, image, or office file · up to 16MB</span>
          <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) startUpload([file], { category: uploadCategory as never, expiresAt: uploadExpiry || undefined }); }} />
        </div>
        {nearFull && <div className="flex items-center gap-2 mt-3 text-[12px]" style={{ color: "#dc2626" }}><AlertTriangle size={14} /> Storage is nearly full. Delete some documents before uploading.</div>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {["All", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setFilter(c)} className="px-3 h-8 rounded-full text-[12.5px] font-semibold transition-colors" style={{ background: filter === c ? "#4f46e5" : "#fff", color: filter === c ? "#fff" : "var(--text-2)", border: "1px solid " + (filter === c ? "#4f46e5" : "#e2e5ef") }}>{c}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative inline-flex items-center">
            <ArrowUpDown size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
            <select className="inp" value={sort} onChange={(e) => setSort(e.target.value)} style={{ paddingLeft: 28, height: 38 }}>
              <option value="recent">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A–Z</option>
              <option value="size">Largest</option>
              <option value="expiry">Expiring soon</option>
            </select>
          </div>
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="inp" placeholder="Search documents…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 32, minWidth: 200 }} /></div>
        </div>
      </div>

      {/* List */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
          : docs.length === 0 ? (
            <div className="p-10 text-center">
              <FileText size={28} className="mx-auto text-slate-300 mb-2" />
              <div className="text-slate-500 text-sm font-medium">No documents yet</div>
              <div className="text-slate-400 text-[12.5px]">Upload a file above, or create one from a template.</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedDocs.map((d) => {
                const badge = expiryBadge(d.expiresAt);
                return (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: (CAT_COLOR[d.category] || "#94a3b8") + "18" }}><FileText size={16} style={{ color: CAT_COLOR[d.category] || "#94a3b8" }} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {d.code && <span className="font-mono shrink-0" style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8" }}>{d.code}</span>}
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)" }} className="truncate">{d.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold shrink-0" style={{ background: (CAT_COLOR[d.category] || "#94a3b8") + "1a", color: CAT_COLOR[d.category] || "#64748b" }}>{d.category}</span>
                        {badge && <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold shrink-0" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-3)" }} className="truncate">{d.format.toUpperCase() || "FILE"} · {fmt(d.sizeBytes)} · {d.uploadedByName || "—"} · {new Date(d.createdAt).toLocaleDateString()}</div>
                    </div>
                    <Link href={`/documents/${d.id}`} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="View"><Eye size={16} /></Link>
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" download className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600" title="Download"><Download size={16} /></a>
                    <button onClick={() => remove(d.id, d.name)} className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={16} /></button>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
