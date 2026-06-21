"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { DOC_TEMPLATES, fillTemplate, type DocTemplate } from "@/lib/doc-templates";
import { FileText, Printer, ArrowLeft, X } from "lucide-react";

const CAT_COLOR: Record<string, string> = {
  Onboarding: "#0ea5e9", HR: "#8b5cf6", Legal: "#ef4444", Payroll: "#f59e0b", Other: "#94a3b8",
};

export default function TemplatesPage() {
  const [companyName, setCompanyName] = useState("Your Company");
  const [companyAddress, setCompanyAddress] = useState("");
  const [active, setActive] = useState<DocTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings ?? d;
        if (s?.businessName) setCompanyName(s.businessName);
        if (s?.address) setCompanyAddress(s.address);
      })
      .catch(() => {});
  }, []);

  function open(t: DocTemplate) {
    setActive(t);
    const init: Record<string, string> = {};
    for (const f of t.fields) init[f.key] = f.type === "date" ? new Date().toISOString().slice(0, 10) : "";
    setValues(init);
  }

  const merged = useMemo(
    () => ({ ...values, company: companyName, companyAddress }),
    [values, companyName, companyAddress]
  );
  const rendered = active ? fillTemplate(active.body, merged) : "";

  function print() {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${active?.title ?? "Document"}</title>
      <style>
        body{font-family:Georgia,'Times New Roman',serif;color:#1e293b;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.7}
        h1{font-size:22px;border-bottom:2px solid #6366f1;padding-bottom:8px}
        @media print{body{margin:0}}
      </style></head><body>${rendered}
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Document Templates"
        subtitle="Ready-to-use professional documents — fill in the blanks and download"
        breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: "Templates" }]}
      />

      <Link href="/documents" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700" style={{ textDecoration: "none" }}>
        <ArrowLeft size={15} /> Back to vault
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DOC_TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => open(t)} className="card text-left hover:border-indigo-200 transition-colors" style={{ padding: 16 }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: (CAT_COLOR[t.category] || "#94a3b8") + "18" }}>
                <FileText size={16} style={{ color: CAT_COLOR[t.category] || "#94a3b8" }} />
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold" style={{ background: (CAT_COLOR[t.category] || "#94a3b8") + "1a", color: CAT_COLOR[t.category] || "#64748b" }}>{t.category}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{t.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{t.description}</div>
          </button>
        ))}
      </div>

      {/* Fill + preview modal */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onClick={() => setActive(null)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <span style={{ fontSize: 15, fontWeight: 700 }}>{active.title}</span>
              <button onClick={() => setActive(null)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>
            <div className="flex flex-col md:flex-row gap-0 overflow-hidden flex-1">
              {/* Form */}
              <div className="md:w-72 shrink-0 p-4 border-r border-slate-100 overflow-y-auto space-y-3">
                {active.fields.map((f) => (
                  <div key={f.key}>
                    <label className="lbl">{f.label}</label>
                    {f.type === "textarea" ? (
                      <textarea className="inp" rows={2} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                    ) : (
                      <input className="inp" type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
                <button onClick={print} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700">
                  <Printer size={15} /> Print / Save as PDF
                </button>
              </div>
              {/* Live preview */}
              <div className="flex-1 overflow-y-auto p-6" style={{ background: "#f8fafc" }}>
                <div className="bg-white rounded-lg shadow-sm p-6" style={{ fontFamily: "Georgia, serif", lineHeight: 1.7, color: "#1e293b" }}
                  dangerouslySetInnerHTML={{ __html: `<style>h1{font-size:20px;border-bottom:2px solid #6366f1;padding-bottom:6px}</style>${rendered}` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
