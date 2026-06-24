"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { DOC_TEMPLATES } from "@/lib/doc-templates";
import { useToast } from "@/components/Toast";
import { ArrowLeft, Search, ArrowRight, FileText, Star, Trash2, ArrowUpDown } from "lucide-react";

const CAT_COLOR: Record<string, string> = {
  Onboarding: "#0ea5e9", HR: "#8b5cf6", Legal: "#ef4444", Payroll: "#f59e0b", Finance: "#10b981",
  Compliance: "#ec4899", Tax: "#6366f1", Personal: "#64748b", Other: "#94a3b8",
};
type Saved = { id: string; name: string; category: string; baseId: string; version: number; updatedAt: string; createdByName?: string; createdByRole?: string };

export default function TemplatesGalleryPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("name");
  const [saved, setSaved] = useState<Saved[]>([]);
  function loadSaved() { fetch("/api/templates").then((r) => r.json()).then((d) => setSaved(d.templates ?? [])).catch(() => {}); }
  useEffect(() => { loadSaved(); }, []);

  async function removeSaved(id: string) {
    const r = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (r.ok) { loadSaved(); toast.success("Removed"); } else toast.error("Could not remove");
  }

  // Categories present across built-ins + saved.
  const allCats = useMemo(() => {
    const s = new Set<string>([...DOC_TEMPLATES.map((t) => t.category), ...saved.map((x) => x.category)]);
    return ["All", ...[...s].sort()];
  }, [saved]);

  const matchesQ = (txt: string) => !q.trim() || txt.toLowerCase().includes(q.trim().toLowerCase());

  const builtins = useMemo(() => {
    let list = DOC_TEMPLATES.filter((t) => (cat === "All" || t.category === cat) && matchesQ(`${t.title} ${t.description} ${t.category}`));
    list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat]);

  const savedFiltered = useMemo(() => {
    let list = saved.filter((s) => (cat === "All" || s.category === cat) && matchesQ(`${s.name} ${s.category}`));
    list = [...list].sort((a, b) => sort === "recent" ? (+new Date(b.updatedAt) - +new Date(a.updatedAt)) : a.name.localeCompare(b.name));
    return list;
  }, [saved, q, cat, sort]);

  const builtinCats = cat === "All" ? [...new Set(builtins.map((t) => t.category))] : [cat];

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader title="Document Templates" subtitle="Pick a template, customise it, then print or save to your vault" breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: "Templates" }]} />
        <Link href="/documents" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 shrink-0" style={{ textDecoration: "none" }}><ArrowLeft size={15} /> Back to vault</Link>
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="inp" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <div className="relative inline-flex items-center">
          <ArrowUpDown size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
          <select className="inp" value={sort} onChange={(e) => setSort(e.target.value)} style={{ paddingLeft: 28, height: 38 }}>
            <option value="name">Name A–Z</option>
            <option value="recent">Recently saved</option>
          </select>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {allCats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className="px-3 h-8 rounded-full text-[12.5px] font-semibold transition-colors"
            style={{ background: cat === c ? "#4f46e5" : "#fff", color: cat === c ? "#fff" : "var(--text-2)", border: "1px solid " + (cat === c ? "#4f46e5" : "#e2e5ef") }}>{c}</button>
        ))}
      </div>

      {/* Saved templates */}
      {savedFiltered.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2.5"><Star size={14} className="text-amber-500" /><h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>Your saved templates</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedFiltered.map((s) => (
              <div key={s.id} className="card flex items-center gap-3" style={{ padding: 14 }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: (CAT_COLOR[s.category] || "#94a3b8") + "20" }}><Star size={16} style={{ color: CAT_COLOR[s.category] || "#f59e0b" }} /></div>
                <Link href={`/documents/templates/${s.baseId}?saved=${s.id}`} className="min-w-0 flex-1" style={{ textDecoration: "none" }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-1)" }} className="truncate">{s.name}</span>
                    <span className="px-1.5 rounded text-[10px] font-bold shrink-0" style={{ background: (CAT_COLOR[s.category] || "#94a3b8") + "1a", color: CAT_COLOR[s.category] || "#64748b" }}>{s.category}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>v{s.version} · {new Date(s.updatedAt).toLocaleDateString()}{s.createdByName ? ` · by ${s.createdByName}${s.createdByRole ? ` (${s.createdByRole})` : ""}` : ""}</div>
                </Link>
                <button onClick={() => removeSaved(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Built-in templates */}
      {builtinCats.map((c) => (
        <div key={c}>
          <div className="flex items-center gap-2 mb-2.5">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLOR[c] || "#94a3b8" }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>{c}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {builtins.filter((t) => t.category === c).map((t) => (
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
      {builtins.length === 0 && savedFiltered.length === 0 && <div className="text-center text-slate-400 text-sm py-10">No templates match your filters.</div>}
    </div>
  );
}
