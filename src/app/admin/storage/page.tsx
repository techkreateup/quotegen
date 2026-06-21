"use client";

import { useEffect, useState, useCallback } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/platform/ui";
import { HardDrive, Database, Server, Save } from "lucide-react";

function fmt(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  const u = ["KB", "MB", "GB", "TB"]; let v = n / 1024; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

interface Row { companyId: string; name: string; usedBytes: number; docCount: number; quotaBytes: number | null }
interface Data {
  config: { totalBytes: number; perCompanyBytes: number; safetyBytes: number; globalUsed: number };
  companies: Row[];
  pools: string[];
  activePool: string;
}

export default function AdminStoragePage() {
  const [data, setData] = useState<Data | null>(null);
  const [totalGb, setTotalGb] = useState("");
  const [perMb, setPerMb] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/storage").then((r) => r.json());
    setData(d);
    setTotalGb((d.config.totalBytes / GB).toFixed(2));
    setPerMb(String(Math.round(d.config.perCompanyBytes / MB)));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveSettings() {
    setSaving(true);
    await fetch("/api/admin/storage", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalBytes: Math.round(parseFloat(totalGb) * GB), perCompanyBytes: Math.round(parseFloat(perMb) * MB) }),
    });
    setSaving(false);
    load();
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

  const usedPct = data ? Math.min(100, Math.round((data.config.globalUsed / data.config.totalBytes) * 100)) : 0;

  return (
    <PlatformShell>
      <div className="w-full space-y-6" style={{ padding: 24 }}>
        <PageHeader title="Storage" subtitle="Document storage across all companies — capacity, usage, pools & quotas" />

        {/* Total capacity */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive size={16} className="text-indigo-500" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Platform capacity</span>
            <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>
              {data ? `${fmt(data.config.globalUsed)} used of ${fmt(data.config.totalBytes)}` : "—"}
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
            <div style={{ width: `${usedPct}%`, height: "100%", background: usedPct >= 90 ? "#dc2626" : usedPct >= 70 ? "#f59e0b" : "#6366f1", transition: "width .3s" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div>
              <label className="lbl">Total capacity (GB)</label>
              <input className="inp" value={totalGb} onChange={(e) => setTotalGb(e.target.value)} />
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>Raise after upgrading UploadThing or adding a pool</div>
            </div>
            <div>
              <label className="lbl">Default per-company (MB)</label>
              <input className="inp" value={perMb} onChange={(e) => setPerMb(e.target.value)} />
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>Fair-share cap so one tenant can&apos;t drain the pool</div>
            </div>
            <div className="flex items-end">
              <button onClick={saveSettings} disabled={saving} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-50">
                <Save size={14} /> {saving ? "Saving…" : "Save limits"}
              </button>
            </div>
          </div>
        </Card>

        {/* Storage pools */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Server size={16} className="text-indigo-500" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Storage pools</span>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
            Each pool is one UploadThing account. Add capacity by setting an
            <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4, margin: "0 4px" }}>UPLOADTHING_TOKEN_&lt;NAME&gt;</code>
            env var, then make it the active pool for new uploads.
          </p>
          <div className="flex flex-wrap gap-2">
            {(data?.pools ?? []).map((p) => (
              <button key={p} onClick={() => setActivePool(p)}
                className="px-3 h-9 rounded-lg text-[12.5px] font-semibold border"
                style={{ background: data?.activePool === p ? "#4f46e5" : "#fff", color: data?.activePool === p ? "#fff" : "#475569", borderColor: data?.activePool === p ? "#4f46e5" : "#e2e8f0" }}>
                {p}{data?.activePool === p ? " · active" : ""}
              </button>
            ))}
            {data && data.pools.length <= 1 && (
              <span style={{ fontSize: 12, color: "#94a3b8", alignSelf: "center" }}>Only the primary pool is configured.</span>
            )}
          </div>
        </Card>

        {/* Per-company breakdown */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-indigo-500" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>By company</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", fontSize: 11.5 }}>
                  <th style={{ padding: "6px 8px" }}>Company</th>
                  <th style={{ padding: "6px 8px" }}>Used</th>
                  <th style={{ padding: "6px 8px" }}>Docs</th>
                  <th style={{ padding: "6px 8px" }}>Quota (MB, blank = default)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.companies ?? []).map((c) => (
                  <tr key={c.companyId} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px", fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: "8px" }}>{fmt(c.usedBytes)}</td>
                    <td style={{ padding: "8px", color: "#64748b" }}>{c.docCount}</td>
                    <td style={{ padding: "8px" }}>
                      <input
                        className="inp" style={{ width: 130, height: 32 }}
                        defaultValue={c.quotaBytes != null ? String(Math.round(c.quotaBytes / MB)) : ""}
                        placeholder="default"
                        onBlur={(e) => saveQuota(c.companyId, e.target.value)}
                      />
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
