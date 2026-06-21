"use client";

import { useEffect, useState, useCallback } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/platform/ui";
import { HardDrive, Database, Server, Save, CheckCircle2 } from "lucide-react";

function fmt(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  const u = ["KB", "MB", "GB", "TB"]; let v = n / 1024; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;
const pct = (used: number, cap: number) => (cap ? Math.min(100, Math.round((used / cap) * 100)) : 0);
const barColor = (p: number) => (p >= 90 ? "#dc2626" : p >= 70 ? "#f59e0b" : "#6366f1");

interface Pool { name: string; usedBytes: number; capacityBytes: number; hasToken: boolean }
interface Row { companyId: string; name: string; usedBytes: number; docCount: number; quotaBytes: number | null }
interface Data {
  overview: { pools: Pool[]; totalCapacity: number; totalUsed: number; safetyBytes: number };
  activePool: string;
  companies: Row[];
}

export default function AdminStoragePage() {
  const [data, setData] = useState<Data | null>(null);
  const [poolGb, setPoolGb] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/storage").then((r) => r.json());
    setData(d);
    setPoolGb((d.overview.pools[0]?.capacityBytes / GB || 2).toFixed(2));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function savePoolCapacity() {
    setSaving(true);
    await fetch("/api/admin/storage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ poolCapacityBytes: Math.round(parseFloat(poolGb) * GB) }) });
    setSaving(false); load();
  }
  async function setActivePool(pool: string) {
    await fetch("/api/admin/storage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activePool: pool }) });
    load();
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
        <PageHeader title="Storage" subtitle="Document storage across all companies — capacity, pools, usage & per-company limits" />

        {/* Total capacity */}
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
          <div className="flex items-end gap-3 mt-4">
            <div>
              <label className="lbl">Capacity per pool (GB)</label>
              <input className="inp" value={poolGb} onChange={(e) => setPoolGb(e.target.value)} style={{ width: 140 }} />
            </div>
            <button onClick={savePoolCapacity} disabled={saving} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50">
              <Save size={14} /> {saving ? "Saving…" : "Save"}
            </button>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Total grows automatically as you add pools.</span>
          </div>
        </Card>

        {/* Pools */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Server size={16} className="text-indigo-500" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Storage pools</span>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
            Each pool is one UploadThing account. Add capacity by setting a
            <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, margin: "0 4px" }}>UPLOADTHING_TOKEN_&lt;NAME&gt;</code>
            env var — it appears here automatically. New uploads target the <strong>active</strong> pool (and auto-fail over to a pool with space).
          </p>
          <div className="space-y-2.5">
            {(ov?.pools ?? []).map((p) => {
              const pp = pct(p.usedBytes, p.capacityBytes);
              const active = data?.activePool === p.name;
              return (
                <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg" style={{ border: "1px solid #eef0f5" }}>
                  <div style={{ minWidth: 110 }}>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
                      {active && <CheckCircle2 size={13} className="text-emerald-500" />}
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmt(p.usedBytes)} / {fmt(p.capacityBytes)}</span>
                  </div>
                  <div className="flex-1">
                    <div style={{ height: 7, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
                      <div style={{ width: `${pp}%`, height: "100%", background: barColor(pp) }} />
                    </div>
                  </div>
                  <button onClick={() => setActivePool(p.name)} disabled={active || !p.hasToken}
                    className="px-3 h-8 rounded-lg text-[12px] font-semibold border disabled:opacity-50"
                    style={{ background: active ? "#ecfdf5" : "#fff", color: active ? "#059669" : "#475569", borderColor: active ? "#a7f3d0" : "#e2e8f0" }}>
                    {active ? "Active" : "Make active"}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Per-company */}
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Database size={16} className="text-indigo-500" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>By company</span>
          </div>
          <p style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>No fixed limit per company — leave quota blank to let a company use the shared pool. Set a value only to cap a specific company.</p>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", fontSize: 11.5 }}>
                  <th style={{ padding: "6px 8px" }}>Company</th>
                  <th style={{ padding: "6px 8px" }}>Used</th>
                  <th style={{ padding: "6px 8px" }}>Docs</th>
                  <th style={{ padding: "6px 8px" }}>Limit (MB · blank = none)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.companies ?? []).map((c) => (
                  <tr key={c.companyId} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px", fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: "8px" }}>{fmt(c.usedBytes)}</td>
                    <td style={{ padding: "8px", color: "#64748b" }}>{c.docCount}</td>
                    <td style={{ padding: "8px" }}>
                      <input className="inp" style={{ width: 130, height: 32 }} placeholder="no limit"
                        defaultValue={c.quotaBytes != null ? String(Math.round(c.quotaBytes / MB)) : ""}
                        onBlur={(e) => saveQuota(c.companyId, e.target.value)} />
                    </td>
                  </tr>
                ))}
                {data && data.companies.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>No companies yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PlatformShell>
  );
}
