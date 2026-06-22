"use client";

import { useEffect, useState, useCallback } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/platform/ui";
import { HardDrive, Database, Server, Plus, Trash2, CheckCircle2, Copy } from "lucide-react";

function fmt(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  const u = ["KB", "MB", "GB", "TB"]; let v = n / 1024; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}
const MB = 1024 * 1024;
const pct = (u: number, c: number) => (c ? Math.min(100, Math.round((u / c) * 100)) : 0);
const barColor = (p: number) => (p >= 90 ? "#dc2626" : p >= 70 ? "#f59e0b" : "#6366f1");

interface Pool { name: string; label: string; usedBytes: number; capacityBytes: number; hasToken: boolean; isActive: boolean; source: "env" | "db" }
interface Row { companyId: string; name: string; slug: string; usedBytes: number; docCount: number; quotaBytes: number | null }
interface Data {
  overview: { pools: Pool[]; totalCapacity: number; totalUsed: number; safetyBytes: number };
  activePool: string;
  companies: Row[];
}

export default function AdminStoragePage() {
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState({ label: "", name: "", token: "", capacityMb: "2048" });
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setData(await fetch("/api/admin/storage").then((r) => r.json()));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addPool() {
    setErr(""); setAdding(true);
    const res = await fetch("/api/admin/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, name: form.name || form.label }) });
    setAdding(false);
    if (res.ok) { setForm({ label: "", name: "", token: "", capacityMb: "2048" }); load(); }
    else { const j = await res.json().catch(() => ({})); setErr(j.error || "Could not add pool"); }
  }
  async function activate(name: string) {
    await fetch("/api/admin/storage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activatePool: name }) });
    load();
  }
  async function removePool(name: string) {
    if (!confirm(`Remove pool "${name}"?`)) return;
    const res = await fetch(`/api/admin/storage?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || "Could not remove"); } else load();
  }
  async function saveQuota(companyId: string, mb: string) {
    const quotaBytes = mb.trim() === "" ? null : Math.round(parseFloat(mb) * MB);
    await fetch("/api/admin/storage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, quotaBytes }) });
    load();
  }

  const ov = data?.overview;
  const totalPct = ov ? pct(ov.totalUsed, ov.totalCapacity) : 0;

  return (
    <PlatformShell>
      <div className="w-full space-y-6" style={{ padding: 24 }}>
        <PageHeader title="Storage" subtitle="UploadThing accounts (pools), usage, and per-company limits" />

        {/* Total */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={16} className="text-indigo-500" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Total capacity</span>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>
              {ov ? `${fmt(ov.totalUsed)} of ${fmt(ov.totalCapacity)} · ${ov.pools.length} pool${ov.pools.length > 1 ? "s" : ""}` : "—"}
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
            <div style={{ width: `${totalPct}%`, height: "100%", background: barColor(totalPct), transition: "width .3s" }} />
          </div>
        </Card>

        {/* Pools */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Server size={16} className="text-indigo-500" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Storage pools</span>
          </div>
          <div className="space-y-2.5 mb-5">
            {(ov?.pools ?? []).map((p) => {
              const pp = pct(p.usedBytes, p.capacityBytes);
              const active = data?.activePool === p.name;
              return (
                <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg" style={{ border: "1px solid #eef0f5" }}>
                  <div style={{ minWidth: 130 }}>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</span>
                      {active && <CheckCircle2 size={13} className="text-emerald-500" />}
                      <span className="px-1.5 rounded text-[9.5px] font-bold" style={{ background: p.source === "env" ? "#f1f5f9" : "#eef2ff", color: p.source === "env" ? "#64748b" : "#4f46e5" }}>{p.source}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmt(p.usedBytes)} / {fmt(p.capacityBytes)}</span>
                  </div>
                  <div className="flex-1"><div style={{ height: 7, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}><div style={{ width: `${pp}%`, height: "100%", background: barColor(pp) }} /></div></div>
                  <button onClick={() => activate(p.name)} disabled={active || !p.hasToken} className="px-3 h-8 rounded-lg text-[12px] font-semibold border disabled:opacity-50" style={{ background: active ? "#ecfdf5" : "#fff", color: active ? "#059669" : "#475569", borderColor: active ? "#a7f3d0" : "#e2e8f0" }}>{active ? "Active" : "Make active"}</button>
                  {p.source === "db" && <button onClick={() => removePool(p.name)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>}
                </div>
              );
            })}
          </div>

          {/* Add pool */}
          <div className="rounded-lg p-4" style={{ background: "#fafbfc", border: "1px dashed #d1d9e6" }}>
            <div className="flex items-center gap-1.5 mb-3"><Plus size={15} className="text-indigo-500" /><span style={{ fontSize: 13, fontWeight: 700 }}>Add UploadThing account</span></div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input className="inp" placeholder="Label (e.g. Account 2)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              <input className="inp" placeholder="id (e.g. pool2)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="inp" placeholder="Capacity (MB)" value={form.capacityMb} onChange={(e) => setForm({ ...form, capacityMb: e.target.value })} />
              <button onClick={addPool} disabled={adding || !form.token || !form.label} className="inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50">{adding ? "Adding…" : "Add pool"}</button>
            </div>
            <input className="inp mt-3" placeholder="UPLOADTHING_TOKEN (paste the account's token)" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} style={{ fontFamily: "monospace", fontSize: 11 }} />
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 6 }}>The token is encrypted before storage. New uploads target the active pool and fail over to a pool with space.</div>
            {err && <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6 }}>{err}</div>}
          </div>
        </Card>

        {/* Companies */}
        <Card>
          <div className="flex items-center gap-2 mb-1"><Database size={16} className="text-indigo-500" /><span style={{ fontSize: 14, fontWeight: 700 }}>By company</span></div>
          <p style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>No fixed limit per company — leave blank for shared access, or set a cap for a specific company.</p>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead><tr style={{ textAlign: "left", color: "#64748b", fontSize: 11.5 }}>
                <th style={{ padding: "6px 8px" }}>Company</th><th style={{ padding: "6px 8px" }}>Company ID</th><th style={{ padding: "6px 8px" }}>Used</th><th style={{ padding: "6px 8px" }}>Docs</th><th style={{ padding: "6px 8px" }}>Limit (MB · blank = none)</th>
              </tr></thead>
              <tbody>
                {(data?.companies ?? []).map((c) => (
                  <tr key={c.companyId} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px", fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: "8px" }}>
                      <button onClick={() => navigator.clipboard?.writeText(c.companyId)} className="inline-flex items-center gap-1 text-[11.5px] font-mono text-slate-500 hover:text-indigo-600" title="Copy full ID">
                        <span>{c.slug}</span><span style={{ color: "#cbd5e1" }}>·</span><span>{c.companyId.slice(0, 8)}…</span><Copy size={11} />
                      </button>
                    </td>
                    <td style={{ padding: "8px" }}>{fmt(c.usedBytes)}</td>
                    <td style={{ padding: "8px", color: "#64748b" }}>{c.docCount}</td>
                    <td style={{ padding: "8px" }}><input className="inp" style={{ width: 120, height: 32 }} placeholder="no limit" defaultValue={c.quotaBytes != null ? String(Math.round(c.quotaBytes / MB)) : ""} onBlur={(e) => saveQuota(c.companyId, e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PlatformShell>
  );
}
