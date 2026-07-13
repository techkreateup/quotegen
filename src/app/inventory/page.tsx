"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPost } from "@/lib/api";
import { AlertTriangle, PackageOpen } from "lucide-react";

interface Level { catalogItemId: string; name: string; unit: string; lowStockThreshold: number; onHand: number; low: boolean }
interface Movement { id: string; qty: number; kind: string; refType: string; refNo: string; note: string; createdAt: string }

export default function InventoryPage() {
  const [levels, setLevels] = useState<Level[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [adjQty, setAdjQty] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => apiGet<Level[]>("/api/inventory").then(setLevels).catch(() => setLevels([]));
  useEffect(() => { load(); }, []);

  async function openItem(id: string) {
    setOpenId(id === openId ? null : id);
    if (id !== openId) setMovements(await apiGet<Movement[]>(`/api/inventory?itemId=${id}`).catch(() => []));
  }

  async function adjust(id: string) {
    const q = Number(adjQty);
    if (!q) { setError("Enter a non-zero quantity (negative to issue stock)."); return; }
    setBusy(true); setError("");
    try {
      await apiPost("/api/inventory", { catalogItemId: id, qty: q, note: adjNote });
      setAdjQty(""); setAdjNote("");
      await load();
      setMovements(await apiGet<Movement[]>(`/api/inventory?itemId=${id}`).catch(() => []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adjustment failed");
    } finally { setBusy(false); }
  }

  if (!levels) return <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading inventory…</div>;

  const lowCount = levels.filter(l => l.low).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Inventory" subtitle="Stock on hand for tracked catalog items — GRNs receive, delivery challans issue." />

      {levels.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 text-[13px]">
          <PackageOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          No tracked items yet. Enable <b>Track stock</b> on items in the{" "}
          <Link href="/catalog" className="text-blue-600 underline">Catalog</Link> to start the ledger.
        </div>
      ) : (
        <>
          {lowCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <AlertTriangle className="h-4 w-4" /> {lowCount} item{lowCount > 1 ? "s" : ""} at or below the low-stock threshold.
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 text-right">On hand</th>
                  <th className="px-4 py-2">Unit</th>
                  <th className="px-4 py-2 text-right">Low threshold</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {levels.map((l) => (
                  <FragmentRow key={l.catalogItemId} l={l} open={openId === l.catalogItemId}
                    onToggle={() => openItem(l.catalogItemId)}
                    movements={movements} adjQty={adjQty} adjNote={adjNote}
                    setAdjQty={setAdjQty} setAdjNote={setAdjNote}
                    onAdjust={() => adjust(l.catalogItemId)} busy={busy} error={error} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function FragmentRow(props: {
  l: Level; open: boolean; onToggle: () => void; movements: Movement[];
  adjQty: string; adjNote: string; setAdjQty: (s: string) => void; setAdjNote: (s: string) => void;
  onAdjust: () => void; busy: boolean; error: string;
}) {
  const { l, open } = props;
  return (
    <>
      <tr className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${l.low ? "bg-amber-50/50" : ""}`} onClick={props.onToggle}>
        <td className="px-4 py-2 font-medium text-slate-800">{l.name}{l.low && <AlertTriangle className="ml-2 inline h-3.5 w-3.5 text-amber-500" />}</td>
        <td className={`px-4 py-2 text-right tabular-nums ${l.onHand < 0 ? "text-red-600" : ""}`}>{l.onHand}</td>
        <td className="px-4 py-2 text-slate-500">{l.unit}</td>
        <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{l.lowStockThreshold || "—"}</td>
        <td className="px-4 py-2 text-right text-blue-600">{open ? "Hide" : "Ledger"}</td>
      </tr>
      {open && (
        <tr className="border-t border-slate-100 bg-slate-50/60">
          <td colSpan={5} className="px-4 py-3">
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="text-[12px] text-slate-600">Adjust (+receive / −issue)
                <input value={props.adjQty} onChange={(e) => props.setAdjQty(e.target.value)} type="number" step="any"
                  className="mt-1 block w-32 rounded border border-slate-300 px-2 py-1 text-[13px]" placeholder="e.g. -5" />
              </label>
              <label className="text-[12px] text-slate-600">Note
                <input value={props.adjNote} onChange={(e) => props.setAdjNote(e.target.value)}
                  className="mt-1 block w-64 rounded border border-slate-300 px-2 py-1 text-[13px]" placeholder="Stock count correction" />
              </label>
              <button onClick={props.onAdjust} disabled={props.busy} className="rounded bg-slate-800 px-3 py-1.5 text-[13px] text-white disabled:opacity-50">
                {props.busy ? "Saving…" : "Post adjustment"}
              </button>
              {props.error && <span className="text-[12px] text-red-600">{props.error}</span>}
            </div>
            <table className="w-full text-[12px]">
              <thead className="text-left text-slate-400"><tr><th className="py-1">Date</th><th>Type</th><th>Ref</th><th className="text-right">Qty</th><th>Note</th></tr></thead>
              <tbody>
                {props.movements.length === 0 && <tr><td colSpan={5} className="py-2 text-slate-400">No movements.</td></tr>}
                {props.movements.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="py-1">{new Date(m.createdAt).toLocaleDateString("en-IN")}</td>
                    <td>{m.kind}</td>
                    <td>{m.refNo || "—"}</td>
                    <td className={`text-right tabular-nums ${m.qty < 0 ? "text-red-600" : "text-emerald-600"}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                    <td className="text-slate-500">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
