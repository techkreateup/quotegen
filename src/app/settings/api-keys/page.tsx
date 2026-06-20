"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { KeyRound, Copy, Trash2, Plus } from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/settings/api-keys");
    if (res.ok) setKeys(await res.json());
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setNewKey(d.key);
      setName("");
      load();
    } catch {
      toast.error("Could not create key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key? Applications using it will stop working.")) return;
    const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Key revoked"); load(); }
    else toast.error("Failed to revoke key");
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="API Keys"
        subtitle="Programmatic access to your QuoteGen data"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "API Keys" }]}
      />

      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="av av-sm av-grad" style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)" }}>
            <KeyRound size={13} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Create a new key</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)" }}>Use it with the <code>Authorization: Bearer</code> header.</p>
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <input className="inp" placeholder="Key name (e.g. Zapier)" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 280 }} />
          <button onClick={create} disabled={busy} className="btn btn-primary"><Plus size={14} /> Generate</button>
        </div>

        {newKey && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
            <p className="text-[12px] font-semibold text-emerald-800 mb-1">Copy your key now — it won&apos;t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="text-[12px] break-all flex-1">{newKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }} className="btn btn-ghost btn-icon" aria-label="Copy key"><Copy size={14} /></button>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Last used</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No API keys yet.</td></tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-slate-50">
                <td className="px-4 py-3 font-medium">{k.name}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-slate-500">{k.keyPrefix}</td>
                <td className="px-4 py-3 text-slate-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString("en-IN") : "Never"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${k.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {k.isActive ? "Active" : "Revoked"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {k.isActive && (
                    <button onClick={() => revoke(k.id)} className="act del" aria-label="Revoke key"><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Quick start</h3>
        <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100 text-[12px] overflow-x-auto">{`curl https://your-domain.com/api/public/v1/clients \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
      </div>
    </div>
  );
}
