"use client";

import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import PageLoading from "@/components/PageLoading";
import {
  CheckCircle2, Clock, AlertTriangle, X, Download,
  Calendar, TrendingUp, Shield, Bell, FileText,
  ArrowRight, ExternalLink, History, Zap,
} from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import Link from "next/link";
import ModalPortal from "@/components/ModalPortal";

// ── Types ──
interface GstFiling {
  id: string; month: number; year: number; returnType: string; status: string;
  filedDate: string | null; arnNumber: string; taxPayable: number; taxPaid: number;
  lateFee: number; interestAmount: number; notes: string; createdAt: string; updatedAt: string;
}
interface MonthlyTaxSplit {
  month: number; year: number;
  b2b: { invoices: number; taxable: number; gst: number };
  b2c: { invoices: number; taxable: number; gst: number };
  totalGst: number;
}

// ── Helpers ──
const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const MONTH_FULL = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

function getFYMonths(fy: string) {
  const [startYear] = fy.split("-").map(Number);
  return MONTHS.map((label, i) => {
    const month = i < 9 ? i + 4 : i - 8;
    const year = month >= 4 ? startYear : startYear + 1;
    return { label, month, year };
  });
}

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

function daysDiff(a: Date, b: Date): number {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function calcLateFee(returnType: string, daysLate: number): number {
  if (daysLate <= 0) return 0;
  return Math.min(50 * daysLate, 10000);
}

function calcInterest(taxPayable: number, daysLate: number): number {
  if (daysLate <= 0 || taxPayable <= 0) return 0;
  return Math.round((taxPayable * 0.18 * daysLate / 365) * 100) / 100;
}

type FilingStatusInfo = { status: string; icon: typeof CheckCircle2; dueDate: Date; daysLeft: number };

function getFilingStatus(filing: GstFiling | undefined, month: number, year: number, returnType: string): FilingStatusInfo {
  const dueDate = getDueDate(month, year, returnType);
  const now = new Date();
  const daysLeft = daysDiff(dueDate, now);
  if (filing?.status === "Filed") return { status: "Filed", icon: CheckCircle2, dueDate, daysLeft };
  if (now > dueDate) return { status: "Overdue", icon: AlertTriangle, dueDate, daysLeft };
  if (daysLeft <= 5) return { status: "Due Soon", icon: Clock, dueDate, daysLeft };
  return { status: "Pending", icon: Clock, dueDate, daysLeft };
}

// ── Component ──
export default function GSTDashboardPage() {
  const [fy, setFy] = useState(getCurrentFY());
  const [filings, setFilings] = useState<GstFiling[]>([]);
  const [taxSplits, setTaxSplits] = useState<MonthlyTaxSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [gstEnabled, setGstEnabled] = useState<boolean | null>(null);

  // Filing modal
  const [showFilingModal, setShowFilingModal] = useState(false);
  const [filingForm, setFilingForm] = useState({
    month: 0, year: 0, returnType: "GSTR1", filedDate: "", arnNumber: "",
    taxPayable: 0, taxPaid: 0, lateFee: 0, interestAmount: 0, notes: "",
  });

  async function loadData() {
    try {
      const settingsData = await apiGet<{ gstEnabled?: boolean }>("/api/settings");
      const enabled = settingsData?.gstEnabled !== false;
      setGstEnabled(enabled);
      if (!enabled) { setLoading(false); return; }
      const [filingsData, splitsData] = await Promise.all([
        apiGet<GstFiling[]>(`/api/gst-filings?fy=${fy}`),
        apiGet<MonthlyTaxSplit[]>(`/api/gst-report?type=fy-summary&fy=${fy}`),
      ]);
      setFilings(filingsData);
      setTaxSplits(splitsData);
    } finally {
      setLoading(false);
    }
  }

  async function enableGst() {
    const current = await apiGet<Record<string, unknown>>("/api/settings");
    await import("@/lib/api").then(m => m.apiPut("/api/settings", { ...current, gstEnabled: true }));
    setGstEnabled(true);
    setLoading(true);
    loadData();
  }

  useEffect(() => { setLoading(true); loadData(); }, [fy]);

  const fyMonths = getFYMonths(fy);
  const now = new Date();

  function getFiling(month: number, year: number, returnType: string) {
    return filings.find(f => f.month === month && f.year === year && f.returnType === returnType);
  }

  // Computed
  const pastMonths = fyMonths.filter(({ month, year }) => new Date(year, month - 1, 1) < now);
  const expectedFilings = pastMonths.length * 2;
  const filedCount = filings.filter(f => f.status === "Filed").length;
  const compliancePercent = expectedFilings === 0 ? 100 : Math.round((filedCount / expectedFilings) * 100);

  const overdueReturns: { month: number; year: number; returnType: string; daysLate: number; lateFee: number }[] = [];
  const dueSoonReturns: { month: number; year: number; returnType: string; daysLeft: number; dueDate: Date }[] = [];
  let nextDue: { month: number; year: number; returnType: string; daysLeft: number; dueDate: Date } | null = null;

  for (const { month, year } of fyMonths) {
    if (new Date(year, month - 1, 1) > now) continue;
    for (const rt of ["GSTR1", "GSTR3B"] as const) {
      const s = getFilingStatus(getFiling(month, year, rt), month, year, rt);
      if (s.status === "Overdue") {
        const daysLate = Math.abs(s.daysLeft);
        overdueReturns.push({ month, year, returnType: rt, daysLate, lateFee: calcLateFee(rt, daysLate) });
      } else if (s.status === "Due Soon") {
        dueSoonReturns.push({ month, year, returnType: rt, daysLeft: s.daysLeft, dueDate: s.dueDate });
      } else if (s.status === "Pending" && (!nextDue || s.dueDate < nextDue.dueDate)) {
        nextDue = { month, year, returnType: rt, daysLeft: s.daysLeft, dueDate: s.dueDate };
      }
    }
  }
  if (!nextDue && dueSoonReturns.length > 0) nextDue = dueSoonReturns[0];

  const totalTaxPaid = filings.reduce((s, f) => s + f.taxPaid, 0);
  const totalLateFees = filings.reduce((s, f) => s + f.lateFee, 0);
  const fyB2bGst = taxSplits.reduce((s, t) => s + t.b2b.gst, 0);
  const fyB2cGst = taxSplits.reduce((s, t) => s + t.b2c.gst, 0);
  const fyB2bInvoices = taxSplits.reduce((s, t) => s + t.b2b.invoices, 0);
  const fyB2cInvoices = taxSplits.reduce((s, t) => s + t.b2c.invoices, 0);
  const fyTotalGst = fyB2bGst + fyB2cGst;

  // Actions
  async function openMarkFiled(month: number, year: number, returnType: string) {
    const existing = getFiling(month, year, returnType);
    const dueDate = getDueDate(month, year, returnType);
    const daysLate = Math.max(0, daysDiff(now, dueDate));

    // Auto-fetch tax amounts from invoices
    let autoTaxPayable = existing?.taxPayable || 0;
    if (!existing?.taxPayable) {
      try {
        const taxData = await apiGet<{ net: { total: number } }>(`/api/gst-report?type=tax-summary&month=${month}&year=${year}`);
        if (taxData?.net?.total) autoTaxPayable = Math.round(taxData.net.total * 100) / 100;
      } catch { /* use 0 */ }
    }

    setFilingForm({
      month, year, returnType,
      filedDate: existing?.filedDate?.split("T")[0] || new Date().toISOString().split("T")[0],
      arnNumber: existing?.arnNumber || "",
      taxPayable: autoTaxPayable,
      taxPaid: existing?.taxPaid || autoTaxPayable,
      lateFee: existing?.lateFee || calcLateFee(returnType, daysLate),
      interestAmount: existing?.interestAmount || calcInterest(autoTaxPayable, daysLate),
      notes: existing?.notes || "",
    });
    setShowFilingModal(true);
  }

  async function handleFilingSubmit(e: React.FormEvent) {
    e.preventDefault();
    await apiPost("/api/gst-filings", { ...filingForm, status: "Filed" });
    setShowFilingModal(false);
    loadData();
  }

  if (loading) return <PageLoading message="Loading GST data..." />;

  // GST not enabled — show activation prompt
  if (gstEnabled === false) {
    return (
      <div className="w-full space-y-6">
        <PageHeader title="GST Returns" breadcrumbs={[{ label: "Compliance" }, { label: "GST Returns" }]} />
        <div className="card p-10 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-indigo-500" />
          </div>
          <h2 className="text-[18px] font-bold text-slate-800 mb-2">GST is not enabled</h2>
          <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
            Your business is not currently registered under GST. Enable GST to access compliance features like GSTR-1, GSTR-3B filing tracker, tax calculations, and returns management.
          </p>
          <button onClick={enableGst} className="btn btn-primary btn-lg">
            <Zap size={16} /> Enable GST Features
          </button>
          <p className="text-[11px] text-slate-400 mt-3">
            You can also enable this from <Link href="/settings" className="text-indigo-600 underline">Settings → Company Info</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="GST Returns"
        breadcrumbs={[{ label: "Compliance" }, { label: "GST Returns" }]}
        action={
          <div className="flex items-center gap-3">
            <select value={fy} onChange={e => setFy(e.target.value)} className="inp w-40 text-[13px]">
              {getFYOptions().map(f => <option key={f} value={f}>FY {f}</option>)}
            </select>
          </div>
        }
      />

      {/* ── Urgent Action Banner ── */}
      {overdueReturns.length > 0 && (
        <div className="rounded-2xl border-[1.5px] border-red-200 bg-gradient-to-r from-red-50 to-white px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 max-sm:hidden">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-red-800">
              {overdueReturns.length} Overdue Return{overdueReturns.length > 1 ? "s" : ""} — Action Required!
            </p>
            <div className="mt-1 space-y-0.5">
              {overdueReturns.slice(0, 3).map((o, i) => (
                <p key={i} className="text-[12px] text-red-700">
                  {o.returnType === "GSTR1" ? "GSTR-1" : "GSTR-3B"} for {MONTH_FULL[o.month]} {o.year} — {o.daysLate} days late · Late fee: {fmt(o.lateFee)}
                </p>
              ))}
            </div>
          </div>
          <button
            onClick={() => { const o = overdueReturns[0]; openMarkFiled(o.month, o.year, o.returnType); }}
            className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-[12px] font-semibold rounded-lg hover:bg-red-700 transition-colors max-sm:w-full"
          >
            File Now
          </button>
        </div>
      )}

      {overdueReturns.length === 0 && dueSoonReturns.length > 0 && (
        <div className="rounded-2xl border-[1.5px] border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 max-sm:hidden">
            <Bell size={20} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-amber-800">Upcoming Deadline{dueSoonReturns.length > 1 ? "s" : ""}</p>
            {dueSoonReturns.map((d, i) => (
              <p key={i} className="text-[12px] text-amber-700 mt-0.5">
                {d.returnType === "GSTR1" ? "GSTR-1" : "GSTR-3B"} for {MONTH_FULL[d.month]} {d.year} — Due {d.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} ({d.daysLeft}d left)
              </p>
            ))}
          </div>
          <button
            onClick={() => { const d = dueSoonReturns[0]; openMarkFiled(d.month, d.year, d.returnType); }}
            className="flex-shrink-0 px-4 py-2 bg-amber-600 text-white text-[12px] font-semibold rounded-lg hover:bg-amber-700 transition-colors max-sm:w-full"
          >
            File Now
          </button>
        </div>
      )}

      {overdueReturns.length === 0 && dueSoonReturns.length === 0 && expectedFilings > 0 && filedCount === expectedFilings && (
        <div className="rounded-2xl border-[1.5px] border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-emerald-800">All Returns Filed On Time!</p>
            <p className="text-[12px] text-emerald-600">Great job — you&apos;re fully compliant for FY {fy}.</p>
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="card px-3 sm:px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Calendar size={16} className="text-indigo-600" />
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Next Due</p>
          </div>
          {nextDue ? (
            <>
              <p className="text-[15px] font-bold text-slate-800">{nextDue.returnType === "GSTR1" ? "GSTR-1" : "GSTR-3B"}</p>
              <p className="text-[12px] text-slate-500">{MONTH_FULL[nextDue.month]} {nextDue.year}</p>
              <p className={`text-[13px] font-bold mt-1 ${nextDue.daysLeft <= 5 ? "text-amber-600" : "text-indigo-600"}`}>
                {nextDue.daysLeft} day{nextDue.daysLeft !== 1 ? "s" : ""} left
              </p>
            </>
          ) : <p className="text-[20px] font-bold text-emerald-600 mt-1">—</p>}
        </div>

        <div className="card px-3 sm:px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${overdueReturns.length > 0 ? "bg-red-50" : "bg-slate-50"}`}>
              <AlertTriangle size={16} className={overdueReturns.length > 0 ? "text-red-600" : "text-slate-400"} />
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Overdue</p>
          </div>
          <p className={`text-[28px] font-bold mt-1 ${overdueReturns.length > 0 ? "text-red-600" : "text-slate-300"}`}>{overdueReturns.length}</p>
          {overdueReturns.length > 0 && <p className="text-[11px] text-red-500">Est. late fees: {fmt(overdueReturns.reduce((s, o) => s + o.lateFee, 0))}</p>}
        </div>

        <div className="card px-3 sm:px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-purple-600" />
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tax Paid (FY)</p>
          </div>
          <p className="text-[16px] sm:text-[22px] font-bold text-purple-600 mt-1">{fmt(totalTaxPaid)}</p>
          {totalLateFees > 0 && <p className="text-[11px] text-red-500">Late fees: {fmt(totalLateFees)}</p>}
        </div>

        <div className="card px-3 sm:px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${compliancePercent === 100 ? "bg-emerald-50" : compliancePercent >= 80 ? "bg-amber-50" : "bg-red-50"}`}>
              <Shield size={16} className={compliancePercent === 100 ? "text-emerald-600" : compliancePercent >= 80 ? "text-amber-600" : "text-red-600"} />
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Compliance</p>
          </div>
          <p className={`text-[28px] font-bold mt-1 ${compliancePercent === 100 ? "text-emerald-600" : compliancePercent >= 80 ? "text-amber-600" : "text-red-600"}`}>
            {expectedFilings === 0 ? "—" : `${compliancePercent}%`}
          </p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full transition-all ${compliancePercent === 100 ? "bg-emerald-500" : compliancePercent >= 80 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${compliancePercent}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{filedCount} / {expectedFilings} returns filed</p>
        </div>
      </div>

      {/* ── Two-Column Layout: Filing Tracker + B2B/B2C ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Filing Tracker — Takes 2 columns */}
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-slate-800">Filing Tracker — FY {fy}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">GSTR-1 due 11th · GSTR-3B due 20th of following month</p>
            </div>
            <Link href="/gst-report/filings" className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="text-center">GSTR-1</th>
                  <th className="text-center">GSTR-3B</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fyMonths.map(({ label, month, year }) => {
                  const periodDate = new Date(year, month - 1, 1);
                  const isFuture = periodDate > now;
                  const g1Filing = getFiling(month, year, "GSTR1");
                  const g3Filing = getFiling(month, year, "GSTR3B");
                  const g1Status = getFilingStatus(g1Filing, month, year, "GSTR1");
                  const g3Status = getFilingStatus(g3Filing, month, year, "GSTR3B");

                  const StatusBadge = ({ s }: { s: FilingStatusInfo }) => {
                    if (isFuture) return <span className="text-[11px] text-slate-300">—</span>;
                    const colors: Record<string, string> = {
                      Filed: "bg-emerald-50 text-emerald-700",
                      Overdue: "bg-red-50 text-red-700",
                      "Due Soon": "bg-amber-50 text-amber-700",
                      Pending: "bg-slate-100 text-slate-500",
                    };
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${colors[s.status]}`}>
                        <s.icon size={11} /> {s.status}
                      </span>
                    );
                  };

                  return (
                    <tr key={`${month}-${year}`} className={isFuture ? "opacity-30" : ""}>
                      <td className="font-semibold text-slate-800">{label} {year}</td>
                      <td className="text-center"><StatusBadge s={g1Status} /></td>
                      <td className="text-center"><StatusBadge s={g3Status} /></td>
                      <td className="text-center">
                        {!isFuture && (
                          <div className="flex items-center justify-center gap-1">
                            {(g1Status.status !== "Filed" || g3Status.status !== "Filed") && (
                              <button
                                onClick={() => {
                                  const target = g1Status.status !== "Filed" ? "GSTR1" : "GSTR3B";
                                  openMarkFiled(month, year, target);
                                }}
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                              >
                                File
                              </button>
                            )}
                            <Link
                              href={`/gst-report/returns?month=${month}&year=${year}`}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
                            >
                              <ExternalLink size={11} /> Report
                            </Link>
                            {g1Status.status === "Filed" && g3Status.status === "Filed" && (
                              <span className="text-[11px] text-emerald-500">✓</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column — B2B/B2C + Quick Links */}
        <div className="space-y-6">
          {/* B2B vs B2C Card */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-[14px] font-bold text-slate-800">GST Billing Split</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">FY {fy} — B2B (collected) vs B2C (your cost)</p>
            </div>
            <div className="p-5 space-y-4">
              {/* B2B */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider">B2B — Collected</p>
                  <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{fyB2bInvoices} inv</span>
                </div>
                <p className="text-[20px] font-bold text-blue-700 mt-1">{fmt(fyB2bGst)}</p>
                <p className="text-[11px] text-blue-400">Auto-recovered from customer bills</p>
              </div>

              {/* B2C */}
              <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wider">B2C — Your Cost</p>
                  <span className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">{fyB2cInvoices} inv</span>
                </div>
                <p className="text-[20px] font-bold text-orange-700 mt-1">{fmt(fyB2cGst)}</p>
                <p className="text-[11px] text-orange-400">GST you pay from pocket</p>
              </div>

              {/* Total */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total GST Liability</p>
                <p className="text-[20px] font-bold text-slate-800 mt-1">{fmt(fyTotalGst)}</p>
                {fyTotalGst > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${(fyB2bGst / fyTotalGst * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{Math.round(fyB2bGst / fyTotalGst * 100)}% B2B</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-[14px] font-bold text-slate-800">Quick Actions</h3>
            </div>
            <div className="divide-y divide-slate-50">
              <Link href="/gst-report/filings" className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <History size={14} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">Filing History</p>
                  <p className="text-[11px] text-slate-400">View all filings, filter by status, export CSV</p>
                </div>
                <ArrowRight size={14} className="text-slate-300" />
              </Link>

              {nextDue && (
                <button
                  onClick={() => openMarkFiled(nextDue!.month, nextDue!.year, nextDue!.returnType)}
                  className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Zap size={14} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">
                      File {nextDue.returnType === "GSTR1" ? "GSTR-1" : "GSTR-3B"} ({MONTH_FULL[nextDue.month].slice(0, 3)})
                    </p>
                    <p className="text-[11px] text-slate-400">Mark next pending return as filed</p>
                  </div>
                  <ArrowRight size={14} className="text-slate-300" />
                </button>
              )}

              {overdueReturns.length > 0 && (
                <button
                  onClick={() => { const o = overdueReturns[0]; openMarkFiled(o.month, o.year, o.returnType); }}
                  className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-red-50/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={14} className="text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-red-700">File Overdue Return</p>
                    <p className="text-[11px] text-red-400">{overdueReturns[0].returnType === "GSTR1" ? "GSTR-1" : "GSTR-3B"} for {MONTH_FULL[overdueReturns[0].month]} — {overdueReturns[0].daysLate}d late</p>
                  </div>
                  <ArrowRight size={14} className="text-red-300" />
                </button>
              )}

              <Link href="/gst-report/purchase-bills" className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">Purchase Bills</p>
                  <p className="text-[11px] text-slate-400">Track vendor bills & Input Tax Credit (ITC)</p>
                </div>
                <ArrowRight size={14} className="text-slate-300" />
              </Link>

              <Link href="/gst-report/challans" className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={14} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">Tax Challans</p>
                  <p className="text-[11px] text-slate-400">Record GST payments to government</p>
                </div>
                <ArrowRight size={14} className="text-slate-300" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mark as Filed Modal ── */}
      {showFilingModal && (
        <ModalPortal>
        <div className="modal-bg" onClick={() => setShowFilingModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">
                  Mark {filingForm.returnType === "GSTR1" ? "GSTR-1" : "GSTR-3B"} as Filed
                </h2>
                <p className="text-[12px] text-slate-400">{MONTH_FULL[filingForm.month]} {filingForm.year}</p>
              </div>
              <button onClick={() => setShowFilingModal(false)} className="act"><X size={16} /></button>
            </div>

            {(() => {
              const dueDate = getDueDate(filingForm.month, filingForm.year, filingForm.returnType);
              const daysLate = daysDiff(now, dueDate);
              if (daysLate <= 0) return null;
              return (
                <div className="mx-5 mt-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-[12px] font-semibold text-red-700">
                    <AlertTriangle size={12} className="inline mr-1" />
                    This return is {daysLate} days past due (due {dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })})
                  </p>
                  <p className="text-[11px] text-red-600 mt-1">
                    Estimated late fee: {fmt(calcLateFee(filingForm.returnType, daysLate))} · Interest (18% p.a.): {fmt(calcInterest(filingForm.taxPayable, daysLate))}
                  </p>
                </div>
              );
            })()}

            <form onSubmit={handleFilingSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Filed Date *</label>
                  <input type="date" required value={filingForm.filedDate} onChange={e => setFilingForm({ ...filingForm, filedDate: e.target.value })} className="inp" />
                </div>
                <div>
                  <label className="lbl">ARN Number</label>
                  <input type="text" value={filingForm.arnNumber} onChange={e => setFilingForm({ ...filingForm, arnNumber: e.target.value })} className="inp font-mono" placeholder="e.g. AA1234..." />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Tax Payable (₹)</label>
                  <input type="number" step="0.01" value={filingForm.taxPayable || ""} onChange={e => {
                    const tp = Number(e.target.value);
                    const dueDate = getDueDate(filingForm.month, filingForm.year, filingForm.returnType);
                    const daysLate = Math.max(0, daysDiff(now, dueDate));
                    setFilingForm({ ...filingForm, taxPayable: tp, interestAmount: calcInterest(tp, daysLate) });
                  }} className="inp" />
                </div>
                <div>
                  <label className="lbl">Tax Paid (₹)</label>
                  <input type="number" step="0.01" value={filingForm.taxPaid || ""} onChange={e => setFilingForm({ ...filingForm, taxPaid: Number(e.target.value) })} className="inp" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Late Fee (₹)</label>
                  <input type="number" step="0.01" value={filingForm.lateFee || ""} onChange={e => setFilingForm({ ...filingForm, lateFee: Number(e.target.value) })} className="inp" />
                  <p className="text-[10px] text-slate-400 mt-0.5">₹50/day, max ₹10,000</p>
                </div>
                <div>
                  <label className="lbl">Interest (₹)</label>
                  <input type="number" step="0.01" value={filingForm.interestAmount || ""} onChange={e => setFilingForm({ ...filingForm, interestAmount: Number(e.target.value) })} className="inp" />
                  <p className="text-[10px] text-slate-400 mt-0.5">18% p.a. on outstanding tax</p>
                </div>
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea value={filingForm.notes} onChange={e => setFilingForm({ ...filingForm, notes: e.target.value })} className="inp" rows={2} placeholder="Any remarks about this filing..." />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" className="btn btn-primary"><CheckCircle2 size={14} /> Mark as Filed</button>
                <button type="button" onClick={() => setShowFilingModal(false)} className="btn btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
