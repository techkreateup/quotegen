"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { DOC_TEMPLATES, renderDocument, DOC_CSS, type Brand } from "@/lib/doc-templates";
import { ArrowLeft, Search, ArrowRight } from "lucide-react";

const CAT_COLOR: Record<string, string> = {
  Onboarding: "#0ea5e9", HR: "#8b5cf6", Legal: "#ef4444", Payroll: "#f59e0b", Finance: "#10b981", Other: "#94a3b8",
};

// Friendly sample values so the glimpse looks like a real document.
const SAMPLE: Record<string, string> = {
  employee: "Riya Sharma", party: "Riya Sharma", role: "Software Engineer", newRole: "Senior Engineer",
  ctc: "8,00,000", fee: "50,000", amount: "25,000", gross: "70,000", deductions: "8,000", net: "62,000",
  vendor: "Acme Supplies", poNo: "PO-2026-001", item: "Office equipment", qty: "10",
  month: "June 2026", subject: "Holiday notice", title: "Weekly sync", attendees: "Team A",
  signatory: "Priya Menon", designation: "HR Manager", casual: "12", sick: "8", earned: "15",
  reason: "—", purpose: "employment", scope: "Advisory services", term: "6 months", message: "—", notes: "—", empId: "EMP-014",
};

export default function TemplatesGalleryPage() {
  const [brand, setBrand] = useState<Brand>({ name: "Your Company", accent: "#6366f1", showLogo: true });
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      const s = d.settings ?? d;
      if (s) setBrand((b) => ({ ...b, name: s.businessName || b.name, logoUrl: s.logoUrl || undefined, address: s.address || undefined, accent: s.themeColor || b.accent }));
    }).catch(() => {});
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return DOC_TEMPLATES;
    return DOC_TEMPLATES.filter((x) => `${x.title} ${x.description} ${x.category}`.toLowerCase().includes(t));
  }, [q]);

  function dateSample(key: string) { return key === "from" || key === "joining" || key === "effective" || key === "lastDay" || key === "since" || key === "date" || key === "to" ? new Date().toLocaleDateString() : SAMPLE[key] ?? ""; }

  function glimpse(templateId: string) {
    const t = DOC_TEMPLATES.find((x) => x.id === templateId)!;
    const vals: Record<string, string> = {};
    for (const f of t.fields) vals[f.key] = dateSample(f.key);
    return `<style>${DOC_CSS}</style>${renderDocument(t, vals, brand)}`;
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader title="Document Templates" subtitle="Branded, fully editable documents — pick one, customise, then print or save to your vault" breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: "Templates" }]} />
        <Link href="/documents" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 shrink-0" style={{ textDecoration: "none" }}><ArrowLeft size={15} /> Back to vault</Link>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="inp" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {results.map((t) => (
          <Link key={t.id} href={`/documents/templates/${t.id}`} className="card group hover:shadow-lg hover:border-indigo-200 transition-all" style={{ padding: 0, overflow: "hidden", textDecoration: "none" }}>
            {/* Glimpse */}
            <div style={{ height: 168, overflow: "hidden", position: "relative", background: "#f1f5f9", borderBottom: "1px solid #eef0f5" }}>
              <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%) scale(0.42)", transformOrigin: "top center", width: 595, height: 842, background: "#fff", boxShadow: "0 4px 14px rgba(15,23,42,0.12)", padding: 40, pointerEvents: "none" }}
                dangerouslySetInnerHTML={{ __html: glimpse(t.id) }} />
              <span className="absolute top-2.5 left-2.5 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: (CAT_COLOR[t.category] || "#94a3b8"), color: "#fff" }}>{t.category}</span>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{t.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }} className="line-clamp-2">{t.description}</div>
              <div className="flex items-center gap-1 mt-2.5 text-indigo-600" style={{ fontSize: 12, fontWeight: 600 }}>Open editor <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" /></div>
            </div>
          </Link>
        ))}
        {results.length === 0 && <div className="col-span-full text-center text-slate-400 text-sm py-10">No templates match “{q}”.</div>}
      </div>
    </div>
  );
}
