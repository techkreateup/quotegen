"use client";

import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import PageLoading from "@/components/PageLoading";
import {
  Plus, X, CheckCircle2, ArrowLeft, CreditCard, Banknote,
} from "lucide-react";
import Link from "next/link";
import ModalPortal from "@/components/ModalPortal";

interface GstChallan {
  id: string; challanNo: string; challanDate: string; month: number; year: number;
  igst: number; cgst: number; sgst: number; cess: number; totalAmount: number;
  paymentMode: string; bankName: string; cin: string; status: string; notes: string;
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
  return Array.from({ length: 4 }, (_, i) => { const s = currentStart - i; return `${s}-${s + 1}`; });
}

export default function ChallansPage() {
  const [fy, setFy] = useState(getCurrentFY());
  const [challans, setChallans] = useState<GstChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    challanNo: "", challanDate: new Date().toISOString().split("T")[0],
    month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    igst: 0, cgst: 0, sgst: 0, cess: 0, totalAmount: 0,
    paymentMode: "Net Banking", bankName: "", cin: "", notes: "",
  });

  // Auto-compute total when tax amounts change
  const computedTotal = form.igst + form.cgst + form.sgst + form.cess;

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<GstChallan[]>(`/api/gst-challans?fy=${fy}`);
      setChallans(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [fy]);

  // Auto-fill tax from invoices when month/year changes
  async function autoFillTax(month: number, year: number) {
    try {
      const taxData = await apiGet<{ net: { igst: number; cgst: number; sgst: number; total: number } }>(`/api/gst-report?type=tax-summary&month=${month}&year=${year}`);
      if (taxData?.net) {
        setForm(f => ({
          ...f, month, year,
          igst: Math.round(taxData.net.igst * 100) / 100,
          cgst: Math.round(taxData.net.cgst * 100) / 100,
          sgst: Math.round(taxData.net.sgst * 100) / 100,
          totalAmount: Math.round(taxData.net.total * 100) / 100,
        }));
      }
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await apiPost("/api/gst-challans", { ...form, totalAmount: computedTotal, status: "Paid" });
    setShowModal(false);
    setForm({
      challanNo: "", challanDate: new Date().toISOString().split("T")[0],
      month: new Date().getMonth() + 1, year: new Date().getFullYear(),
      igst: 0, cgst: 0, sgst: 0, cess: 0, totalAmount: 0,
      paymentMode: "Net Banking", bankName: "", cin: "", notes: "",
    });
    load();
  }

  const totalPaid = challans.reduce((s, c) => s + c.totalAmount, 0);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Tax Payment Challans"
        subtitle="Track GST payments made to the government"
        breadcrumbs={[
          { label: "GST Returns", href: "/gst-report" },
          { label: "Challans" },
        ]}
        action={
          <div className="flex items-center gap-3">
            <select value={fy} onChange={e => setFy(e.target.value)} className="inp w-40 text-[13px]">
              {getFYOptions().map(f => <option key={f} value={f}>FY {f}</option>)}
            </select>
            <button onClick={() => { setShowModal(true); autoFillTax(form.month, form.year); }} className="btn btn-primary btn-sm">
              <Plus size={14} /> Record Payment
            </button>
            <Link href="/gst-report" className="btn btn-outline btn-sm">
              <ArrowLeft size={14} /> Dashboard
            </Link>
          </div>
        }
      />

      {loading && <PageLoading message="Loading challans..." />}

      {!loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="card px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Payments Made</p>
              <p className="text-[24px] font-bold text-slate-800 mt-1">{challans.length}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] text-emerald-500 font-semibold uppercase">Total Paid (FY)</p>
              <p className="text-[20px] font-bold text-emerald-600 mt-1">{fmt(totalPaid)}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">IGST / CGST / SGST</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[13px] font-semibold text-slate-700">{fmt(challans.reduce((s, c) => s + c.igst, 0))}</span>
                <span className="text-slate-300">/</span>
                <span className="text-[13px] font-semibold text-slate-700">{fmt(challans.reduce((s, c) => s + c.cgst, 0))}</span>
                <span className="text-slate-300">/</span>
                <span className="text-[13px] font-semibold text-slate-700">{fmt(challans.reduce((s, c) => s + c.sgst, 0))}</span>
              </div>
            </div>
          </div>

          {/* Challans Table */}
          <div className="card overflow-hidden">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Challan No</th><th>Date</th><th>Tax Period</th>
                    <th className="text-right">IGST</th><th className="text-right">CGST</th>
                    <th className="text-right">SGST</th><th className="text-right">Total</th>
                    <th>Mode</th><th>CIN</th>
                  </tr>
                </thead>
                <tbody>
                  {challans.length === 0 ? (
                    <tr><td colSpan={9} className="text-center text-slate-400 py-8">
                      No challans recorded yet. Record your first tax payment.
                    </td></tr>
                  ) : challans.map(c => (
                    <tr key={c.id}>
                      <td className="font-semibold text-indigo-600">{c.challanNo || "—"}</td>
                      <td className="text-[12px] text-slate-500">{new Date(c.challanDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="font-semibold">{MONTH_FULL[c.month]} {c.year}</td>
                      <td className="text-right">{fmt(c.igst)}</td>
                      <td className="text-right">{fmt(c.cgst)}</td>
                      <td className="text-right">{fmt(c.sgst)}</td>
                      <td className="text-right font-bold">{fmt(c.totalAmount)}</td>
                      <td className="text-[11px] text-slate-500">{c.paymentMode}</td>
                      <td className="font-mono text-[11px] text-slate-400">{c.cin || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Record Payment Modal */}
      {showModal && (
        <ModalPortal>
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Record Tax Payment</h2>
                <p className="text-[12px] text-slate-400">GST challan details</p>
              </div>
              <button onClick={() => setShowModal(false)} className="act"><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Tax Period Month</label>
                  <select value={form.month} onChange={e => { const m = Number(e.target.value); setForm({ ...form, month: m }); autoFillTax(m, form.year); }} className="inp">
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{MONTH_FULL[i + 1]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lbl">Year</label>
                  <input type="number" value={form.year} onChange={e => { const y = Number(e.target.value); setForm({ ...form, year: y }); autoFillTax(form.month, y); }} className="inp" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Challan No</label>
                  <input type="text" value={form.challanNo} onChange={e => setForm({ ...form, challanNo: e.target.value })} className="inp font-mono" placeholder="PMT-06" />
                </div>
                <div>
                  <label className="lbl">Payment Date *</label>
                  <input type="date" required value={form.challanDate} onChange={e => setForm({ ...form, challanDate: e.target.value })} className="inp" />
                </div>
              </div>

              {/* Tax amounts — auto-filled from invoices */}
              <div className="bg-indigo-50 rounded-lg px-4 py-3">
                <p className="text-[11px] font-semibold text-indigo-600 mb-2">TAX AMOUNTS (auto-calculated from invoices)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold">IGST</label>
                    <input type="number" step="0.01" value={form.igst || ""} onChange={e => setForm({ ...form, igst: Number(e.target.value) })} className="inp text-[12px]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold">CGST</label>
                    <input type="number" step="0.01" value={form.cgst || ""} onChange={e => setForm({ ...form, cgst: Number(e.target.value) })} className="inp text-[12px]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold">SGST</label>
                    <input type="number" step="0.01" value={form.sgst || ""} onChange={e => setForm({ ...form, sgst: Number(e.target.value) })} className="inp text-[12px]" />
                  </div>
                </div>
                <p className="text-[13px] font-bold text-indigo-800 mt-2 text-right">Total: {fmt(computedTotal)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Payment Mode</label>
                  <select value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value })} className="inp">
                    <option>Net Banking</option>
                    <option>NEFT/RTGS</option>
                    <option>Over the Counter</option>
                    <option>Debit Card</option>
                  </select>
                </div>
                <div>
                  <label className="lbl">Bank Name</label>
                  <input type="text" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} className="inp" />
                </div>
              </div>
              <div>
                <label className="lbl">CIN (Challan Identification No)</label>
                <input type="text" value={form.cin} onChange={e => setForm({ ...form, cin: e.target.value })} className="inp font-mono" placeholder="e.g. CINH12345678" />
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="inp" rows={2} placeholder="Any remarks..." />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" className="btn btn-primary"><Banknote size={14} /> Record Payment</button>
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
