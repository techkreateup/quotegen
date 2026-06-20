"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { LifeBuoy, Plus, Send } from "lucide-react";

interface IssueRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  reporter: { name: string };
  assignee: { name: string } | null;
}

interface IssueDetail extends IssueRow {
  comments: { id: string; body: string; createdAt: string; author: { name: string; platformRole: string } }[];
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

export default function HelpIssuesPage() {
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<IssueDetail | null>(null);
  const [reply, setReply] = useState("");

  async function load() {
    setLoading(true);
    const d = await fetch("/api/issues").then((r) => r.json());
    setIssues(d.issues ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setForm({ title: "", description: "", priority: "MEDIUM" });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report issue");
    }
    setSaving(false);
  }

  async function open(id: string) {
    const d = await fetch(`/api/issues/${id}`).then((r) => r.json());
    if (d.issue) setSelected(d.issue);
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !selected) return;
    setSaving(true);
    const res = await fetch(`/api/issues/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    if (res.ok) {
      setReply("");
      open(selected.id);
    }
    setSaving(false);
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        title="Help & Support"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Help & Support" }]}
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            <Plus size={16} /> Report an issue
          </button>
        }
      />

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <div>
            <label htmlFor="issue-title" className="block text-xs font-semibold text-gray-600 mb-1">What&apos;s the problem? *</label>
            <input id="issue-title" required minLength={5} className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short summary (min 5 characters)" />
          </div>
          <div>
            <label htmlFor="issue-desc" className="block text-xs font-semibold text-gray-600 mb-1">Details</label>
            <textarea id="issue-desc" rows={4} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What did you expect, what happened, steps to reproduce…" />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <label htmlFor="issue-priority" className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
              <select id="issue-priority" className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <button disabled={saving} className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Submitting…" : "Submit issue"}
            </button>
          </div>
        </form>
      )}

      {selected ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <button onClick={() => setSelected(null)} className="text-xs font-semibold text-indigo-600 hover:underline mb-3">← All issues</button>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="text-base font-bold text-gray-900">{selected.title}</h2>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[selected.status]}`}>{selected.status.replace("_", " ")}</span>
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap mb-4">{selected.description || "No description."}</p>
          <h3 className="text-sm font-bold text-gray-700 mb-2">Conversation</h3>
          <ul className="space-y-2 mb-4">
            {selected.comments.map((c) => {
              const isSupport = c.author.platformRole === "SUPPORT" || c.author.platformRole === "SUPER_ADMIN";
              return (
                <li key={c.id} className={`rounded-lg p-3 ${isSupport ? "bg-indigo-50 border border-indigo-100" : "bg-gray-50"}`}>
                  <p className="text-xs font-semibold text-gray-600 mb-1">
                    {c.author.name}{isSupport ? " (Support team)" : ""}
                    <span className="ml-2 font-normal text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.body}</p>
                </li>
              );
            })}
            {selected.comments.length === 0 && <p className="text-sm text-gray-400">No replies yet — our support team will respond soon.</p>}
          </ul>
          <form onSubmit={sendReply} className="flex gap-2">
            <label htmlFor="reply" className="sr-only">Reply</label>
            <input id="reply" className={inputCls} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
            <button disabled={saving || !reply.trim()} aria-label="Send reply" className="h-10 px-4 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          {loading ? (
            <p className="px-4 py-10 text-center text-gray-400">Loading issues…</p>
          ) : issues.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <LifeBuoy size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-semibold text-gray-600">No issues reported yet</p>
              <p className="text-xs text-gray-400 mt-1">Hit a bug or need a feature? Click &quot;Report an issue&quot; above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-2.5">Issue</th>
                  <th className="px-4 py-2.5">Priority</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Assigned to</th>
                  <th className="px-4 py-2.5">Created</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((i) => (
                  <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => open(i.id)}>
                    <td className="px-4 py-3 font-semibold text-indigo-600">{i.title}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-600">{i.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[i.status]}`}>{i.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{i.assignee?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(i.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
