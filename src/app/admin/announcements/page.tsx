"use client";

import { useCallback, useEffect, useState } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card, Badge } from "@/components/platform/ui";
import { Trash2 } from "lucide-react";
import { confirmDialog, alertDialog } from "@/components/Dialog";

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  audience: string;
  audienceName: string;
  isActive: boolean;
  endsAt: string | null;
  createdAt: string;
}

const sevTone = { INFO: "indigo", WARNING: "amber", CRITICAL: "red" } as const;

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"INFO" | "WARNING" | "CRITICAL">("INFO");
  const [audience, setAudience] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/admin/announcements").then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setItems(d.announcements);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, severity, audience: audience.trim() || "ALL" }),
    });
    setSaving(false);
    if (res.ok) { setTitle(""); setBody(""); setAudience(""); setSeverity("INFO"); load(); }
    else (await alertDialog({ title: "Notice", message: (await res.json()).error || "Failed" }));
  }

  async function toggle(a: Announcement) {
    await fetch(`/api/admin/announcements/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    load();
  }

  async function remove(a: Announcement) {
    if (!(await confirmDialog({ title: "Please confirm", tone: "danger", message: `Delete "${a.title}"?` }))) return;
    await fetch(`/api/admin/announcements/${a.id}`, { method: "DELETE" });
    load();
  }

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Announcements"
          subtitle="Broadcast banners to all companies or a single company"
          breadcrumbs={[{ label: "Platform" }, { label: "Announcements" }]}
        />
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="New announcement">
          <div className="space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body (optional)" rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
            <div className="flex gap-2">
              <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} aria-label="Severity" className="h-9 px-2 rounded-lg border border-slate-300 text-sm flex-1">
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Company ID (blank = all)" className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm" />
            <button onClick={create} disabled={saving || !title.trim()} className="w-full h-9 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              Publish
            </button>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          {items.length === 0 && <Card><p className="text-sm text-slate-400">No announcements yet.</p></Card>}
          {items.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-800">{a.title}</h3>
                    <Badge tone={sevTone[a.severity]}>{a.severity}</Badge>
                    {!a.isActive && <Badge tone="slate">inactive</Badge>}
                  </div>
                  {a.body && <p className="text-sm text-slate-500 mt-1">{a.body}</p>}
                  <p className="text-xs text-slate-400 mt-2">{a.audienceName} · {new Date(a.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggle(a)} className="text-xs font-semibold text-indigo-600 hover:underline">{a.isActive ? "Deactivate" : "Activate"}</button>
                  <button onClick={() => remove(a)} aria-label="Delete" className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PlatformShell>
  );
}
