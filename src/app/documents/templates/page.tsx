"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useUploadThing } from "@/lib/uploadthing-client";
import { renderHtmlToPdf } from "@/lib/pdf";
import { DOC_TEMPLATES, renderDocument, DOC_CSS, type DocTemplate, type Brand } from "@/lib/doc-templates";
import { FileText, Printer, Download, Save, ArrowLeft, X, ImageIcon, RotateCcw, Loader2 } from "lucide-react";

const CAT_COLOR: Record<string, string> = {
  Onboarding: "#0ea5e9", HR: "#8b5cf6", Legal: "#ef4444", Payroll: "#f59e0b", Finance: "#10b981", Other: "#94a3b8",
};
const SAVE_CATEGORIES = ["HR", "Legal", "Onboarding", "Payroll", "Finance", "Compliance", "Tax", "Personal", "Other"];

// Rewrite UploadThing image URLs to our same-origin proxy so html2canvas can
// render the logo into the PDF without tainting the canvas.
const proxyLogos = (html: string) =>
  html.replace(/(<img[^>]+src=")(https:\/\/[^"]*(?:ufs\.sh|utfs\.io)[^"]*)(")/gi,
    (_m, a, url, b) => `${a}/api/proxy-image?url=${encodeURIComponent(url)}${b}`);

export default function TemplatesPage() {
  const toast = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [brand, setBrand] = useState<Brand>({ name: "Your Company", accent: "#6366f1", showLogo: true });
  const [active, setActive] = useState<DocTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("HR");
  const [busy, setBusy] = useState<"" | "pdf" | "vault">("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      const s = d.settings ?? d;
      if (!s) return;
      setBrand((b) => ({ ...b, name: s.businessName || b.name, logoUrl: s.logoUrl || undefined, address: s.address || undefined, website: s.website || undefined, accent: s.themeColor || b.accent }));
    }).catch(() => {});
  }, []);

  function regen() {
    if (editorRef.current && active) editorRef.current.innerHTML = renderDocument(active, values, brand);
  }
  // Regenerate when a template opens or branding changes (resets manual edits).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { regen(); }, [active, brand.accent, brand.showLogo, brand.logoUrl, brand.name]);

  function open(t: DocTemplate) {
    const init: Record<string, string> = {};
    for (const f of t.fields) init[f.key] = f.type === "date" ? new Date().toISOString().slice(0, 10) : "";
    setValues(init);
    setActive(t);
  }

  const { startUpload } = useUploadThing("document", {
    onClientUploadComplete: () => { toast.success("Saved to Document Vault"); setBusy(""); },
    onUploadError: (e) => { toast.error(e.message || "Save failed"); setBusy(""); },
  });

  function currentHtml() {
    return `<style>${DOC_CSS}</style>${editorRef.current?.innerHTML ?? ""}`;
  }

  function print() {
    const w = window.open("", "_blank", "width=860,height=960");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${active?.title ?? "Document"}</title>
      <style>@page{size:A4;margin:18mm}body{margin:0}${DOC_CSS}</style></head>
      <body>${editorRef.current?.innerHTML ?? ""}<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  async function savePdf() {
    setBusy("pdf");
    try {
      const pdf = await renderHtmlToPdf(`<style>${DOC_CSS}</style>${proxyLogos(editorRef.current?.innerHTML ?? "")}`);
      pdf.save(`${active?.title ?? "document"}.pdf`);
    } catch { toast.error("Could not generate PDF"); }
    setBusy("");
  }

  async function saveToVault() {
    setBusy("vault");
    try {
      const pdf = await renderHtmlToPdf(`<style>${DOC_CSS}</style>${proxyLogos(editorRef.current?.innerHTML ?? "")}`);
      const blob = pdf.output("blob");
      const file = new File([blob], `${active?.title ?? "document"}.pdf`, { type: "application/pdf" });
      await startUpload([file], { category: category as never });
    } catch { toast.error("Could not save"); setBusy(""); }
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Document Templates" subtitle="Branded, fully editable documents — print, download, or save straight to your vault" breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: "Templates" }]} />
      <Link href="/documents" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700" style={{ textDecoration: "none" }}><ArrowLeft size={15} /> Back to vault</Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DOC_TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => open(t)} className="card text-left hover:shadow-md hover:border-indigo-200 transition-all" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ height: 5, background: CAT_COLOR[t.category] || "#94a3b8" }} />
            <div style={{ padding: 16 }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: (CAT_COLOR[t.category] || "#94a3b8") + "18" }}><FileText size={16} style={{ color: CAT_COLOR[t.category] || "#94a3b8" }} /></div>
                <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold" style={{ background: (CAT_COLOR[t.category] || "#94a3b8") + "1a", color: CAT_COLOR[t.category] || "#64748b" }}>{t.category}</span>
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-1)" }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{t.description}</div>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => setActive(null)}>
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[94vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <span style={{ fontSize: 15, fontWeight: 700 }}>{active.title}</span>
              <span className="text-[11px] text-slate-400">· click the document to edit any text</span>
              <button onClick={() => setActive(null)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>

            <div className="flex flex-col md:flex-row overflow-hidden flex-1">
              {/* Controls */}
              <div className="md:w-80 shrink-0 border-r border-slate-100 overflow-y-auto">
                <div className="p-4 space-y-3">
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Quick fill</div>
                  {active.fields.map((f) => (
                    <div key={f.key}>
                      <label className="lbl">{f.label}</label>
                      {f.type === "textarea"
                        ? <textarea className="inp" rows={2} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                        : <input className="inp" type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />}
                    </div>
                  ))}
                  <button onClick={regen} className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50"><RotateCcw size={13} /> Apply fields to document</button>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 space-y-3" style={{ background: "#fafbfc" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Branding</div>
                  <div className="flex items-center justify-between"><span style={{ fontSize: 13 }}>Accent colour</span><input type="color" value={brand.accent} onChange={(e) => setBrand((b) => ({ ...b, accent: e.target.value }))} style={{ width: 38, height: 28, border: "none", background: "none", cursor: "pointer" }} /></div>
                  <label className="flex items-center justify-between cursor-pointer"><span style={{ fontSize: 13 }} className="flex items-center gap-1.5"><ImageIcon size={13} /> Show logo</span><input type="checkbox" checked={brand.showLogo} onChange={(e) => setBrand((b) => ({ ...b, showLogo: e.target.checked }))} /></label>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 space-y-2.5">
                  <button onClick={print} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-slate-200 text-slate-700 text-[13px] font-semibold hover:bg-slate-50"><Printer size={15} /> Print</button>
                  <button onClick={savePdf} disabled={!!busy} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[13px] font-semibold hover:bg-indigo-100 disabled:opacity-50">{busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Save PDF</button>
                  <div className="flex gap-2">
                    <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 110 }}>{SAVE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                    <button onClick={saveToVault} disabled={!!busy} className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50">{busy === "vault" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save to Vault</button>
                  </div>
                </div>
              </div>

              {/* Editable A4 */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center" style={{ background: "#eef1f6" }}>
                <div style={{ width: "100%", maxWidth: 500 }}>
                  <div ref={editorRef} contentEditable suppressContentEditableWarning
                    style={{ aspectRatio: "210 / 297", background: "#fff", boxShadow: "0 8px 30px rgba(15,23,42,0.12)", borderRadius: 4, padding: "7.5%", overflow: "auto", outline: "none" }} />
                  <style>{DOC_CSS}</style>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
