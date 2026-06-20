"use client";

import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import PageLoading from "@/components/PageLoading";
import {
  Plus, X, CheckCircle2, Package, ArrowLeft, Trash2,
} from "lucide-react";
import Link from "next/link";
import ModalPortal from "@/components/ModalPortal";

interface Vendor { id: string; name: string; gstin: string }
interface PurchaseBillItem {
  id?: string; itemName: string; hsnSac: string; gstRate: number;
  quantity: number; rate: number; amount: number; cgst: number; sgst: number; igst: number; total: number;
}
interface PurchaseBill {
  id: string; billNo: string; billDate: string; vendorId: string;
  vendor: Vendor; description: string; subtotal: number;
  totalIgst: number; totalCgst: number; totalSgst: number; totalAmount: number;
  status: string; itcEligible: boolean; notes: string;
  items: PurchaseBillItem[]; createdAt: string;
}

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function PurchaseBillsPage() {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    billNo: "", billDate: new Date().toISOString().split("T")[0],
    vendorId: "", description: "", notes: "", itcEligible: true,
  });
  const [items, setItems] = useState<{ itemName: string; hsnSac: string; gstRate: number; quantity: number; rate: number }[]>([
    { itemName: "", hsnSac: "", gstRate: 18, quantity: 1, rate: 0 },
  ]);

  async function load() {
    setLoading(true);
    try {
      const [billsRes, vendorsRes] = await Promise.all([
        apiGet<{ data: PurchaseBill[] }>("/api/purchase-bills?page=1&limit=100"),
        apiGet<Vendor[]>("/api/vendors?all=true").catch(() => []),
      ]);
      setBills(billsRes?.data || []);
      if (Array.isArray(vendorsRes)) setVendors(vendorsRes);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function addItem() {
    setItems([...items, { itemName: "", hsnSac: "", gstRate: 18, quantity: 1, rate: 0 }]);
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: string, value: string | number) {
    const updated = [...items];
    (updated[idx] as Record<string, unknown>)[field] = value;
    setItems(updated);
  }

  // Calculate totals from items
  const subtotal = items.reduce((s, it) => s + (it.quantity * it.rate), 0);
  const totalGst = items.reduce((s, it) => s + (it.quantity * it.rate * it.gstRate / 100), 0);
  const grandTotal = subtotal + totalGst;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorId || !form.billNo) return;
    await apiPost("/api/purchase-bills", {
      ...form,
      items: items.filter(it => it.itemName && it.rate > 0),
    });
    setShowModal(false);
    setForm({ billNo: "", billDate: new Date().toISOString().split("T")[0], vendorId: "", description: "", notes: "", itcEligible: true });
    setItems([{ itemName: "", hsnSac: "", gstRate: 18, quantity: 1, rate: 0 }]);
    load();
  }

  const totalItc = bills.filter(b => b.itcEligible && b.status !== "Cancelled").reduce((s, b) => s + b.totalIgst + b.totalCgst + b.totalSgst, 0);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Purchase Bills"
        subtitle="Track vendor bills for Input Tax Credit (ITC)"
        breadcrumbs={[
          { label: "GST Returns", href: "/gst-report" },
          { label: "Purchase Bills" },
        ]}
        action={
          <div className="flex items-center gap-3">
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> Add Bill
            </button>
            <Link href="/gst-report" className="btn btn-outline btn-sm">
              <ArrowLeft size={14} /> Dashboard
            </Link>
          </div>
        }
      />

      {loading && <PageLoading message="Loading purchase bills..." />}

      {!loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Bills</p>
              <p className="text-[24px] font-bold text-slate-800 mt-1">{bills.length}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Amount</p>
              <p className="text-[20px] font-bold text-slate-800 mt-1">{fmt(bills.reduce((s, b) => s + b.totalAmount, 0))}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] text-emerald-500 font-semibold uppercase">ITC Available</p>
              <p className="text-[20px] font-bold text-emerald-600 mt-1">{fmt(totalItc)}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">ITC Eligible</p>
              <p className="text-[24px] font-bold text-slate-800 mt-1">{bills.filter(b => b.itcEligible).length}</p>
            </div>
          </div>

          {/* Bills Table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-[14px] font-bold text-slate-800">All Purchase Bills</h3>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Bill No</th><th>Date</th><th>Vendor</th><th>GSTIN</th>
                    <th className="text-right">Subtotal</th><th className="text-right">GST</th>
                    <th className="text-right">Total</th><th className="text-center">ITC</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr><td colSpan={8} className="text-center text-slate-400 py-8">
                      No purchase bills yet. Add your first vendor bill to start tracking ITC.
                    </td></tr>
                  ) : bills.map(b => (
                    <tr key={b.id}>
                      <td className="font-semibold text-indigo-600">{b.billNo}</td>
                      <td className="text-[12px] text-slate-500">{new Date(b.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="font-semibold">{b.vendor.name}</td>
                      <td className="font-mono text-[11px] text-slate-400">{b.vendor.gstin || "—"}</td>
                      <td className="text-right">{fmt(b.subtotal)}</td>
                      <td className="text-right text-emerald-600">{fmt(b.totalIgst + b.totalCgst + b.totalSgst)}</td>
                      <td className="text-right font-bold">{fmt(b.totalAmount)}</td>
                      <td className="text-center">
                        {b.itcEligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                            <CheckCircle2 size={11} /> Yes
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Bill Modal */}
      {showModal && (
        <ModalPortal>
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Add Purchase Bill</h2>
                <p className="text-[12px] text-slate-400">Record a vendor bill for ITC tracking</p>
              </div>
              <button onClick={() => setShowModal(false)} className="act"><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="lbl">Bill No *</label>
                  <input type="text" required value={form.billNo} onChange={e => setForm({ ...form, billNo: e.target.value })} className="inp" placeholder="VB-001" />
                </div>
                <div>
                  <label className="lbl">Bill Date *</label>
                  <input type="date" required value={form.billDate} onChange={e => setForm({ ...form, billDate: e.target.value })} className="inp" />
                </div>
                <div>
                  <label className="lbl">Vendor *</label>
                  <select required value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="inp">
                    <option value="">Select vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="lbl">Description</label>
                <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="inp" placeholder="Office supplies, software licenses, etc." />
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="lbl mb-0">Line Items</label>
                  <button type="button" onClick={addItem} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">+ Add Item</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        {idx === 0 && <label className="text-[10px] text-slate-400 font-semibold">Item Name</label>}
                        <input type="text" value={item.itemName} onChange={e => updateItem(idx, "itemName", e.target.value)} className="inp text-[12px]" placeholder="Item name" />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <label className="text-[10px] text-slate-400 font-semibold">HSN/SAC</label>}
                        <input type="text" value={item.hsnSac} onChange={e => updateItem(idx, "hsnSac", e.target.value)} className="inp text-[12px] font-mono" placeholder="9988" />
                      </div>
                      <div className="col-span-1">
                        {idx === 0 && <label className="text-[10px] text-slate-400 font-semibold">GST %</label>}
                        <input type="number" value={item.gstRate} onChange={e => updateItem(idx, "gstRate", Number(e.target.value))} className="inp text-[12px]" />
                      </div>
                      <div className="col-span-1">
                        {idx === 0 && <label className="text-[10px] text-slate-400 font-semibold">Qty</label>}
                        <input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} className="inp text-[12px]" />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <label className="text-[10px] text-slate-400 font-semibold">Rate</label>}
                        <input type="number" step="0.01" value={item.rate || ""} onChange={e => updateItem(idx, "rate", Number(e.target.value))} className="inp text-[12px]" placeholder="0.00" />
                      </div>
                      <div className="col-span-1">
                        {idx === 0 && <label className="text-[10px] text-slate-400 font-semibold">Amount</label>}
                        <p className="text-[12px] font-semibold text-slate-700 py-2">{fmt(item.quantity * item.rate)}</p>
                      </div>
                      <div className="col-span-1">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="act text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-[12px]">
                    <input type="checkbox" checked={form.itcEligible} onChange={e => setForm({ ...form, itcEligible: e.target.checked })} className="rounded" />
                    <span className="font-semibold text-slate-600">ITC Eligible</span>
                  </label>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-[12px] text-slate-500">Subtotal: {fmt(subtotal)}</p>
                  <p className="text-[12px] text-emerald-600 font-semibold">GST (ITC): {fmt(totalGst)}</p>
                  <p className="text-[14px] font-bold text-slate-800">Total: {fmt(grandTotal)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" className="btn btn-primary"><Package size={14} /> Save Bill</button>
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
