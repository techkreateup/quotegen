"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import ModalPortal from "@/components/ModalPortal";
import { confirmDialog, alertDialog } from "@/components/Dialog";
import { Plus, Check, Clock, Trash2, X, ExternalLink, RotateCcw, CalendarClock } from "lucide-react";

interface FollowUp {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  note: string;
  status: string; // open | snoozed | done
  dueAt: string | null;
  createdByName: string;
  completedAt: string | null;
}

const ENTITY_LINK: Record<string, string> = {
  invoice: "/invoices/view?id=",
  quotation: "/quotations/view?id=",
  receipt: "/payment-receipts/view?id=",
  client: "/clients/view?id=",
  vendor: "/vendors/view?id=",
};

const notify = (msg: string) => alertDialog({ title: msg });

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

export default function FollowUpsPage() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<{ title: string; note: string; dueAt: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { followUps } = await apiGet<{ followUps: FollowUp[] }>("/api/follow-ups");
      setItems(followUps);
    } catch (e) {
      await notify(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const buckets = useMemo(() => {
    const sot = startOfToday().getTime();
    const eot = endOfToday().getTime();
    const b = { overdue: [] as FollowUp[], today: [] as FollowUp[], upcoming: [] as FollowUp[], done: [] as FollowUp[] };
    for (const f of items) {
      if (f.status === "done") { b.done.push(f); continue; }
      const due = f.dueAt ? new Date(f.dueAt).getTime() : null;
      if (due != null && due < sot) b.overdue.push(f);
      else if (due != null && due <= eot) b.today.push(f);
      else b.upcoming.push(f);
    }
    return b;
  }, [items]);

  async function setStatus(f: FollowUp, status: string) {
    try {
      await apiPut(`/api/follow-ups/${f.id}`, { status });
      await load();
    } catch (e) { await notify(e instanceof Error ? e.message : "Failed"); }
  }
  async function snooze(f: FollowUp, days: number) {
    const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0);
    try {
      await apiPut(`/api/follow-ups/${f.id}`, { status: "snoozed", dueAt: d.toISOString() });
      await load();
    } catch (e) { await notify(e instanceof Error ? e.message : "Failed"); }
  }
  async function remove(f: FollowUp) {
    if (!(await confirmDialog({ title: "Delete follow-up?", message: f.title }))) return;
    try { await apiDelete(`/api/follow-ups/${f.id}`); await load(); }
    catch (e) { await notify(e instanceof Error ? e.message : "Failed"); }
  }

  async function save() {
    if (!draft?.title.trim()) { await notify("A title is required"); return; }
    setSaving(true);
    try {
      await apiPost("/api/follow-ups", { title: draft.title, note: draft.note, dueAt: draft.dueAt || null });
      setDraft(null);
      await load();
    } catch (e) { await notify(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle="Your to-do across clients, quotes, invoices and vendors — never let one slip."
        action={
          <button onClick={() => setDraft({ title: "", note: "", dueAt: "" })}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <Plus size={16} /> New follow-up
          </button>
        }
      />

      {loading ? (
        <p className="px-6 py-10 text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-5 px-6 pb-12 lg:grid-cols-4">
          <Column title="Overdue" tone="red" items={buckets.overdue} render={card} />
          <Column title="Due today" tone="amber" items={buckets.today} render={card} />
          <Column title="Upcoming" tone="slate" items={buckets.upcoming} render={card} />
          <Column title="Done" tone="emerald" items={buckets.done} render={card} />
        </div>
      )}

      {draft && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
            <div className="my-12 w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-[16px] font-bold text-slate-800">New follow-up</h2>
                <button onClick={() => setDraft(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
              </div>
              <div className="space-y-3 p-6">
                <label className="block"><span className="mb-1 block text-[12px] font-semibold text-slate-600">Title</span>
                  <input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Call Globex about quote Q-0007" autoFocus /></label>
                <label className="block"><span className="mb-1 block text-[12px] font-semibold text-slate-600">Note</span>
                  <textarea className={`${inputCls} h-24`} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
                <label className="block"><span className="mb-1 block text-[12px] font-semibold text-slate-600">Due</span>
                  <input type="datetime-local" className={inputCls} value={draft.dueAt} onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })} /></label>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
                <button onClick={() => setDraft(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={save} disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Saving…" : "Create"}</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );

  function card(f: FollowUp) {
    const link = f.entityType && ENTITY_LINK[f.entityType] ? `${ENTITY_LINK[f.entityType]}${f.entityId}` : null;
    const due = f.dueAt ? new Date(f.dueAt) : null;
    return (
      <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13.5px] font-semibold text-slate-800">{f.title}</p>
          <button onClick={() => remove(f)} className="shrink-0 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500" aria-label="Delete"><Trash2 size={13} /></button>
        </div>
        {f.note && <p className="mt-1 text-[12px] text-slate-500">{f.note}</p>}
        {due && <p className="mt-2 flex items-center gap-1 text-[11.5px] text-slate-400"><CalendarClock size={11} /> {due.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {f.status !== "done" ? (
            <>
              <button onClick={() => setStatus(f, "done")} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"><Check size={11} /> Done</button>
              <button onClick={() => snooze(f, 1)} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"><Clock size={11} /> +1d</button>
              <button onClick={() => snooze(f, 3)} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">+3d</button>
            </>
          ) : (
            <button onClick={() => setStatus(f, "open")} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"><RotateCcw size={11} /> Reopen</button>
          )}
          {link && <Link href={link} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50">Open <ExternalLink size={11} /></Link>}
        </div>
      </div>
    );
  }
}

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const TONE: Record<string, string> = {
  red: "text-red-600", amber: "text-amber-600", slate: "text-slate-500", emerald: "text-emerald-600",
};

function Column({ title, tone, items, render }: { title: string; tone: string; items: FollowUp[]; render: (f: FollowUp) => React.ReactNode }) {
  return (
    <div>
      <h3 className={`mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${TONE[tone]}`}>
        {title} <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{items.length}</span>
      </h3>
      <div className="space-y-2.5">
        {items.length === 0 ? <p className="text-[12px] text-slate-300">Nothing here</p> : items.map(render)}
      </div>
    </div>
  );
}
