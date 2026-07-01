"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { apiGet } from "@/lib/api";
import { AlertTriangle, Clock, Wallet, CheckCircle2, Wallet2 } from "lucide-react";

type Bucket = { current: number; d30: number; d60: number; d90plus: number };
interface Row { vendorId: string; vendorName: string; email: string; phone: string; billed: number; debitNotes: number; paid: number; balance: number; buckets: Bucket; nextDue: string | null; nextDueBillNo: string | null; dueSoon: boolean; overdue: boolean; }
interface Response { rows: Row[]; totals: { billed: number; debitNotes: number; paid: number; balance: number; overdueBalance: number; dueSoonBalance: number; }; }

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function PayablesPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "overdue" | "dueSoon" | "openBalance">("openBalance");

  useEffect(() => { apiGet<Response>("/api/payables").then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading payables…</div>;
  if (!data) return <div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Failed to load.</div>;

  const rows = data.rows.filter(r =>
    filter === "all" ? true :
    filter === "overdue" ? r.overdue :
    filter === "dueSoon" ? r.dueSoon :
    r.balance > 0
  );

  const kpi = (icon: React.ReactNode, label: string, value: string, sub: string, tone: string) => (
    <div className="card p-4 flex-1 min-w-[180px]">
      <div className="flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: tone }}>{icon}{label}</div>
      <div className="text-[22px] font-bold text-slate-900 mt-1 nums">{value}</div>
      <div className="text-[11.5px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Vendor Payables" breadcrumbs={[{ label: "Finance" }, { label: "Payables" }]} />

      <div className="flex flex-wrap gap-3">
        {kpi(<Wallet size={13} />, "Total Open", money(data.totals.balance), `across ${data.rows.filter(r => r.balance > 0).length} vendors`, "#6366F1")}
        {kpi(<AlertTriangle size={13} />, "Overdue", money(data.totals.overdueBalance), "past due date — pay now", "#EF4444")}
        {kpi(<Clock size={13} />, "Due in 7 days", money(data.totals.dueSoonBalance), "schedule payment this week", "#F59E0B")}
        {kpi(<CheckCircle2 size={13} />, "Paid to date", money(data.totals.paid), `on ${money(data.totals.billed)} billed`, "#10B981")}
      </div>

      <div className="card overflow-hidden w-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EEF0F6]" style={{ background: "#FAFBFD" }}>
          {([
            { k: "openBalance", l: "Open balance" },
            { k: "overdue", l: "Overdue only" },
            { k: "dueSoon", l: "Due in 7d" },
            { k: "all", l: "All vendors" },
          ] as const).map(t => (
            <button key={t.k} onClick={() => setFilter(t.k)} className={`pill${filter === t.k ? " active" : ""}`}>{t.l}</button>
          ))}
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Vendor</th>
              <th className="right">Billed</th>
              <th className="right">Debit Notes</th>
              <th className="right">Paid</th>
              <th className="right">Balance</th>
              <th>Next Due</th>
              <th className="right">Current</th>
              <th className="right">1–30d</th>
              <th className="right">31–60d</th>
              <th className="right">60d+</th>
              <th>Action</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11}><div className="empty"><div className="empty-icon"><Wallet2 size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">Nothing to pay</h3><p className="text-[13px] text-slate-400 mt-1">All vendor bills are settled.</p></div></td></tr>
              ) : rows.map(r => (
                <tr key={r.vendorId} style={r.overdue ? { background: "#FEF2F2" } : r.dueSoon ? { background: "#FFFBEB" } : {}}>
                  <td className="font-medium">
                    <div className="text-slate-900 text-[13px]">{r.vendorName}</div>
                    {r.email && <div className="text-[11px] text-slate-400">{r.email}</div>}
                  </td>
                  <td className="right nums text-slate-600">{money(r.billed)}</td>
                  <td className="right nums text-red-500">{r.debitNotes ? `−${money(r.debitNotes)}` : "—"}</td>
                  <td className="right nums text-emerald-600">{money(r.paid)}</td>
                  <td className="right nums font-bold text-slate-900">{money(r.balance)}</td>
                  <td className="text-[12px]">
                    {r.nextDue ? (
                      <div>
                        <div className={r.overdue ? "text-red-600 font-semibold" : r.dueSoon ? "text-amber-600 font-semibold" : "text-slate-600"}>{r.nextDue}</div>
                        {r.nextDueBillNo && <div className="text-[10.5px] text-slate-400">{r.nextDueBillNo}</div>}
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="right nums text-slate-500">{r.buckets.current ? money(r.buckets.current) : "—"}</td>
                  <td className="right nums text-amber-600">{r.buckets.d30 ? money(r.buckets.d30) : "—"}</td>
                  <td className="right nums text-orange-600">{r.buckets.d60 ? money(r.buckets.d60) : "—"}</td>
                  <td className="right nums text-red-600">{r.buckets.d90plus ? money(r.buckets.d90plus) : "—"}</td>
                  <td>
                    <Link href={`/vendors/view?id=${r.vendorId}`} className="btn btn-sm btn-primary">Pay</Link>
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
