"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useUploadThing } from "@/lib/uploadthing-client";
import { renderHtmlToPdf } from "@/lib/pdf";
import { DOC_TEMPLATES, renderDocument, DOC_CSS, type DocTemplate, type Brand } from "@/lib/doc-templates";
import {
  ArrowLeft, Printer, Download, Save, Loader2, RotateCcw, ImageIcon,
  Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Type,
  Table as TableIcon, Link2, Minus, Highlighter, RemoveFormatting,
} from "lucide-react";

const SAVE_CATEGORIES = ["HR", "Legal", "Onboarding", "Payroll", "Finance", "Compliance", "Tax", "Personal", "Other"];

const proxyLogos = (html: string) =>
  html.replace(/(<img[^>]+src=")(https:\/\/[^"]*(?:ufs\.sh|utfs\.io)[^"]*)(")/gi,
    (_m, a, url, b) => `${a}/api/proxy-image?url=${encodeURIComponent(url)}${b}`);

function ToolBtn({ title, onCmd, children }: { title: string; onCmd: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      // preventDefault keeps the editor selection while clicking the toolbar
      onMouseDown={(e) => { e.preventDefault(); onCmd(); }}
      className="w-8 h-8 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100"
    >
      {children}
    </button>
  );
}

export default function TemplateEditorPage() {
  const params = useParams();
  const id = String(params.id);
  const template: DocTemplate | undefined = DOC_TEMPLATES.find((t) => t.id === id);
  const toast = useToast();
  const editorRef = useRef<HTMLDivElement>(null);

  const [brand, setBrand] = useState<Brand>({ name: "Your Company", accent: "#6366f1", showLogo: true });
  const [values, setValues] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("HR");
  const [busy, setBusy] = useState<"" | "pdf" | "vault">("");
  const [touched, setTouched] = useState(false); // manual edits made?

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      const s = d.settings ?? d;
      if (s) setBrand((b) => ({ ...b, name: s.businessName || b.name, logoUrl: s.logoUrl || undefined, address: s.address || undefined, website: s.website || undefined, accent: s.themeColor || b.accent }));
    }).catch(() => {});
    if (template) {
      const init: Record<string, string> = {};
      for (const f of template.fields) init[f.key] = f.type === "date" ? new Date().toISOString().slice(0, 10) : "";
      setValues(init);
    }
  }, [template]);

  // Live: quick-fill + branding changes re-render the document (until manually edited).
  useEffect(() => {
    if (editorRef.current && template && !touched) editorRef.current.innerHTML = renderDocument(template, values, brand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, brand, template]);

  function forceRegen() {
    if (editorRef.current && template) {
      editorRef.current.innerHTML = renderDocument(template, values, brand);
      setTouched(false);
    }
  }

  const { startUpload } = useUploadThing("document", {
    onClientUploadComplete: () => { toast.success("Saved to Document Vault"); setBusy(""); },
    onUploadError: (e) => { toast.error(e.message || "Save failed"); setBusy(""); },
  });

  function print() {
    const w = window.open("", "_blank", "width=860,height=960");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${template?.title ?? "Document"}</title>
      <style>@page{size:A4;margin:18mm}body{margin:0}${DOC_CSS}</style></head>
      <body>${editorRef.current?.innerHTML ?? ""}<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }
  async function savePdf() {
    setBusy("pdf");
    try {
      const pdf = await renderHtmlToPdf(`<style>${DOC_CSS}</style>${proxyLogos(editorRef.current?.innerHTML ?? "")}`);
      pdf.save(`${template?.title ?? "document"}.pdf`);
    } catch { toast.error("Could not generate PDF"); }
    setBusy("");
  }
  async function saveToVault() {
    setBusy("vault");
    try {
      const pdf = await renderHtmlToPdf(`<style>${DOC_CSS}</style>${proxyLogos(editorRef.current?.innerHTML ?? "")}`);
      const file = new File([pdf.output("blob")], `${template?.title ?? "document"}.pdf`, { type: "application/pdf" });
      await startUpload([file], { category: category as never });
    } catch { toast.error("Could not save"); setBusy(""); }
  }

  const cmd = (c: string, v?: string) => { document.execCommand(c, false, v); editorRef.current?.focus(); setTouched(true); };

  function insertTable() {
    const rows = Math.min(20, Math.max(1, parseInt(prompt("Number of rows?", "3") || "0", 10)));
    const cols = Math.min(10, Math.max(1, parseInt(prompt("Number of columns?", "3") || "0", 10)));
    if (!rows || !cols) return;
    let html = '<table style="width:100%;border-collapse:collapse;margin:10px 0">';
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) html += '<td style="border:1px solid #cbd5e1;padding:6px 9px;min-width:40px">&nbsp;</td>';
      html += "</tr>";
    }
    html += "</table><p><br/></p>";
    cmd("insertHTML", html);
  }
  function insertLink() { const url = prompt("Link URL", "https://"); if (url) cmd("createLink", url); }

  if (!template) {
    return (
      <div className="w-full">
        <PageHeader title="Template not found" subtitle="" />
        <Link href="/documents/templates" className="text-indigo-600 font-semibold text-sm">← Back to templates</Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader title={template.title} subtitle={template.description} breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: "Templates", href: "/documents/templates" }, { label: template.title }]} />
        <Link href="/documents/templates" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 shrink-0" style={{ textDecoration: "none" }}><ArrowLeft size={15} /> All templates</Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Controls */}
        <div className="lg:w-72 shrink-0 space-y-4">
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Quick fill</div>
            <div className="space-y-2.5">
              {template.fields.map((f) => (
                <div key={f.key}>
                  <label className="lbl">{f.label}</label>
                  {f.type === "textarea"
                    ? <textarea className="inp" rows={2} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                    : <input className="inp" type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} value={values[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />}
                </div>
              ))}
            </div>
            {touched && <button onClick={forceRegen} className="w-full mt-3 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50"><RotateCcw size={13} /> Reset to fields</button>}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Branding</div>
            <div className="flex items-center justify-between mb-2"><span style={{ fontSize: 13 }}>Accent colour</span><input type="color" value={brand.accent} onChange={(e) => setBrand((b) => ({ ...b, accent: e.target.value }))} style={{ width: 38, height: 28, border: "none", background: "none", cursor: "pointer" }} /></div>
            <label className="flex items-center justify-between cursor-pointer"><span style={{ fontSize: 13 }} className="flex items-center gap-1.5"><ImageIcon size={13} /> Show logo</span><input type="checkbox" checked={brand.showLogo} onChange={(e) => setBrand((b) => ({ ...b, showLogo: e.target.checked }))} /></label>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="space-y-2.5">
              <button onClick={print} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-slate-200 text-slate-700 text-[13px] font-semibold hover:bg-slate-50"><Printer size={15} /> Print</button>
              <button onClick={savePdf} disabled={!!busy} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[13px] font-semibold hover:bg-indigo-100 disabled:opacity-50">{busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Save PDF</button>
              <div className="flex gap-2">
                <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 104 }}>{SAVE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                <button onClick={saveToVault} disabled={!!busy} className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50">{busy === "vault" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save to Vault</button>
              </div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          {/* Docs-style toolbar */}
          <div className="card flex items-center gap-0.5 flex-wrap mb-3" style={{ padding: "6px 8px", position: "sticky", top: 8, zIndex: 10 }}>
            <ToolBtn title="Heading" onCmd={() => cmd("formatBlock", "H1")}><Heading1 size={16} /></ToolBtn>
            <ToolBtn title="Subheading" onCmd={() => cmd("formatBlock", "H2")}><Heading2 size={16} /></ToolBtn>
            <ToolBtn title="Normal text" onCmd={() => cmd("formatBlock", "P")}><Type size={16} /></ToolBtn>
            <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
            <ToolBtn title="Bold" onCmd={() => cmd("bold")}><Bold size={16} /></ToolBtn>
            <ToolBtn title="Italic" onCmd={() => cmd("italic")}><Italic size={16} /></ToolBtn>
            <ToolBtn title="Underline" onCmd={() => cmd("underline")}><Underline size={16} /></ToolBtn>
            <label title="Text colour" className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-slate-100 cursor-pointer relative">
              <span style={{ fontSize: 13, fontWeight: 800, color: "#475569" }}>A</span>
              <input type="color" onChange={(e) => cmd("foreColor", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
            <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
            <ToolBtn title="Bullet list" onCmd={() => cmd("insertUnorderedList")}><List size={16} /></ToolBtn>
            <ToolBtn title="Numbered list" onCmd={() => cmd("insertOrderedList")}><ListOrdered size={16} /></ToolBtn>
            <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
            <ToolBtn title="Align left" onCmd={() => cmd("justifyLeft")}><AlignLeft size={16} /></ToolBtn>
            <ToolBtn title="Align centre" onCmd={() => cmd("justifyCenter")}><AlignCenter size={16} /></ToolBtn>
            <ToolBtn title="Align right" onCmd={() => cmd("justifyRight")}><AlignRight size={16} /></ToolBtn>
            <select onChange={(e) => { cmd("fontSize", e.target.value); e.target.selectedIndex = 0; }} className="ml-1 text-[12px] border border-slate-200 rounded-md h-8 px-1.5 text-slate-600" defaultValue="">
              <option value="" disabled>Size</option>
              <option value="2">Small</option>
              <option value="3">Normal</option>
              <option value="5">Large</option>
              <option value="6">Huge</option>
            </select>
            <select onChange={(e) => { cmd("fontName", e.target.value); e.target.selectedIndex = 0; }} className="text-[12px] border border-slate-200 rounded-md h-8 px-1.5 text-slate-600" defaultValue="">
              <option value="" disabled>Font</option>
              <option value="Georgia">Serif</option>
              <option value="Arial, sans-serif">Sans</option>
              <option value="'Courier New', monospace">Mono</option>
              <option value="'Times New Roman', serif">Times</option>
            </select>
            <label title="Highlight" className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-slate-100 cursor-pointer relative">
              <Highlighter size={16} className="text-slate-600" />
              <input type="color" onChange={(e) => cmd("hiliteColor", e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
            <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
            <ToolBtn title="Insert table" onCmd={insertTable}><TableIcon size={16} /></ToolBtn>
            <ToolBtn title="Horizontal line" onCmd={() => cmd("insertHorizontalRule")}><Minus size={16} /></ToolBtn>
            <ToolBtn title="Insert link" onCmd={insertLink}><Link2 size={16} /></ToolBtn>
            <ToolBtn title="Clear formatting" onCmd={() => cmd("removeFormat")}><RemoveFormatting size={16} /></ToolBtn>
          </div>

          <div className="flex justify-center overflow-auto" style={{ background: "#eef1f6", borderRadius: 12, padding: 20 }}>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => setTouched(true)}
              style={{ width: "100%", maxWidth: 620, minHeight: 877, background: "#fff", boxShadow: "0 8px 30px rgba(15,23,42,0.12)", borderRadius: 4, padding: "56px", outline: "none" }}
            />
            <style>{DOC_CSS}</style>
          </div>
        </div>
      </div>
    </div>
  );
}
