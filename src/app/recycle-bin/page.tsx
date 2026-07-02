"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { confirmDialog } from "@/components/Dialog";
import { RotateCcw, Trash2, ArrowUpRight, Recycle, ShieldAlert } from "lucide-react";

interface Row {
  model: string; id: string; label: string;
  deletedAt: string; deletedByName: string;
  restoredAt: string | null; restoredByName: string;
  href: string;
}

const RETENTION = 30;
const fmt = (d: string | null) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function RecycleBinPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/recycle-bin").then(x => x.json());
      setRows(r.rows || []);
    } catch { toast.error("Failed to load recycle bin"); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const models = ["All", ...Array.from(new Set(rows.map(r => r.model)))];
  const filtered = filter === "All" ? rows : rows.filter(r => r.model === filter);

  async function restore(r: Row) {
    setBusyId(r.id);
    try {
      const res = await fetch("/api/recycle-bin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", model: r.model, id: r.id }) });
      if (!res.ok) throw new Error((await res.json()).error || "Restore failed");
      toast.success(`${r.model} restored`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Restore failed"); }
    setBusyId(null);
  }
  async function purge(r: Row) {
    if (!(await confirmDialog({ title: "Delete permanently?", message: `This will hard-delete "${r.label}". This cannot be undone.`, confirmLabel: "Delete forever", tone: "danger" }))) return;
    setBusyId(r.id);
    try {
      const res = await fetch("/api/recycle-bin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "purge", model: r.model, id: r.id }) });
      if (!res.ok) throw new Error((await res.json()).error || "Purge failed");
      toast.success("Deleted permanently");
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Purge failed"); }
    setBusyId(null);
  }

  const daysLeft = (d: string) => {
    const gone = (Date.now() - new Date(d).getTime()) / 86_400_000;
    return Math.max(0, Math.ceil(RETENTION - gone));
  };

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Recycle Bin" breadcrumbs={[{ label: "Settings" }, { label: "Recycle Bin" }]} subtitle={`Deleted items are recoverable for ${RETENTION} days before automatic purge.`} />

      <div className="card p-4 flex flex-wrap items-start gap-3">
        <div className="flex items-center gap-2">
          <Recycle size={16} className="text-indigo-500" />
          <span className="text-[13px] font-semibold text-slate-700">{rows.length} deleted item{rows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1 ml-auto">
          {models.map(m => (
            <button key={m} onClick={() => setFilter(m)} className={`pill${filter === m ? " active" : ""}`}>{m}</button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden w-full">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Type</th><th>Item</th><th>Deleted by</th><th>Deleted at</th>
              <th>Restored?</th><th>Auto-purge in</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="empty text-[13px] text-slate-400 py-10">Loading…</div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty"><div className="empty-icon"><Recycle size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">Nothing here</h3><p className="text-[13px] text-slate-400 mt-1">Deleted items appear here for {RETENTION} days.</p></div></td></tr>
              ) : filtered.map(r => (
                <tr key={r.model + r.id}>
                  <td><span className="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{r.model}</span></td>
                  <td className="text-[13px] font-medium text-slate-900">{r.label || "(no label)"}</td>
                  <td className="text-[12px] text-slate-600">{r.deletedByName || "—"}</td>
                  <td className="text-[12px] text-slate-500">{fmt(r.deletedAt)}</td>
                  <td className="text-[12px]">
                    {r.restoredAt ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 text-[11px] font-semibold" title={`Previously restored by ${r.restoredByName || "system"} on ${fmt(r.restoredAt)}`}>
                        <ShieldAlert size={11} /> Restored on {fmt(r.restoredAt)}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="text-[12px] text-slate-600">{daysLeft(r.deletedAt)} days</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => restore(r)} disabled={busyId === r.id} className="act" title="Restore"><RotateCcw size={14} /></button>
                      <button onClick={() => purge(r)} disabled={busyId === r.id} className="act del" title="Delete permanently"><Trash2 size={14} /></button>
                      <Link href={r.href} className="act" title="Open"><ArrowUpRight size={14} /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
