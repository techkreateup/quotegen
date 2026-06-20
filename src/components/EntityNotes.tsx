"use client";

import { useEffect, useState } from "react";
import { EntityNote } from "@/lib/types";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { X, Send } from "lucide-react";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function EntityNotes({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [notes, setNotes] = useState<EntityNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  function loadNotes() {
    if (!entityId) return;
    setLoading(true);
    apiGet<EntityNote[]>(`/api/notes?entityType=${entityType}&entityId=${entityId}`)
      .then((data) => { if (data) setNotes(data); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadNotes(); }, [entityType, entityId]);

  async function handleAdd() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/notes", { entityType, entityId, content: content.trim(), authorName: "Admin" });
      setContent("");
      loadNotes();
    } catch {
      /* handled */
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    try {
      await apiDelete(`/api/notes?id=${id}`);
      loadNotes();
    } catch {
      /* handled */
    }
  }

  return (
    <div className="card p-6">
      <h3 className="text-[15px] font-bold text-slate-900 mb-4">Notes & Comments</h3>

      {/* Add note input */}
      <div className="flex gap-2 mb-4">
        <textarea
          className="inp flex-1"
          rows={2}
          placeholder="Add a note..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
        />
        <button
          className="btn btn-primary btn-sm self-end"
          disabled={!content.trim() || saving}
          onClick={handleAdd}
        >
          <Send size={13} /> Add
        </button>
      </div>

      {/* Notes list */}
      {loading ? (
        <p className="text-[13px] text-slate-400">Loading...</p>
      ) : notes.length === 0 ? (
        <p className="text-[13px] text-slate-400">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="flex gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
              {/* Avatar */}
              <div
                className="shrink-0 flex items-center justify-center text-white text-[11px] font-bold"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366F1, #818CF8)",
                }}
              >
                {note.authorName.charAt(0).toUpperCase()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[12px] font-semibold text-slate-700">{note.authorName}</span>
                  <span className="text-[11px] text-slate-400">{timeAgo(note.createdAt)}</span>
                </div>
                <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{note.content}</p>
              </div>

              {/* Delete */}
              <button
                className="shrink-0 p-1 rounded hover:bg-red-50 hover:text-red-500 text-slate-300 transition-colors"
                onClick={() => handleDelete(note.id)}
                title="Delete note"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
