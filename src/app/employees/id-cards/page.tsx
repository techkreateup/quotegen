"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import PageHeader from "@/components/PageHeader";
import { apiGet } from "@/lib/api";
import { renderHtmlToPdf } from "@/lib/pdf";
import { useToast } from "@/components/Toast";
import { Employee } from "@/lib/types";
import { ArrowLeft, Download, Palette, Printer, Search, ImageIcon, FileArchive, Layers } from "lucide-react";
import html2canvas from "html2canvas";
import JSZip from "jszip";

// C2 — ID card designer + generator. Renders CR80-sized (54×85.6mm) badges from
// each employee's photo/name/designation/employee ID + QR (encodes a verify URL).
// Print pipeline uses window.print(); bulk PDF via existing renderHtmlToPdf.

interface Settings { businessName: string; logoUrl: string; themeColor: string; address: string; city: string; state: string; email: string; phones: string[]; website: string }

const CR80_W = 340; // px @ ~64dpi preview; print CSS scales to 54×85.6mm
const CR80_H = 214;

export default function IdCardsPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  // Design tokens (local — no new model). Reset to defaults on load.
  const [accent, setAccent] = useState("#4F46E5");
  const [showBlood, setShowBlood] = useState(false);
  const [showValidThru, setShowValidThru] = useState(false);
  const [validThru, setValidThru] = useState("");
  const [showBack, setShowBack] = useState(true);

  const sheetRef = useRef<HTMLDivElement>(null);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [emps, s] = await Promise.all([
        apiGet<{ data: Employee[] }>("/api/employees?page=1&limit=200"),
        apiGet<Settings>("/api/settings"),
      ]);
      if (emps?.data) setEmployees(emps.data);
      if (s) { setSettings(s); if (s.themeColor) setAccent(s.themeColor); }
    })();
  }, []);

  const filtered = useMemo(() =>
    employees.filter(e => e.status === "Active" && (`${e.name} ${e.employeeCode} ${e.designation} ${e.department}`.toLowerCase().includes(q.toLowerCase())))
  , [employees, q]);

  const chosen = useMemo(() =>
    (selected.size ? filtered.filter(e => selected.has(e.id)) : filtered).slice(0, 100)
  , [filtered, selected]);

  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const e of chosen) {
        const url = `${window.location.origin}/employees?code=${encodeURIComponent(e.employeeCode)}`;
        try { next[e.id] = await QRCode.toDataURL(url, { margin: 0, width: 96 }); } catch {}
      }
      setQrs(next);
    })();
  }, [chosen]);

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(e => e.id)));
  }

  async function downloadPdf() {
    if (!sheetRef.current) return;
    setBusy(true);
    try {
      const pdf = await renderHtmlToPdf(sheetRef.current.innerHTML);
      pdf.save(`ID-cards-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch { toast.error("Could not build PDF"); } finally { setBusy(false); }
  }
  function print() { window.print(); }

  // Bulk PNG export — snapshots each card (front + back if enabled) to a PNG
  // and packs them into a single ZIP. Preserves the on-screen accent + branding.
  async function downloadZip() {
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      const nodes = sheetRef.current?.querySelectorAll<HTMLElement>("[data-card]");
      if (!nodes || nodes.length === 0) throw new Error("No cards rendered");
      for (const node of Array.from(nodes)) {
        const empId = node.getAttribute("data-empid") || "unknown";
        const side = node.getAttribute("data-side") || "front";
        const emp = chosen.find(e => e.id === empId);
        const safeName = (emp?.name || empId).replace(/[^\w \-]+/g, "").trim().slice(0, 40);
        const code = emp?.employeeCode || empId;
        const canvas = await html2canvas(node, { scale: 3, useCORS: true, backgroundColor: "#ffffff", logging: false });
        const dataUrl = canvas.toDataURL("image/png").split(",")[1];
        zip.file(`${safeName || code}-${code}-${side}.png`, dataUrl, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ID-cards-${new Date().toISOString().slice(0,10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error("Could not build ZIP"); } finally { setBusy(false); }
  }

  const Card = ({ e }: { e: Employee }) => (
    <div data-card data-side="front" data-empid={e.id} style={{ width: CR80_W, height: CR80_H, border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", background: "#fff", position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ background: accent, color: "white", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        {settings?.logoUrl ? <img src={settings.logoUrl} alt="" style={{ height: 20, filter: "brightness(0) invert(1)" }} /> : null}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{settings?.businessName || "Company"}</div>
      </div>
      <div style={{ padding: "10px 12px 8px", display: "flex", gap: 10 }}>
        <div style={{ width: 72, height: 88, borderRadius: 6, background: "#F3F4F6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {e.photoUrl ? <img src={e.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={22} color="#9CA3AF" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", lineHeight: 1.2, wordBreak: "break-word" }}>{e.name}</div>
          <div style={{ fontSize: 10.5, color: accent, fontWeight: 700, marginTop: 2 }}>{e.designation || "—"}</div>
          {e.department ? <div style={{ fontSize: 10, color: "#6B7280", marginTop: 1 }}>{e.department}</div> : null}
          <div style={{ marginTop: 5, fontSize: 9.5, color: "#374151" }}>
            <div><b>ID:</b> {e.employeeCode}</div>
            {showBlood ? <div><b>Blood:</b> {"—"}</div> : null}
            {showValidThru && validThru ? <div><b>Valid:</b> {validThru}</div> : null}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 12, bottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        {qrs[e.id] ? <img src={qrs[e.id]} alt="" style={{ width: 44, height: 44 }} /> : <div style={{ width: 44, height: 44, background: "#F3F4F6" }} />}
        <div style={{ fontSize: 8.5, color: "#9CA3AF", maxWidth: 140, lineHeight: 1.2 }}>Verify: scan code · Return if found to {settings?.email || settings?.businessName || "issuing company"}</div>
      </div>
      <div style={{ position: "absolute", right: 0, top: 34, bottom: 0, width: 6, background: accent }} />
    </div>
  );

  const BackCard = ({ e }: { e: Employee }) => (
    <div data-card data-side="back" data-empid={e.id} style={{ width: CR80_W, height: CR80_H, border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", background: "#fff", position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ background: accent, color: "white", padding: "6px 12px", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
        Emergency & Return
      </div>
      <div style={{ padding: "10px 12px", fontSize: 10, color: "#374151", lineHeight: 1.4 }}>
        {e.emergencyContact ? (
          <div style={{ marginBottom: 6 }}><b style={{ color: "#111827" }}>Emergency contact:</b> {e.emergencyContact}</div>
        ) : null}
        {e.address ? (
          <div style={{ marginBottom: 6 }}><b style={{ color: "#111827" }}>Address:</b> {e.address}</div>
        ) : null}
        {e.pan ? (
          <div style={{ marginBottom: 6 }}><b style={{ color: "#111827" }}>PAN:</b> {e.pan}</div>
        ) : null}
        <div style={{ marginTop: 8, padding: "6px 8px", background: "#F9FAFB", border: "1px dashed #E5E7EB", borderRadius: 6, fontSize: 9, color: "#6B7280" }}>
          <b style={{ color: "#111827" }}>If found:</b> please return to {settings?.businessName || "the issuing company"}
          {settings?.email ? `, ${settings.email}` : ""}
          {settings?.phones?.[0] ? ` · ${settings.phones[0]}` : ""}.
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: accent }} />
      <div style={{ position: "absolute", right: 12, bottom: 8, fontSize: 8.5, color: "#9CA3AF" }}>ID: {e.employeeCode}</div>
    </div>
  );

  return (
    <div className="w-full space-y-4">
      <PageHeader title="Employee ID Cards" breadcrumbs={[{ label: "HR" }, { label: "ID Cards" }]}
        action={<Link href="/employees" className="btn btn-sm"><ArrowLeft size={13} /> Employees</Link>} />

      <div className="card p-4 no-print flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="lbl">Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="name / code / dept" className="inp pl-8" />
          </div>
        </div>
        <div>
          <label className="lbl"><Palette size={11} className="inline" /> Accent</label>
          <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="h-10 w-14 rounded border border-slate-200 cursor-pointer" />
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-slate-600 pb-2">
          <input type="checkbox" checked={showBlood} onChange={e => setShowBlood(e.target.checked)} /> Blood group
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-slate-600 pb-2">
          <input type="checkbox" checked={showValidThru} onChange={e => setShowValidThru(e.target.checked)} /> Valid till
        </label>
        {showValidThru ? <input type="date" value={validThru} onChange={e => setValidThru(e.target.value)} className="inp !w-40" /> : null}
        <label className="flex items-center gap-1.5 text-[12.5px] text-slate-600 pb-2">
          <input type="checkbox" checked={showBack} onChange={e => setShowBack(e.target.checked)} /> <Layers size={12} /> Back-face
        </label>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={toggleAll} className="btn btn-sm">{selected.size ? "Clear" : "Select all"}</button>
          <button onClick={print} className="btn btn-sm"><Printer size={13} /> Print</button>
          <button onClick={downloadZip} disabled={busy || chosen.length === 0} className="btn btn-sm"><FileArchive size={13} /> {busy ? "Building…" : "ZIP (PNGs)"}</button>
          <button onClick={downloadPdf} disabled={busy} className="btn btn-sm btn-primary"><Download size={13} /> {busy ? "Building…" : "Download PDF"}</button>
        </div>
      </div>

      <div className="card p-3 no-print">
        <div className="text-[11.5px] text-slate-500 mb-2">Pick which employees to include ({filtered.length} active). Empty selection prints all filtered.</div>
        <div className="flex flex-wrap gap-1.5">
          {filtered.map(e => (
            <button key={e.id} onClick={() => toggle(e.id)}
              className={`text-[11.5px] px-2 py-1 rounded-md border ${selected.has(e.id) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
              {e.name} <span className="opacity-60">· {e.employeeCode}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={sheetRef} className="mx-auto bg-white p-6" style={{ maxWidth: 820 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(2, ${CR80_W}px)`, gap: 16 }}>
          {chosen.map(e => (
            <React.Fragment key={e.id}>
              <Card e={e} />
              {showBack ? <BackCard e={e} /> : null}
            </React.Fragment>
          ))}
        </div>
        {chosen.length === 0 ? <div className="text-center text-slate-400 text-[13px] py-12">No employees match.</div> : null}
      </div>

      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>
    </div>
  );
}
