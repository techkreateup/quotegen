"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { apiGet } from "@/lib/api";
import { AlertTriangle, Clock, Wallet, CheckCircle2, ArrowUpRight, ArrowDownRight, TrendingUp, Coins } from "lucide-react";

type Bucket = { current: number; d30: number; d60: number; d90plus: number };

interface RecvRow { clientId: string; clientName: string; email: string; phone: string; invoiced: number; creditNotes: number; paid: number; balance: number; buckets: Bucket; nextDue: string | null; nextDueInvNo: string | null; dueSoon: boolean; overdue: boolean; }
interface RecvResp { rows: RecvRow[]; totals: { invoiced: number; creditNotes: number; paid: number; balance: number; overdueBalance: number; dueSoonBalance: number; }; }

interface PayRow { vendorId: string; vendorName: string; email: string; phone: string; billed: number; debitNotes: number; paid: number; balance: number; buckets: Bucket; nextDue: string | null; nextDueBillNo: string | null; dueSoon: boolean; overdue: boolean; }
interface PayResp { rows: PayRow[]; totals: { billed: number; debitNotes: number; paid: number; balance: number; overdueBalance: number; dueSoonBalance: number; }; }

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function CashCommandCenterPage() {
  const [recv, setRecv] = useState<RecvResp | null>(null);
  const [pay, setPay] = useState<PayResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"in" | "out">("in");
  const [filter, setFilter] = useState<"open" | "overdue" | "dueSoon" | "all">("open");

  useEffect(() => {
    Promise.all([
      apiGet<RecvResp>("/api/receivables"),
      apiGet<PayResp>("/api/payables"),
    ]).then(([r, p]) => { setRecv(r); setPay(p); }).finally(() => setLoading(false));
  }, []);

  const net = useMemo(() => {
    if (!recv || !pay) return { in: 0, out: 0, net: 0, in7: 0, out7: 0 };
    return {
      in: recv.totals.balance, out: pay.totals.balance,
      net: recv.totals.balance - pay.totals.balance,
      in7: recv.totals.dueSoonBalance + recv.totals.overdueBalance,
      out7: pay.totals.dueSoonBalance + pay.totals.overdueBalance,
    };
  }, [recv, pay]);

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading cash position…</div>;
  if (!recv || !pay) return <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Failed to load.</div>;

  const kpi = (icon: React.ReactNode, label: string, value: string, sub: string, tone: string) => (
    <div className="card p-4 flex-1 min-w-[190px]">
      <div className="flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: tone }}>{icon}{label}</div>
      <div className="text-[22px] font-bold text-slate-900 mt-1 nums">{value}</div>
      <div className="text-[11.5px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );

  const recvRows = recv.rows.filter(r =>
    filter === "all" ? true : filter === "overdue" ? r.overdue : filter === "dueSoon" ? r.dueSoon : r.balance > 0
  );
  const payRows = pay.rows.filter(r =>
    filter === "all" ? true : filter === "overdue" ? r.overdue : filter === "dueSoon" ? r.dueSoon : r.balance > 0
  );

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Cash Command Center" breadcrumbs={[{ label: "Finance" }, { label: "Cash" }]} subtitle="Who owes you, who you owe, and what needs action this week."
        action={<Link href="/cash/reconcile" className="btn btn-outline">Bank reconciliation</Link>} />

      <div className="flex flex-wrap gap-3">
        {kpi(<ArrowDownRight size={13} />, "Money coming in", money(net.in), (() => { const n = recv.rows.filter(r => r.balance > 0).length; return `across ${n} client${n === 1 ? "" : "s"}`; })(), "#10B981")}
        {kpi(<ArrowUpRight size={13} />, "Money going out", money(net.out), (() => { const n = pay.rows.filter(r => r.balance > 0).length; return `across ${n} vendor${n === 1 ? "" : "s"}`; })(), "#EF4444")}
        {kpi(<TrendingUp size={13} />, "Net cash position", `${net.net >= 0 ? "+" : "−"}${money(Math.abs(net.net))}`, net.net >= 0 ? "receivables exceed payables" : "payables exceed receivables", net.net >= 0 ? "#10B981" : "#EF4444")}
        {kpi(<AlertTriangle size={13} />, "Action this week", `${money(net.in7)} / ${money(net.out7)}`, "collect / pay in next 7d", "#F59E0B")}
      </div>

      <div className="card overflow-hidden w-full">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#EEF0F6]" style={{ background: "#FAFBFD" }}>
          <div className="flex items-center gap-1">
            <button onClick={() => setTab("in")} className={`pill${tab === "in" ? " active" : ""}`}>
              <ArrowDownRight size={12} /> Receivables ({money(recv.totals.balance)})
            </button>
            <button onClick={() => setTab("out")} className={`pill${tab === "out" ? " active" : ""}`}>
              <ArrowUpRight size={12} /> Payables ({money(pay.totals.balance)})
            </button>
          </div>
          <div className="flex items-center gap-1">
            {([
              { k: "open", l: "Open" },
              { k: "overdue", l: "Overdue" },
              { k: "dueSoon", l: "Due 7d" },
              { k: "all", l: "All" },
            ] as const).map(t => (
              <button key={t.k} onClick={() => setFilter(t.k)} className={`pill${filter === t.k ? " active" : ""}`}>{t.l}</button>
            ))}
          </div>
        </div>

        <div className="tbl-wrap">
          {tab === "in" ? (
            <table className="tbl">
              <thead><tr>
                <th>Client</th><th className="right">Invoiced</th><th className="right">Credit Notes</th>
                <th className="right">Received</th><th className="right">Balance</th><th>Next Due</th>
                <th className="right">Current</th><th className="right">1–30d</th><th className="right">31–60d</th><th className="right">60d+</th><th>Action</th>
              </tr></thead>
              <tbody>
                {recvRows.length === 0 ? (
                  <tr><td colSpan={11}><div className="empty"><div className="empty-icon"><Coins size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">All collected</h3><p className="text-[13px] text-slate-400 mt-1">No outstanding client balances.</p></div></td></tr>
                ) : recvRows.map(r => (
                  <tr key={r.clientId} style={r.overdue ? { background: "#FEF2F2" } : r.dueSoon ? { background: "#FFFBEB" } : {}}>
                    <td className="font-medium">
                      <div className="text-slate-900 text-[13px]">{r.clientName}</div>
                      {r.email && <div className="text-[11px] text-slate-400">{r.email}</div>}
                    </td>
                    <td className="right nums text-slate-600">{money(r.invoiced)}</td>
                    <td className="right nums text-red-500">{r.creditNotes ? `−${money(r.creditNotes)}` : "—"}</td>
                    <td className="right nums text-emerald-600">{money(r.paid)}</td>
                    <td className="right nums font-bold text-slate-900">{money(r.balance)}</td>
                    <td className="text-[12px]">{r.nextDue ? (
                      <div>
                        <div className={r.overdue ? "text-red-600 font-semibold" : r.dueSoon ? "text-amber-600 font-semibold" : "text-slate-600"}>{r.nextDue}</div>
                        {r.nextDueInvNo && <div className="text-[10.5px] text-slate-400">{r.nextDueInvNo}</div>}
                      </div>
                    ) : <span className="text-slate-300">—</span>}</td>
                    <td className="right nums text-slate-500">{r.buckets.current ? money(r.buckets.current) : "—"}</td>
                    <td className="right nums text-amber-600">{r.buckets.d30 ? money(r.buckets.d30) : "—"}</td>
                    <td className="right nums text-orange-600">{r.buckets.d60 ? money(r.buckets.d60) : "—"}</td>
                    <td className="right nums text-red-600">{r.buckets.d90plus ? money(r.buckets.d90plus) : "—"}</td>
                    <td><Link href={`/clients/view?id=${r.clientId}`} className="btn btn-sm btn-primary">Collect</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>Vendor</th><th className="right">Billed</th><th className="right">Debit Notes</th>
                <th className="right">Paid</th><th className="right">Balance</th><th>Next Due</th>
                <th className="right">Current</th><th className="right">1–30d</th><th className="right">31–60d</th><th className="right">60d+</th><th>Action</th>
              </tr></thead>
              <tbody>
                {payRows.length === 0 ? (
                  <tr><td colSpan={11}><div className="empty"><div className="empty-icon"><Wallet size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">Nothing to pay</h3><p className="text-[13px] text-slate-400 mt-1">All vendor bills are settled.</p></div></td></tr>
                ) : payRows.map(r => (
                  <tr key={r.vendorId} style={r.overdue ? { background: "#FEF2F2" } : r.dueSoon ? { background: "#FFFBEB" } : {}}>
                    <td className="font-medium">
                      <div className="text-slate-900 text-[13px]">{r.vendorName}</div>
                      {r.email && <div className="text-[11px] text-slate-400">{r.email}</div>}
                    </td>
                    <td className="right nums text-slate-600">{money(r.billed)}</td>
                    <td className="right nums text-red-500">{r.debitNotes ? `−${money(r.debitNotes)}` : "—"}</td>
                    <td className="right nums text-emerald-600">{money(r.paid)}</td>
                    <td className="right nums font-bold text-slate-900">{money(r.balance)}</td>
                    <td className="text-[12px]">{r.nextDue ? (
                      <div>
                        <div className={r.overdue ? "text-red-600 font-semibold" : r.dueSoon ? "text-amber-600 font-semibold" : "text-slate-600"}>{r.nextDue}</div>
                        {r.nextDueBillNo && <div className="text-[10.5px] text-slate-400">{r.nextDueBillNo}</div>}
                      </div>
                    ) : <span className="text-slate-300">—</span>}</td>
                    <td className="right nums text-slate-500">{r.buckets.current ? money(r.buckets.current) : "—"}</td>
                    <td className="right nums text-amber-600">{r.buckets.d30 ? money(r.buckets.d30) : "—"}</td>
                    <td className="right nums text-orange-600">{r.buckets.d60 ? money(r.buckets.d60) : "—"}</td>
                    <td className="right nums text-red-600">{r.buckets.d90plus ? money(r.buckets.d90plus) : "—"}</td>
                    <td><Link href={`/vendors/view?id=${r.vendorId}`} className="btn btn-sm btn-primary">Pay</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-[#EEF0F6] text-[11.5px] text-slate-400 flex items-center gap-3" style={{ background: "#FAFBFD" }}>
          <span className="flex items-center gap-1"><Clock size={11} /> Overdue rows highlighted red · due-in-7d amber</span>
          <span className="ml-auto">Full views: <Link href="/payables" className="text-indigo-600 hover:underline">Payables</Link></span>
        </div>
      </div>
    </div>
  );
}
