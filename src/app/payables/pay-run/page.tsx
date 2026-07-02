"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { apiGet } from "@/lib/api";
import { computeTds, TDS_SECTIONS } from "@/lib/tds";
import { AlertTriangle, ArrowLeft, CheckCircle2, Play, Wallet } from "lucide-react";

// Dedicated payment-run screen (Track A A5 v2). Lets the user tick a handful of
// vendors on their payables list, adjust the amount (defaults to the ageing
// balance), pick a payment date + method, and fire one bulk request that lands
// as N VendorPayment + N Transaction rows atomically. TDS defaults per vendor.

interface Row {
  vendorId: string; vendorName: string; email: string; phone: string;
  billed: number; debitNotes: number; paid: number; balance: number;
  buckets: { current: number; d30: number; d60: number; d90plus: number };
  nextDue: string | null; nextDueBillNo: string | null; dueSoon: boolean; overdue: boolean;
  tdsSection: string; tdsRate: number;
}
interface Resp { rows: Row[] }

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

type Entry = { vendorId: string; grossAmount: number; tdsSection: string; tdsRate: number; description: string };

export default function PayRunPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, Entry>>({});
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    apiGet<Resp>("/api/payables")
      .then(r => setRows((r?.rows || []).filter(x => x.balance > 0)))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (r: Row) => setSelected(prev => {
    const next = { ...prev };
    if (next[r.vendorId]) delete next[r.vendorId];
    else next[r.vendorId] = { vendorId: r.vendorId, grossAmount: r.balance, tdsSection: r.tdsSection, tdsRate: r.tdsRate, description: `Payment run ${paidDate}` };
    return next;
  });
  const setAmount = (id: string, v: number) => setSelected(p => p[id] ? { ...p, [id]: { ...p[id], grossAmount: v } } : p);
  const setTds = (id: string, code: string) => setSelected(p => {
    if (!p[id]) return p;
    const preset = TDS_SECTIONS.find(s => s.code === code);
    return { ...p, [id]: { ...p[id], tdsSection: code, tdsRate: preset?.defaultRate ?? 0 } };
  });
  const setRate = (id: string, v: number) => setSelected(p => p[id] ? { ...p, [id]: { ...p[id], tdsRate: v } } : p);

  const entries = useMemo(() => Object.values(selected), [selected]);
  const totals = useMemo(() => {
    let gross = 0, tds = 0, net = 0;
    for (const e of entries) {
      const g = Number(e.grossAmount) || 0;
      const c = computeTds(g, e.tdsRate);
      gross += g; tds += c.tds; net += c.net;
    }
    return { gross: Math.round(gross * 100) / 100, tds: Math.round(tds * 100) / 100, net: Math.round(net * 100) / 100 };
  }, [entries]);

  async function run() {
    if (entries.length === 0) return;
    setRunning(true);
    try {
      const res = await fetch("/api/vendor-payments/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: entries.map(e => ({ ...e, paidDate, paymentMethod })) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Run failed");
      toast.success(`Recorded ${body.count} vendor payments (net ${money(totals.net)})`);
      setSelected({});
      apiGet<Resp>("/api/payables").then(r => setRows((r?.rows || []).filter(x => x.balance > 0)));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Run failed"); }
    setRunning(false);
  }

  const selectAllOverdue = () => {
    const next: Record<string, Entry> = {};
    for (const r of rows) if (r.overdue) next[r.vendorId] = { vendorId: r.vendorId, grossAmount: r.balance, tdsSection: r.tdsSection, tdsRate: r.tdsRate, description: `Payment run ${paidDate}` };
    setSelected(next);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading payables…</div>;

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Payment Run" breadcrumbs={[{ label: "Finance" }, { label: "Payables", href: "/payables" }, { label: "Payment Run" }]}
        action={<Link href="/payables" className="btn btn-sm"><ArrowLeft size={13} /> Back</Link>} />

      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="lbl">Payment Date</label>
          <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="inp" />
        </div>
        <div>
          <label className="lbl">Method</label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="inp">
            {["Bank Transfer", "UPI", "Cheque", "Cash", "Card", "Other"].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <button onClick={selectAllOverdue} className="btn btn-sm ml-auto"><AlertTriangle size={13} /> Select all overdue</button>
        <button onClick={() => setSelected({})} className="btn btn-sm">Clear</button>
        <button onClick={run} disabled={entries.length === 0 || running} className="btn btn-primary">
          <Play size={13} /> {running ? "Running…" : `Run ${entries.length ? `(${entries.length}) — pay ${money(totals.net)}` : ""}`}
        </button>
      </div>

      {entries.length > 0 && (
        <div className="card p-4 flex flex-wrap gap-6 text-[13px]">
          <div><div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Gross</div><div className="text-[18px] font-bold text-slate-900 mt-0.5 nums">{money(totals.gross)}</div></div>
          <div><div className="text-[11px] font-semibold text-red-500 uppercase tracking-wide">TDS</div><div className="text-[18px] font-bold text-red-600 mt-0.5 nums">−{money(totals.tds)}</div></div>
          <div><div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Net Paid</div><div className="text-[18px] font-bold text-emerald-700 mt-0.5 nums">{money(totals.net)}</div></div>
        </div>
      )}

      <div className="card overflow-hidden w-full">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th style={{ width: 40 }}></th>
              <th>Vendor</th>
              <th className="right">Open Balance</th>
              <th>Next Due</th>
              <th className="right">Pay Amount</th>
              <th>TDS Section</th>
              <th className="right">Rate %</th>
              <th className="right">Net</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8}><div className="empty"><div className="empty-icon"><CheckCircle2 size={36} color="#10B981" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">All caught up</h3><p className="text-[13px] text-slate-400 mt-1">No open vendor balances to pay.</p></div></td></tr>
              ) : rows.map(r => {
                const chosen = selected[r.vendorId];
                const gross = Number(chosen?.grossAmount ?? r.balance) || 0;
                const rate = Number(chosen?.tdsRate ?? 0) || 0;
                const { tds, net } = computeTds(gross, rate);
                return (
                  <tr key={r.vendorId} style={r.overdue ? { background: "#FEF2F2" } : r.dueSoon ? { background: "#FFFBEB" } : {}}>
                    <td className="text-center">
                      <input type="checkbox" checked={!!chosen} onChange={() => toggle(r)} />
                    </td>
                    <td className="text-[13px] font-medium">{r.vendorName}<div className="text-[11px] text-slate-400">{r.email || r.phone || "—"}</div></td>
                    <td className="right nums font-bold">{money(r.balance)}</td>
                    <td className="text-[12px]">{r.nextDue ? (
                      <div>
                        <div className={r.overdue ? "text-red-600 font-semibold" : r.dueSoon ? "text-amber-600 font-semibold" : "text-slate-600"}>{r.nextDue}</div>
                        {r.nextDueBillNo && <div className="text-[10.5px] text-slate-400">{r.nextDueBillNo}</div>}
                      </div>
                    ) : <span className="text-slate-300">—</span>}</td>
                    <td className="right">
                      {chosen ? (
                        <input type="number" step="0.01" min="0" value={chosen.grossAmount} onChange={e => setAmount(r.vendorId, Number(e.target.value) || 0)} className="inp text-right" style={{ width: 110 }} />
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td>
                      {chosen ? (
                        <select value={chosen.tdsSection} onChange={e => setTds(r.vendorId, e.target.value)} className="inp" style={{ width: 180 }}>
                          {TDS_SECTIONS.map(s => <option key={s.code || "none"} value={s.code}>{s.label}</option>)}
                        </select>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="right">
                      {chosen ? (
                        <input type="number" step="0.01" min="0" value={chosen.tdsRate} onChange={e => setRate(r.vendorId, Number(e.target.value) || 0)} disabled={!chosen.tdsSection} className="inp text-right" style={{ width: 70 }} />
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="right nums font-bold text-emerald-700">{chosen ? money(net) : "—"}{chosen && tds > 0 && <div className="text-[10.5px] text-red-500 font-normal">TDS −{money(tds)}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11.5px] text-slate-400 flex items-center gap-1.5 justify-center"><Wallet size={11} /> Running the batch records N vendor payments atomically. Each vendor gets its own remittance advice from Vendor view.</p>
    </div>
  );
}
