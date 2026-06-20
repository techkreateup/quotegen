"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PlatformShell from "@/components/platform/PlatformShell";

interface IssueDetail {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  company: { id: string; name: string; isActive: boolean };
  reporter: { name: string; email: string };
  assignee: { id: string; name: string } | null;
  comments: {
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
    author: { name: string; platformRole: string };
  }[];
}

export default function SupportIssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch(`/api/support/issues/${id}`).then((r) => r.json());
    if (d.error) setError(d.error);
    else setIssue(d.issue);
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/support/staff").then((r) => r.json()).then((d) => setStaff(d.staff ?? []));
  }, [load]);

  async function update(data: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/support/issues/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) setError((await res.json()).error || "Update failed");
    else load();
    setSaving(false);
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/support/issues/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment, isInternal }),
    });
    if (!res.ok) setError((await res.json()).error || "Comment failed");
    else {
      setComment("");
      load();
    }
    setSaving(false);
  }

  const selectCls = "h-9 px-2 rounded-lg border border-slate-300 text-sm bg-white";

  return (
    <PlatformShell>
      <Link href="/support/issues" className="text-xs font-semibold text-indigo-600 hover:underline">← Issue queue</Link>
      {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
      {!issue && !error && <p className="mt-6 text-slate-400">Loading…</p>}
      {issue && (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h1 className="text-lg font-bold text-slate-900">{issue.title}</h1>
              <p className="text-xs text-slate-400 mt-1">
                {issue.company.name} · reported by {issue.reporter.name} ({issue.reporter.email}) ·{" "}
                {new Date(issue.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-slate-700 mt-4 whitespace-pre-wrap">
                {issue.description || <span className="text-slate-400">No description provided.</span>}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-700 mb-3">Comments ({issue.comments.length})</h2>
              <ul className="space-y-3 mb-4">
                {issue.comments.map((c) => (
                  <li key={c.id} className={`rounded-lg p-3 ${c.isInternal ? "bg-amber-50 border border-amber-200" : "bg-slate-50"}`}>
                    <p className="text-xs font-semibold text-slate-600 mb-1">
                      {c.author.name}
                      {c.author.platformRole === "SUPPORT" || c.author.platformRole === "SUPER_ADMIN" ? " (Support)" : ""}
                      {c.isInternal && <span className="ml-2 text-amber-600">internal note</span>}
                      <span className="ml-2 font-normal text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                    </p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
                {issue.comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
              </ul>
              <form onSubmit={addComment}>
                <label htmlFor="comment" className="sr-only">Add comment</label>
                <textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Write a reply…"
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                    Internal note (hidden from customer)
                  </label>
                  <button disabled={saving || !comment.trim()} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? "Posting…" : "Post"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-fit">
            <h2 className="text-sm font-bold text-slate-700 mb-3">Triage</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="issue-status" className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                <select id="issue-status" className={selectCls + " w-full"} value={issue.status} onChange={(e) => update({ status: e.target.value })} disabled={saving}>
                  {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="issue-priority" className="block text-xs font-semibold text-slate-500 mb-1">Priority</label>
                <select id="issue-priority" className={selectCls + " w-full"} value={issue.priority} onChange={(e) => update({ priority: e.target.value })} disabled={saving}>
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="issue-assignee" className="block text-xs font-semibold text-slate-500 mb-1">Assignee</label>
                <select id="issue-assignee" className={selectCls + " w-full"} value={issue.assignee?.id ?? ""} onChange={(e) => update({ assigneeId: e.target.value })} disabled={saving}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {issue.resolvedAt && (
                <p className="text-xs text-emerald-600">Resolved {new Date(issue.resolvedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </PlatformShell>
  );
}
