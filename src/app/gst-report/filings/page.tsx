"use client";

import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import PageLoading from "@/components/PageLoading";
import {
  CheckCircle2, Clock, AlertTriangle, X, Download,
  ArrowLeft, Calendar, FileText,
} from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import Link from "next/link";
import ModalPortal from "@/components/ModalPortal";

interface GstFiling {
  id: string; month: number; year: number; returnType: string; status: string;
  filedDate: string | null; arnNumber: string; taxPayable: number; taxPaid: number;
  lateFee: number; interestAmount: number; notes: string; createdAt: string; updatedAt: string;
}

const MONTH_FULL = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

function getCurrentFY() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

function getFYOptions() {
  const now = new Date();
  const currentStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: 4 }, (_, i) => {
    const s = currentStart - i;
    return `${s}-${s + 1}`;
  });
}

function getDueDate(month: number, year: number, returnType: string): Date {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const day = returnType === "GSTR1" ? 11 : 20;
  return new Date(nextYear, nextMonth - 1, day);
}

function calcLateFee(returnType: string, daysLate: number): number {
  if (daysLate <= 0) return 0;
  return Math.min(50 * daysLate, 10000);
}

function calcInterest(taxPayable: number, daysLate: number): number {
  if (daysLate <= 0 || taxPayable <= 0) return 0;
  return Math.round((taxPayable * 0.18 * daysLate / 365) * 100) / 100;
}

export default function FilingsPage() {
  const [fy, setFy] = useState(getCurrentFY());
  const [filings, setFilings] = useState<GstFiling[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "filed" | "pending" | "overdue">("all");

  // Filing modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    month: 0, year: 0, returnType: "GSTR1", filedDate: "", arnNumber: "",
    taxPayable: 0, taxPaid: 0, lateFee: 0, interestAmount: 0, notes: "",
  });

  const now = new Date();

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<GstFiling[]>(`/api/gst-filings?fy=${fy}`);
      setFilings(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [fy]);

  // Build full list of expected filings for the FY
  const MONTHS_ORDER = [4,5,6,7,8,9,10,11,12,1,2,3];
  const [startYear] = fy.split("-").map(Number);

  const allExpected: { month: number; year: number; returnType: string; filing?: GstFiling; status: string; dueDate: Date }[] = [];
  for (const m of MONTHS_ORDER) {
    const y = m >= 4 ? startYear : startYear + 1;
    const periodDate = new Date(y, m - 1, 1);
    if (periodDate > now) continue;

    for (const rt of ["GSTR1", "GSTR3B"]) {
      const filing = filings.find(f => f.month === m && f.year === y && f.returnType === rt);
      const dueDate = getDueDate(m, y, rt);
      let status = "Pending";
      if (filing?.status === "Filed") status = "Filed";
      else if (now > dueDate) status = "Overdue";
      allExpected.push({ month: m, year: y, returnType: rt, filing, status, dueDate });
    }
  }

  const filtered = filter === "all" ? allExpected : allExpected.filter(e => e.status.toLowerCase() === filter);

  async function openMarkFiled(month: number, year: number, returnType: string) {
    const existing = filings.find(f => f.month === month && f.year === year && f.returnType === returnType);
    const dueDate = getDueDate(month, year, returnType);
    const daysLate = Math.max(0, Math.ceil((now.getTime() - dueDate.getTime()) / (1000*60*60*24)));

    // Auto-fetch tax amounts from invoices
    let autoTaxPayable = existing?.taxPayable || 0;
    if (!existing?.taxPayable) {
      try {
        const taxData = await apiGet<{ net: { total: number } }>(`/api/gst-report?type=tax-summary&month=${month}&year=${year}`);
        if (taxData?.net?.total) autoTaxPayable = Math.round(taxData.net.total * 100) / 100;
      } catch { /* use 0 */ }
    }

    setForm({
      month, year, returnType,
      filedDate: existing?.filedDate?.split("T")[0] || new Date().toISOString().split("T")[0],
      arnNumber: existing?.arnNumber || "",
      taxPayable: autoTaxPayable,
      taxPaid: existing?.taxPaid || autoTaxPayable,
      lateFee: existing?.lateFee || calcLateFee(returnType, daysLate),
      interestAmount: existing?.interestAmount || calcInterest(autoTaxPayable, daysLate),
      notes: existing?.notes || "",
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await apiPost("/api/gst-filings", { ...form, status: "Filed" });
    setShowModal(false);
    load();
  }

  function exportCSV() {
    const headers = ["Period", "Return Type", "Status", "Filed Date", "ARN", "Tax Payable", "Tax Paid", "Late Fee", "Interest", "Notes"];
    const rows = filings.map(f => [
      `${MONTH_FULL[f.month]} ${f.year}`, f.returnType, f.status,
      f.filedDate ? new Date(f.filedDate).toLocaleDateString("en-IN") : "—",
      f.arnNumber || "—", f.taxPayable, f.taxPaid, f.lateFee, f.interestAmount, f.notes,
    ]);
    downloadCSV(`GST_Filings_FY_${fy}.csv`, headers, rows);
  }

  const filedCount = allExpected.filter(e => e.status === "Filed").length;
  const overdueCount = allExpected.filter(e => e.status === "Overdue").length;
  const pendingCount = allExpected.filter(e => e.status === "Pending").length;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Filing History"
        subtitle={`All GST return filings for FY ${fy}`}
        breadcrumbs={[
          { label: "GST Returns", href: "/gst-report" },
          { label: "Filing History" },
        ]}
        action={
          <div className="flex items-center gap-3">
            <select value={fy} onChange={e => setFy(e.target.value)} className="inp w-40 text-[13px]">
              {getFYOptions().map(f => <option key={f} value={f}>FY {f}</option>)}
            </select>
            <Link href="/gst-report" className="btn btn-outline btn-sm">
              <ArrowLeft size={14} /> Dashboard
            </Link>
          </div>
        }
      />

      {loading && <PageLoading message="Loading filings..." />}

      {!loading && (
        <>
          {/* ── Stats Strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button onClick={() => setFilter("all")} className={`card px-4 py-3 text-left transition-all ${filter === "all" ? "ring-2 ring-indigo-400" : "hover:shadow-md"}`}>
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Expected</p>
              <p className="text-[24px] font-bold text-slate-800 mt-1">{allExpected.length}</p>
            </button>
            <button onClick={() => setFilter("filed")} className={`card px-4 py-3 text-left transition-all ${filter === "filed" ? "ring-2 ring-emerald-400" : "hover:shadow-md"}`}>
              <p className="text-[11px] text-emerald-500 font-semibold uppercase">Filed</p>
              <p className="text-[24px] font-bold text-emerald-600 mt-1">{filedCount}</p>
            </button>
            <button onClick={() => setFilter("overdue")} className={`card px-4 py-3 text-left transition-all ${filter === "overdue" ? "ring-2 ring-red-400" : "hover:shadow-md"}`}>
              <p className="text-[11px] text-red-500 font-semibold uppercase">Overdue</p>
              <p className="text-[24px] font-bold text-red-600 mt-1">{overdueCount}</p>
            </button>
            <button onClick={() => setFilter("pending")} className={`card px-4 py-3 text-left transition-all ${filter === "pending" ? "ring-2 ring-amber-400" : "hover:shadow-md"}`}>
              <p className="text-[11px] text-amber-500 font-semibold uppercase">Pending</p>
              <p className="text-[24px] font-bold text-amber-600 mt-1">{pendingCount}</p>
            </button>
          </div>

          {/* ── Filings Table ── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-slate-800">
                {filter === "all" ? "All Returns" : filter === "filed" ? "Filed Returns" : filter === "overdue" ? "Overdue Returns" : "Pending Returns"}
                <span className="text-slate-400 font-normal ml-2">({filtered.length})</span>
              </h3>
              <button onClick={exportCSV} className="btn btn-outline btn-sm">
                <Download size={13} /> Export CSV
              </button>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Return Type</th>
                    <th className="text-center">Status</th>
                    <th>Due Date</th>
                    <th>Filed Date</th>
                    <th>ARN</th>
                    <th className="text-right">Tax Paid</th>
                    <th className="text-right">Late Fee</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} className="text-center text-slate-400 py-8">No returns match this filter.</td></tr>
                  ) : filtered.map((e, i) => {
                    const statusColors: Record<string, string> = {
                      Filed: "bg-emerald-50 text-emerald-700",
                      Overdue: "bg-red-50 text-red-700",
                      Pending: "bg-slate-100 text-slate-500",
                    };
                    return (
                      <tr key={`${e.month}-${e.year}-${e.returnType}`} className={e.status === "Overdue" ? "bg-red-50/30" : ""}>
                        <td className="font-semibold">{MONTH_FULL[e.month]} {e.year}</td>
                        <td>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${e.returnType === "GSTR1" ? "bg-indigo-50 text-indigo-700" : "bg-purple-50 text-purple-700"}`}>
                            {e.returnType === "GSTR1" ? "GSTR-1" : "GSTR-3B"}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColors[e.status]}`}>
                            {e.status === "Filed" ? <CheckCircle2 size={11} /> : e.status === "Overdue" ? <AlertTriangle size={11} /> : <Clock size={11} />}
                            {e.status}
                          </span>
                        </td>
                        <td className="text-[12px] text-slate-500">{e.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td className="text-[12px]">
                          {e.filing?.filedDate ? new Date(e.filing.filedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="font-mono text-[11px] text-slate-400">{e.filing?.arnNumber || "—"}</td>
                        <td className="text-right text-[12px]">{e.filing?.taxPaid ? fmt(e.filing.taxPaid) : <span className="text-slate-300">—</span>}</td>
                        <td className="text-right text-[12px]">{e.filing?.lateFee ? <span className="text-red-500">{fmt(e.filing.lateFee)}</span> : <span className="text-slate-300">—</span>}</td>
                        <td className="text-center">
                          {e.status !== "Filed" ? (
                            <button onClick={() => openMarkFiled(e.month, e.year, e.returnType)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors">
                              Mark Filed
                            </button>
                          ) : (
                            <button onClick={() => openMarkFiled(e.month, e.year, e.returnType)} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors">
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Mark as Filed Modal ── */}
      {showModal && (
        <ModalPortal>
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">
                  Mark {form.returnType === "GSTR1" ? "GSTR-1" : "GSTR-3B"} as Filed
                </h2>
                <p className="text-[12px] text-slate-400">{MONTH_FULL[form.month]} {form.year}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="act"><X size={16} /></button>
            </div>

            {/* Late fee warning */}
            {(() => {
              const dueDate = getDueDate(form.month, form.year, form.returnType);
              const daysLate = Math.ceil((now.getTime() - dueDate.getTime()) / (1000*60*60*24));
              if (daysLate <= 0) return null;
              return (
                <div className="mx-5 mt-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-[12px] font-semibold text-red-700">
                    <AlertTriangle size={12} className="inline mr-1" />
                    This return is {daysLate} days past due
                  </p>
                  <p className="text-[11px] text-red-600 mt-1">
                    Estimated late fee: {fmt(calcLateFee(form.returnType, daysLate))} · Interest (18% p.a.): {fmt(calcInterest(form.taxPayable, daysLate))}
                  </p>
                </div>
              );
            })()}

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Filed Date *</label>
                  <input type="date" required value={form.filedDate} onChange={e => setForm({ ...form, filedDate: e.target.value })} className="inp" />
                </div>
                <div>
                  <label className="lbl">ARN Number</label>
                  <input type="text" value={form.arnNumber} onChange={e => setForm({ ...form, arnNumber: e.target.value })} className="inp font-mono" placeholder="e.g. AA1234..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Tax Payable (₹)</label>
                  <input type="number" step="0.01" value={form.taxPayable || ""} onChange={e => {
                    const tp = Number(e.target.value);
                    const dueDate = getDueDate(form.month, form.year, form.returnType);
                    const daysLate = Math.max(0, Math.ceil((now.getTime() - dueDate.getTime()) / (1000*60*60*24)));
                    setForm({ ...form, taxPayable: tp, interestAmount: calcInterest(tp, daysLate) });
                  }} className="inp" />
                </div>
                <div>
                  <label className="lbl">Tax Paid (₹)</label>
                  <input type="number" step="0.01" value={form.taxPaid || ""} onChange={e => setForm({ ...form, taxPaid: Number(e.target.value) })} className="inp" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Late Fee (₹)</label>
                  <input type="number" step="0.01" value={form.lateFee || ""} onChange={e => setForm({ ...form, lateFee: Number(e.target.value) })} className="inp" />
                  <p className="text-[10px] text-slate-400 mt-0.5">₹50/day, max ₹10,000</p>
                </div>
                <div>
                  <label className="lbl">Interest (₹)</label>
                  <input type="number" step="0.01" value={form.interestAmount || ""} onChange={e => setForm({ ...form, interestAmount: Number(e.target.value) })} className="inp" />
                  <p className="text-[10px] text-slate-400 mt-0.5">18% p.a. on outstanding tax</p>
                </div>
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="inp" rows={2} placeholder="Any remarks about this filing..." />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" className="btn btn-primary"><CheckCircle2 size={14} /> Mark as Filed</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
