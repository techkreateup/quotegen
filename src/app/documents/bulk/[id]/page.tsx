"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { useDialog } from "@/components/Dialog";
import { uploadFiles } from "@/lib/uploadthing-client";
import { renderHtmlToPdf } from "@/lib/pdf";
import { DOC_TEMPLATES, renderDocument, DOC_CSS, type DocTemplate, type Brand } from "@/lib/doc-templates";
import {
  ArrowLeft, Plus, Trash2, Download, Upload, FileStack, Loader2, FileSpreadsheet, CheckCircle2,
} from "lucide-react";
import JSZip from "jszip";

const SAVE_CATEGORIES = ["HR", "Legal", "Onboarding", "Payroll", "Finance", "Compliance", "Tax", "Personal", "Other"];
const MAX_ROWS = 100;
const EST_BYTES_PER_DOC = 180 * 1024; // rough estimate for the storage pre-check

const proxyLogos = (html: string) =>
  html.replace(/(<img[^>]+src=")(https:\/\/[^"]*(?:ufs\.sh|utfs\.io)[^"]*)(")/gi,
    (_m, a, url, b) => `${a}/api/proxy-image?url=${encodeURIComponent(url)}${b}`);

function csvEscape(s: string) { return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let field = "", row: string[] = [], inq = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inq) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inq = false; } else field += c; }
    else if (c === '"') inq = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
function sanitizeName(s: string) { return (s || "document").replace(/[^\w \-]+/g, "").trim().slice(0, 60) || "document"; }

export default function BulkCreatePage() {
  const { id } = useParams();
  const template: DocTemplate | undefined = DOC_TEMPLATES.find((t) => t.id === String(id));
  const toast = useToast();
  const dialog = useDialog();
  const csvRef = useRef<HTMLInputElement>(null);

  const [brand, setBrand] = useState<Brand>({ name: "Your Company", accent: "#6366f1", showLogo: true });
  const cols = useMemo(() => (template ? template.fields.filter((f) => f.key !== "date") : []), [template]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [category, setCategory] = useState("HR");
  const [saveToVault, setSaveToVault] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      const s = d.settings ?? d;
      if (s) setBrand((b) => ({ ...b, name: s.businessName || b.name, logoUrl: s.logoUrl || undefined, address: s.address || undefined, accent: s.themeColor || b.accent }));
    }).catch(() => {});
    if (template) setRows(Array.from({ length: 3 }, () => Object.fromEntries(template.fields.filter((f) => f.key !== "date").map((f) => [f.key, ""]))));
  }, [template]);

  function addRow() { if (rows.length < MAX_ROWS) setRows((r) => [...r, Object.fromEntries(cols.map((c) => [c.key, ""]))]); }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }
  function setCell(i: number, key: string, val: string) { setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: val } : row))); }

  function downloadCsvTemplate() {
    const header = cols.map((c) => c.key).join(",");
    const sample = cols.map((c) => csvEscape(c.placeholder || c.label)).join(",");
    const blob = new Blob([`${header}\n${sample}\n`], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${template?.id || "template"}-bulk.csv`; a.click();
  }

  async function onCsv(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { toast.error("CSV needs a header row and at least one data row"); return; }
    const headers = parsed[0].map((h) => h.trim());
    const keyByHeader = headers.map((h) => cols.find((c) => c.key.toLowerCase() === h.toLowerCase() || c.label.toLowerCase() === h.toLowerCase())?.key ?? null);
    const newRows = parsed.slice(1, MAX_ROWS + 1).map((r) => {
      const row: Record<string, string> = Object.fromEntries(cols.map((c) => [c.key, ""]));
      r.forEach((val, i) => { const k = keyByHeader[i]; if (k) row[k] = val.trim(); });
      return row;
    });
    setRows(newRows);
    toast.success(`Loaded ${newRows.length} rows from CSV`);
  }

  async function generate() {
    if (!template) return;
    const primary = cols[0]?.key;
    const valid = rows.filter((r) => Object.values(r).some((v) => v.trim()) && (!primary || r[primary]?.trim()));
    if (valid.length === 0) { toast.error("Add at least one row with data"); return; }

    if (saveToVault) {
      try {
        const d = await fetch("/api/documents").then((r) => r.json());
        const q = d?.storage?.quotaBytes;
        const est = valid.length * EST_BYTES_PER_DOC;
        if (q && (d.storage.companyBytes + est) > q) {
          const ok = await dialog.confirm({ title: "This batch may exceed your storage", message: `Generating ${valid.length} documents (~${Math.round(est / 1024 / 1024)} MB) could pass your storage limit. Continue saving to the vault?`, confirmLabel: "Save anyway", cancelLabel: "Download only", tone: "danger" });
          if (!ok) setSaveToVault(false);
        }
      } catch { /* ignore pre-check failure */ }
    }

    const willSave = saveToVault;
    setResult(null);
    setProgress({ done: 0, total: valid.length });
    const zip = new JSZip();
    const today = new Date().toISOString().slice(0, 10);
    let ok = 0, failed = 0;

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      try {
        const vals = { ...row, date: new Date().toLocaleDateString() };
        const html = `<style>${DOC_CSS}</style>${proxyLogos(renderDocument(template, vals, brand))}`;
        const pdf = await renderHtmlToPdf(html);
        const blob = pdf.output("blob");
        const label = sanitizeName(row[primary] || `${i + 1}`);
        zip.file(`${template.title} - ${label}.pdf`, blob);
        if (willSave) {
          const file = new File([blob], `${template.title} - ${label}.pdf`, { type: "application/pdf" });
          await uploadFiles("document", { files: [file], input: { category: category as never } });
        }
        ok++;
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: valid.length });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(zipBlob); a.download = `${template.title} - bulk ${today}.zip`; a.click();
    setProgress(null);
    setResult({ ok, failed });
    toast.success(`Generated ${ok} document${ok === 1 ? "" : "s"}${willSave ? " (saved to vault)" : ""}`);
  }

  if (!template) {
    return (<div className="w-full"><PageHeader title="Template not found" subtitle="" /><Link href="/documents/templates" className="text-indigo-600 font-semibold text-sm">← Back to templates</Link></div>);
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader title={`Bulk create — ${template.title}`} subtitle="Generate many personalized documents at once (e.g. offer letters for a whole batch)" breadcrumbs={[{ label: "Documents", href: "/documents" }, { label: "Templates", href: "/documents/templates" }, { label: "Bulk" }]} />
        <Link href={`/documents/templates/${template.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 shrink-0" style={{ textDecoration: "none" }}><ArrowLeft size={15} /> Single editor</Link>
      </div>

      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-2.5" style={{ padding: 14 }}>
        <button onClick={downloadCsvTemplate} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50"><FileSpreadsheet size={14} /> Download CSV template</button>
        <button onClick={() => csvRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50"><Upload size={14} /> Upload CSV</button>
        <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onCsv(f); }} />
        <div className="flex-1" />
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{rows.length} row{rows.length === 1 ? "" : "s"} · max {MAX_ROWS}</span>
      </div>

      {/* Grid */}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="w-full" style={{ fontSize: 13, minWidth: 520 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={{ padding: "8px 10px", width: 36, color: "#94a3b8", fontSize: 11 }}>#</th>
              {cols.map((c) => <th key={c.key} style={{ padding: "8px 10px", fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>{c.label}</th>)}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "4px 10px", color: "#cbd5e1", fontSize: 11 }}>{i + 1}</td>
                {cols.map((c) => (
                  <td key={c.key} style={{ padding: "4px 6px" }}>
                    <input className="inp" style={{ height: 34, fontSize: 12.5 }} value={row[c.key] ?? ""} placeholder={c.placeholder} onChange={(e) => setCell(i, c.key, e.target.value)} />
                  </td>
                ))}
                <td><button onClick={() => removeRow(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 10, borderTop: "1px solid #f1f5f9" }}>
          <button onClick={addRow} disabled={rows.length >= MAX_ROWS} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 text-slate-600 text-[12.5px] font-semibold hover:bg-slate-50 disabled:opacity-50"><Plus size={13} /> Add row</button>
        </div>
      </div>

      {/* Output + generate */}
      <div className="card flex flex-wrap items-center gap-3" style={{ padding: 16 }}>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={saveToVault} onChange={(e) => setSaveToVault(e.target.checked)} /><span style={{ fontSize: 13 }}>Save to Document Vault</span></label>
        {saveToVault && <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 130, height: 38 }}>{SAVE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
        <div className="flex-1" />
        <button onClick={generate} disabled={!!progress} className="inline-flex items-center gap-2 px-5 h-11 rounded-lg bg-indigo-600 text-white text-[13.5px] font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {progress ? <Loader2 size={16} className="animate-spin" /> : <FileStack size={16} />}
          {progress ? `Generating ${progress.done}/${progress.total}…` : "Generate documents"}
        </button>
      </div>

      {result && (
        <div className="card flex items-center gap-2" style={{ padding: 14, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span style={{ fontSize: 13, color: "#166534" }}>Done — {result.ok} generated{saveToVault ? " & saved to vault" : ""}{result.failed ? `, ${result.failed} failed` : ""}. ZIP downloaded.</span>
          {saveToVault && <Link href="/documents" className="ml-auto text-[12.5px] font-semibold text-indigo-600">View in vault →</Link>}
        </div>
      )}
    </div>
  );
}
