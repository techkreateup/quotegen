"use client";

import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { DOC_TEMPLATES, templateCategories } from "@/lib/doc-templates";
import { FileText, ArrowLeft, ArrowRight } from "lucide-react";

const CAT_COLOR: Record<string, string> = {
  Onboarding: "#0ea5e9", HR: "#8b5cf6", Legal: "#ef4444", Payroll: "#f59e0b", Finance: "#10b981", Other: "#94a3b8",
};

export default function TemplatesGalleryPage() {
  const cats = templateCategories();
  return (
    <div className="w-full space-y-6">
      <PageHeader title="Document Templates" subtitle="Branded, fully editable documents — fill, format, then print or save to your vault" breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: "Templates" }]} />
      <Link href="/documents" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700" style={{ textDecoration: "none" }}><ArrowLeft size={15} /> Back to vault</Link>

      {cats.map((cat) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2.5">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLOR[cat] || "#94a3b8" }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>{cat}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DOC_TEMPLATES.filter((t) => t.category === cat).map((t) => (
              <Link key={t.id} href={`/documents/templates/${t.id}`} className="card group hover:shadow-md hover:border-indigo-200 transition-all" style={{ padding: 0, overflow: "hidden", textDecoration: "none" }}>
                <div style={{ height: 5, background: CAT_COLOR[t.category] || "#94a3b8" }} />
                <div style={{ padding: 16 }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: (CAT_COLOR[t.category] || "#94a3b8") + "18" }}>
                    <FileText size={18} style={{ color: CAT_COLOR[t.category] || "#94a3b8" }} />
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-1)" }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{t.description}</div>
                  <div className="flex items-center gap-1 mt-3 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 12, fontWeight: 600 }}>
                    Open editor <ArrowRight size={13} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
