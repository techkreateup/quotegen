"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { useUploadThing } from "@/lib/uploadthing-client";
import { renderHtmlToPdf } from "@/lib/pdf";
import { DOC_TEMPLATES, renderDocument, renderSignatories, sampleValues, DOC_CSS, type DocTemplate, type Brand, type DocSignatory } from "@/lib/doc-templates";
import SignaturePicker, { type PickedSignature } from "@/components/SignaturePicker";
import {
  ArrowLeft, Printer, Download, Save, Loader2, RotateCcw, ImageIcon, Copy, FileStack, History, X,
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
  const dialog = useDialog();
  const searchParams = useSearchParams();
  const savedId = searchParams.get("saved");
  const vParam = searchParams.get("v");
  const editorRef = useRef<HTMLDivElement>(null);
  const booted = useRef(false);

  const [brand, setBrand] = useState<Brand>({ name: "Your Company", accent: "#6366f1", showLogo: true });
  const [values, setValues] = useState<Record<string, string>>({});
  const [category, setCategory] = useState("HR");
  const [busy, setBusy] = useState<"" | "pdf" | "vault">("");
  const [touched, setTouched] = useState(false); // manual edits made?
  const [versions, setVersions] = useState<{ version: number; createdByName: string; createdAt: string }[] | null>(null);
  const [curVersion, setCurVersion] = useState<number | null>(null);
  // Designated signatories stamped at the foot of the document (signing authority).
  const [signatories, setSignatories] = useState<DocSignatory[]>([]);
  const [pickingSig, setPickingSig] = useState(false);
  const [meta, setMeta] = useState<{ createdByName: string; createdByRole: string } | null>(null);

  // Keep a single signatures block (marked data-sig-block) live at the foot of
  // the editor so designated signs are VISIBLE in the preview and remain part of
  // the editable document (movable/customizable). Replaces the old export-only
  // stamping so the exported PDF matches exactly what the user sees.
  const syncSignBlock = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.querySelector("[data-sig-block]")?.remove();
    if (!signatories.length) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = renderSignatories(signatories);
    const block = wrap.firstElementChild as HTMLElement | null;
    if (!block) return;
    block.setAttribute("data-sig-block", "1");
    // Place signatures above the footer band (inside the .qg-doc wrapper) so the
    // contact footer stays at the very bottom, matching the exported layout.
    const doc = el.querySelector(".qg-doc") || el;
    const foot = doc.querySelector(".doc-foot");
    if (foot) doc.insertBefore(block, foot); else doc.appendChild(block);
  }, [signatories]);

  // Editor body WITHOUT the auto-managed signatures block — used when persisting
  // the template HTML (signatories are stored separately and re-stamped on load,
  // so keeping the block in the saved HTML would duplicate it).
  const cleanBody = (html: string) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp.querySelectorAll("[data-sig-block]").forEach((n) => n.remove());
    return tmp.innerHTML;
  };

  async function openHistory() {
    if (!savedId) return;
    const d = await fetch(`/api/templates/${savedId}`).then((r) => r.json()).catch(() => null);
    if (d?.template) { setCurVersion(d.template.version); setVersions(d.versions ?? []); }
  }
  async function restoreVersion(v: number | "current") {
    if (!savedId) return;
    const url = v === "current" ? `/api/templates/${savedId}` : `/api/templates/${savedId}?v=${v}`;
    const d = await fetch(url).then((r) => r.json()).catch(() => null);
    if (d?.selectedHtml && editorRef.current) { editorRef.current.innerHTML = cleanBody(d.selectedHtml); setTouched(true); setVersions(null); syncSignBlock(); toast.success(v === "current" ? "Loaded current version" : `Loaded version ${v}`); }
  }

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      const s = d.settings ?? d;
      if (s) setBrand((b) => ({
        ...b,
        name: s.businessName || b.name,
        logoUrl: s.logoUrl || undefined,
        address: [s.address, s.city, s.state, s.pincode].filter(Boolean).join(", ") || s.address || undefined,
        website: s.website || undefined,
        email: s.email || undefined,
        phone: Array.isArray(s.phones) ? s.phones.filter(Boolean).join(", ") || undefined : undefined,
        gstin: s.gstin || undefined,
        footer: s.documentFooter || undefined,
        accent: s.themeColor || b.accent,
      }));
    }).catch(() => {});
    // Pre-fill with realistic sample data so the preview reflects a complete
    // document immediately (users edit it in the quick-fill panel).
    if (template) setValues(sampleValues(template));
  }, [template]);

  // Boot once: load a saved customization (org-wide, optionally a version) if
  // ?saved=, else render the template.
  useEffect(() => {
    if (!template || !editorRef.current || booted.current) return;
    booted.current = true;
    if (savedId) {
      fetch(`/api/templates/${savedId}${vParam ? `?v=${vParam}` : ""}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.selectedHtml && editorRef.current) { editorRef.current.innerHTML = cleanBody(d.selectedHtml); setTouched(true); }
          else if (editorRef.current && template) editorRef.current.innerHTML = renderDocument(template, values, brand);
          if (Array.isArray(d.template?.signatories)) setSignatories(d.template.signatories.filter((s: DocSignatory) => s?.imageUrl));
          if (d.template) setMeta({ createdByName: d.template.createdByName || "", createdByRole: d.template.createdByRole || "" });
        })
        .catch(() => { if (editorRef.current && template) editorRef.current.innerHTML = renderDocument(template, values, brand); });
      return;
    }
    editorRef.current.innerHTML = renderDocument(template, values, brand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  // Live: quick-fill + branding changes re-render (until manually edited / saved-loaded).
  useEffect(() => {
    if (booted.current && editorRef.current && template && !touched) editorRef.current.innerHTML = renderDocument(template, values, brand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, brand]);

  // Re-stamp the signatures block whenever signatories change OR the body was
  // re-rendered above (values/brand). Runs after the render effect so the block
  // survives a rebuild and stays visible in the preview.
  useEffect(() => {
    if (booted.current) syncSignBlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatories, values, brand, syncSignBlock]);

  async function startFresh() {
    if (touched && !(await dialog.confirm({ title: "Start fresh?", message: "This clears your edits and rebuilds the document from the template.", confirmLabel: "Start fresh", tone: "danger" }))) return;
    if (editorRef.current && template) { editorRef.current.innerHTML = renderDocument(template, values, brand); setTouched(false); }
  }

  async function saveAsTemplate(duplicate = false) {
    const CATS = ["Onboarding", "HR", "Legal", "Finance", "Payroll", "Compliance", "Tax", "Personal", "Other"];
    const res = await dialog.prompt({
      title: duplicate ? "Duplicate as my template" : "Save as my template",
      message: "Name and categorise it so it's easy to find in your template library.",
      confirmLabel: "Save",
      fields: [
        { label: "Template name", placeholder: template?.title, defaultValue: `${template?.title ?? "Template"}${duplicate ? " (copy)" : ""}` },
        { label: "Category", type: "select", defaultValue: template?.category ?? "Other", options: CATS.map((c) => ({ value: c, label: c })) },
      ],
    });
    if (!res) return;
    const name = (res[0] || template?.title || "Template").trim();
    const category = res[1] || template?.category || "Other";
    const r = await fetch("/api/templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedId && !duplicate ? savedId : undefined, baseId: id, name, category, html: cleanBody(editorRef.current?.innerHTML ?? ""), signatories }),
    });
    if (r.ok) {
      const d = await r.json();
      toast.success(d.updated ? `Saved — version ${d.savedTemplate.version}` : duplicate ? "Duplicated to your templates" : "Saved to your templates");
    } else {
      toast.error("Could not save template");
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

  async function insertTable() {
    const res = await dialog.prompt({ title: "Insert table", confirmLabel: "Insert", fields: [
      { label: "Rows", type: "number", defaultValue: "3" },
      { label: "Columns", type: "number", defaultValue: "3" },
    ] });
    if (!res) return;
    const rows = Math.min(20, Math.max(1, parseInt(res[0] || "0", 10)));
    const cols = Math.min(10, Math.max(1, parseInt(res[1] || "0", 10)));
    if (!rows || !cols) return;
    editorRef.current?.focus();
    let html = '<table style="width:100%;border-collapse:collapse;margin:10px 0">';
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) html += '<td style="border:1px solid #cbd5e1;padding:6px 9px;min-width:40px">&nbsp;</td>';
      html += "</tr>";
    }
    html += "</table><p><br/></p>";
    cmd("insertHTML", html);
  }
  async function insertLink() {
    const res = await dialog.prompt({ title: "Insert link", confirmLabel: "Add link", fields: [{ label: "Link URL", type: "url", placeholder: "https://", defaultValue: "https://" }] });
    if (res && res[0]) { editorRef.current?.focus(); cmd("createLink", res[0]); }
  }

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
            <div className="flex items-center justify-between mb-2.5">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Quick fill</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { if (template) { setValues(sampleValues(template)); setTouched(false); } }} className="text-[11.5px] font-semibold text-indigo-600">Sample</button>
                <button type="button" onClick={() => { if (template) { const e: Record<string, string> = {}; for (const f of template.fields) e[f.key] = f.type === "date" ? new Date().toISOString().slice(0, 10) : ""; setValues(e); setTouched(false); } }} className="text-[11.5px] font-semibold text-slate-500">Clear</button>
              </div>
            </div>
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
            <button onClick={startFresh} className="w-full mt-3 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50"><RotateCcw size={13} /> Start fresh</button>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Branding</div>
            <div className="flex items-center justify-between mb-2"><span style={{ fontSize: 13 }}>Accent colour</span><input type="color" value={brand.accent} onChange={(e) => setBrand((b) => ({ ...b, accent: e.target.value }))} style={{ width: 38, height: 28, border: "none", background: "none", cursor: "pointer" }} /></div>
            <label className="flex items-center justify-between cursor-pointer"><span style={{ fontSize: 13 }} className="flex items-center gap-1.5"><ImageIcon size={13} /> Show logo</span><input type="checkbox" checked={brand.showLogo} onChange={(e) => setBrand((b) => ({ ...b, showLogo: e.target.checked }))} /></label>
          </div>

          {/* Designated signatories (stamped at the foot of the document) */}
          <div className="card" style={{ padding: 16 }}>
            <div className="flex items-center justify-between mb-2">
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Signatories</div>
              <button onClick={() => setPickingSig((v) => !v)} className="text-[12px] font-semibold text-indigo-600">{pickingSig ? "Close" : "+ Add"}</button>
            </div>
            {meta?.createdByName && <p style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 8 }}>Created by <strong>{meta.createdByName}</strong>{meta.createdByRole ? ` · ${meta.createdByRole}` : ""}</p>}
            {pickingSig && (
              <div className="mb-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                <SignaturePicker onPick={(s: PickedSignature) => { setSignatories((arr) => [...arr, { name: s.name, role: s.role, imageUrl: s.imageUrl }]); setPickingSig(false); }} />
              </div>
            )}
            {signatories.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--text-4)" }}>No signatories. Add a CEO / HR sign to stamp it onto the document.</p>
            ) : (
              <>
              <p style={{ fontSize: 11, color: "var(--text-4)", marginBottom: 8 }}>Signs appear at the foot of the preview — you can drag or edit them there like any content.</p>
              <div className="space-y-2">
                {signatories.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.imageUrl} alt="" className="h-8 object-contain" />
                    <div className="flex-1 min-w-0"><div style={{ fontSize: 12, fontWeight: 600 }} className="truncate">{s.name || "—"}</div><div style={{ fontSize: 10.5, color: "var(--text-3)" }} className="truncate">{s.role}</div></div>
                    <button onClick={() => setSignatories((arr) => arr.filter((_, idx) => idx !== i))} className="act del" style={{ width: 24, height: 24 }}><X size={12} /></button>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="space-y-2.5">
              <button onClick={print} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-slate-200 text-slate-700 text-[13px] font-semibold hover:bg-slate-50"><Printer size={15} /> Print</button>
              <button onClick={savePdf} disabled={!!busy} className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[13px] font-semibold hover:bg-indigo-100 disabled:opacity-50">{busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Save PDF</button>
              <div className="flex gap-2">
                <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 104 }}>{SAVE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                <button onClick={saveToVault} disabled={!!busy} className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50">{busy === "vault" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save to Vault</button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => saveAsTemplate(false)} className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50"><Save size={13} /> Save template</button>
                <button onClick={() => saveAsTemplate(true)} className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50"><Copy size={13} /> Duplicate</button>
              </div>
              <Link href={`/documents/bulk/${id}`} className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[12.5px] font-semibold hover:bg-indigo-100" style={{ textDecoration: "none" }}><FileStack size={14} /> Bulk create (many at once)</Link>
              {savedId && <button onClick={openHistory} className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50"><History size={14} /> Version history</button>}
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

      {/* Version history */}
      {versions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => setVersions(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <History size={15} className="text-indigo-500" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Version history</span>
              <button onClick={() => setVersions(null)} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto divide-y divide-slate-100">
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1"><div style={{ fontSize: 13, fontWeight: 700 }}>Current — v{curVersion}</div><div style={{ fontSize: 11, color: "var(--text-3)" }}>Live version</div></div>
                <button onClick={() => restoreVersion("current")} className="px-3 h-8 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">Load</button>
              </div>
              {versions.length === 0 && <div className="px-4 py-6 text-center text-slate-400 text-[12.5px]">No earlier versions yet. They&apos;re created each time you save over this template.</div>}
              {versions.map((v) => (
                <div key={v.version} className="flex items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1"><div style={{ fontSize: 13, fontWeight: 600 }}>Version {v.version}</div><div style={{ fontSize: 11, color: "var(--text-3)" }}>{v.createdByName || "—"} · {new Date(v.createdAt).toLocaleString()}</div></div>
                  <button onClick={() => restoreVersion(v.version)} className="px-3 h-8 rounded-lg border border-indigo-200 bg-indigo-50 text-[12px] font-semibold text-indigo-600 hover:bg-indigo-100">Restore</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
