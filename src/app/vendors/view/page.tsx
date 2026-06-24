"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Vendor, VendorPayment } from "@/lib/types";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { ArrowLeft, Plus, X, CreditCard, Mail, Phone, MapPin, FileText, CalendarDays } from "lucide-react";
import Link from "next/link";
import ModalPortal from "@/components/ModalPortal";
import { confirmDialog, alertDialog } from "@/components/Dialog";

interface VendorDetail extends Vendor {
  payments: VendorPayment[];
}

const emptyPay = { amount: "", paidDate: new Date().toISOString().slice(0, 10), description: "", paymentMethod: "Bank Transfer", notes: "" };

function VendorViewContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [payForm, setPayForm] = useState(emptyPay);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = await apiGet<VendorDetail>(`/api/vendors/${id}`);
      setVendor(d);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const totalPaid = vendor?.payments?.reduce((s, p) => s + p.amount, 0) ?? 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!payForm.amount || !payForm.paidDate) return;
    try {
      await apiPost(`/api/vendors/${id}/pay`, {
        ...payForm,
        amount: Number(payForm.amount),
      });
      setPayForm(emptyPay);
      setShowPay(false);
      await load();
    } catch (err) {
      (await alertDialog({ title: "Notice", message: String(err) }));
    }
  }

  if (loading) return <div className="text-[13px] text-slate-400 py-12 text-center">Loading...</div>;
  if (!vendor) return <div className="text-[13px] text-slate-400 py-12 text-center">Vendor not found.</div>;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={vendor.name}
        breadcrumbs={[
          { label: "Finance" },
          { label: "Vendors", href: "/vendors" },
          { label: vendor.name },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Link href="/vendors" className="btn btn-outline"><ArrowLeft size={14} /> Back</Link>
            <button onClick={() => { setPayForm(emptyPay); setShowPay(true); }} className="btn btn-primary"><Plus size={14} /> Record Payment</button>
          </div>
        }
      />

      {/* Vendor Info Card */}
      <div className="card px-6 py-5">
        <div className="flex items-start gap-5">
          <div className="av av-lg shrink-0 text-white text-[18px]" style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)", width: 52, height: 52, borderRadius: 14 }}>
            {vendor.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">{vendor.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2.5 mt-3">
              {vendor.email && (
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <Mail size={13} className="text-slate-400 shrink-0" /> {vendor.email}
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <Phone size={13} className="text-slate-400 shrink-0" /> {vendor.phone}
                </div>
              )}
              {vendor.gstin && (
                <div className="flex items-center gap-2 text-[12px] text-slate-500">
                  <FileText size={13} className="text-slate-400 shrink-0" /> GSTIN: {vendor.gstin}
                </div>
              )}
              {vendor.address && (
                <div className="flex items-center gap-2 text-[12px] text-slate-500 sm:col-span-2">
                  <MapPin size={13} className="text-slate-400 shrink-0" /> {vendor.address}
                </div>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Total Paid</p>
            <p className="text-[20px] font-bold text-slate-900 mt-0.5">{fmt(totalPaid)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{vendor.payments?.length ?? 0} payments</p>
          </div>
        </div>
        {vendor.notes && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-1">Notes</p>
            <p className="text-[12px] text-slate-600">{vendor.notes}</p>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPay && (
        <ModalPortal>
        <div className="modal-bg">
          <div className="modal">
            <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Record Payment</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">Record a payment to {vendor.name}</p>
              </div>
              <button onClick={() => setShowPay(false)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
            </div>
            <form onSubmit={handlePay} className="px-5 sm:px-7 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Amount *</label>
                  <input required type="number" min="1" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="inp" placeholder="0.00" />
                </div>
                <div>
                  <label className="lbl">Payment Date *</label>
                  <input required type="date" value={payForm.paidDate} onChange={(e) => setPayForm({ ...payForm, paidDate: e.target.value })} className="inp" />
                </div>
                <div>
                  <label className="lbl">Payment Method</label>
                  <select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })} className="inp">
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Cheque</option>
                    <option>Card</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="lbl">Description</label>
                  <input type="text" value={payForm.description} onChange={(e) => setPayForm({ ...payForm, description: e.target.value })} className="inp" placeholder="What was this payment for?" />
                </div>
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} rows={2} className="inp" />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setShowPay(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Payment History */}
      <div className="card overflow-hidden w-full">
        <div className="px-5 py-3.5 border-b border-[#EEF0F6]" style={{ background: "#FAFBFD" }}>
          <h3 className="sec-title">Payment History</h3>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {["#", "Date", "Description", "Method", "Amount", "Notes"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!vendor.payments || vendor.payments.length === 0) ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">
                      <div className="empty-icon"><CreditCard size={20} /></div>
                      <p className="text-[13px] text-slate-400">No payments recorded yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                vendor.payments.map((p, i) => (
                  <tr key={p.id}>
                    <td className="text-slate-300 font-semibold text-[12px] w-10">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-1.5 text-[12px] text-slate-600">
                        <CalendarDays size={12} className="text-slate-400" />
                        {fmtDate(p.paidDate)}
                      </div>
                    </td>
                    <td className="text-[12px] text-slate-700">{p.description || "—"}</td>
                    <td>
                      <span className="pill">{p.paymentMethod}</span>
                    </td>
                    <td className="text-[12px] font-semibold text-slate-900">{fmt(p.amount)}</td>
                    <td className="text-[11px] text-slate-400">{p.notes || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function VendorViewPage() {
  return (
    <Suspense fallback={<div className="text-[13px] text-slate-400 py-12 text-center">Loading...</div>}>
      <VendorViewContent />
    </Suspense>
  );
}
