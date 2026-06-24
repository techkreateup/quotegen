"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { DOC_TEMPLATES, templateCategories } from "@/lib/doc-templates";
import { useToast } from "@/components/Toast";
import { ArrowLeft, Search, ArrowRight, FileText, Star, Trash2 } from "lucide-react";

const CAT_COLOR: Record<string, string> = {
  Onboarding: "#0ea5e9", HR: "#8b5cf6", Legal: "#ef4444", Payroll: "#f59e0b", Finance: "#10b981", Other: "#94a3b8",
};

export default function TemplatesGalleryPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState<{ id: string; name: string; baseId: string; version: number; updatedAt: string }[]>([]);
  function loadSaved() { fetch("/api/templates").then((r) => r.json()).then((d) => setSaved(d.templates ?? [])).catch(() => {}); }
  useEffect(() => { loadSaved(); }, []);

  const cats = templateCategories();
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? DOC_TEMPLATES.filter((x) => `${x.title} ${x.description} ${x.category}`.toLowerCase().includes(t)) : DOC_TEMPLATES;
  }, [q]);
  const shownCats = cats.filter((c) => filtered.some((t) => t.category === c));

  async function removeSaved(id: string) {
    const r = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (r.ok) { loadSaved(); toast.success("Removed"); } else toast.error("Could not remove");
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader title="Document Templates" subtitle="Pick a template, customise it, then print or save to your vault" breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: "Templates" }]} />
        <Link href="/documents" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 shrink-0" style={{ textDecoration: "none" }}><ArrowLeft size={15} /> Back to vault</Link>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="inp" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
      </div>

      {/* Saved templates */}
      {!q && saved.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5"><Star size={14} className="text-amber-500" /><h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>Your saved templates</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {saved.map((s) => (
              <div key={s.id} className="card flex items-center gap-3" style={{ padding: 14 }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#fef3c7" }}><Star size={16} className="text-amber-500" /></div>
                <Link href={`/documents/templates/${s.baseId}?saved=${s.id}`} className="min-w-0 flex-1" style={{ textDecoration: "none" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)" }} className="truncate">{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>v{s.version} · {new Date(s.updatedAt).toLocaleDateString()}</div>
                </Link>
                <button onClick={() => removeSaved(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Built-in templates, grouped by category */}
      {shownCats.map((cat) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2.5">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLOR[cat] || "#94a3b8" }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>{cat}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.filter((t) => t.category === cat).map((t) => (
              <Link key={t.id} href={`/documents/templates/${t.id}`} className="card group flex items-center gap-3 hover:border-indigo-200 hover:shadow-sm transition-all" style={{ padding: 14, textDecoration: "none" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: (CAT_COLOR[t.category] || "#94a3b8") + "18" }}>
                  <FileText size={18} style={{ color: CAT_COLOR[t.category] || "#94a3b8" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{t.title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }} className="truncate">{t.description}</div>
                </div>
                <ArrowRight size={15} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="text-center text-slate-400 text-sm py-10">No templates match “{q}”.</div>}
    </div>
  );
}
