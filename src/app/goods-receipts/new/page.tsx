"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoodsReceiptNote, Vendor, LineItem, CompanySettings } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { createEmptyLineItem, calculateTotals, calculateLineItem } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import LineItemsEditor from "@/components/LineItemsEditor";
import { format } from "date-fns";

function GoodsReceiptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [title, setTitle] = useState("Goods Receipt Note");
  const [grnNo, setGrnNo] = useState("");
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vendorId, setVendorId] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [items, setItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<GoodsReceiptNote["status"]>("Draft");
  const [isInterState, setIsInterState] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    apiGet<Vendor[] | { data: Vendor[] }>("/api/vendors").then((d) => setVendors(Array.isArray(d) ? d : d.data));
    apiGet<CompanySettings>("/api/settings").then(setSettings);
    if (editId) {
      apiGet<GoodsReceiptNote>(`/api/goods-receipts/${editId}`).then((g) => {
        if (g) {
          setTitle(g.title); setGrnNo(g.grnNo); setReceiptDate(g.receiptDate); setVendorId(g.vendorId);
          setVehicleNo(g.vehicleNo || ""); setItems(g.items.length ? g.items : [createEmptyLineItem()]);
          setNotes(g.notes); setStatus(g.status); setIsInterState((g.totalIgst || 0) > 0);
        }
      });
    }
  }, [editId]);

  const selectedVendor = vendors.find((v) => v.id === vendorId);
  function toggleInterState(next: boolean) {
    setIsInterState(next);
    setItems((prev) => prev.map((item) => calculateLineItem(item, next)));
  }
  const totals = calculateTotals(items, 0, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { title, receiptDate, vendorId, vehicleNo, items, ...totals, status, notes };
    if (editId) await apiPut(`/api/goods-receipts/${editId}`, { ...data, grnNo });
    else await apiPost("/api/goods-receipts", data);
    router.push("/goods-receipts");
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={editId ? "Edit Goods Receipt" : "Create New Goods Receipt"}
        breadcrumbs={[{ label: "Finance" }, { label: "Goods Receipts", href: "/goods-receipts" }, { label: editId ? "Edit" : "New" }]}
      />
      <form onSubmit={handleSubmit} className="space-y-5"
        onKeyDown={(e) => { const tag = (e.target as HTMLElement).tagName; if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON") e.preventDefault(); }}>
        <div className="card p-6">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold border-b-2 border-dashed border-slate-200 focus:border-indigo-400 pb-1 bg-transparent outline-none min-w-0 mb-6" placeholder="Title" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {editId && (
              <div><label className="lbl">GRN No</label><input type="text" value={grnNo} onChange={(e) => setGrnNo(e.target.value)} className="inp font-mono" /></div>
            )}
            <div><label className="lbl">Receipt Date *</label><input type="date" required value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className="inp" /></div>
            <div><label className="lbl">Vehicle No</label><input type="text" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className="inp" placeholder="e.g. TN09 AB 1234" /></div>
            {editId && (
              <div><label className="lbl">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as GoodsReceiptNote["status"])} className="inp">
                  {["Draft", "Posted", "Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
                <input type="checkbox" checked={isInterState} onChange={(e) => toggleInterState(e.target.checked)} /> Inter-state (IGST)
              </label>
            </div>
          </div>

          <div className="doc-from-box max-w-md">
            <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
              Vendor <span className="text-slate-400 font-normal">— Goods received from</span>
            </h3>
            <select required value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="inp mb-3">
              <option value="">Select a Vendor</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            {selectedVendor && (
              <div className="space-y-1 text-[13px]">
                <p className="font-semibold text-slate-900">{selectedVendor.name}</p>
                {selectedVendor.gstin && <p className="text-slate-500">GSTIN: {selectedVendor.gstin}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <LineItemsEditor items={items} onChange={setItems} themeColor={settings?.themeColor} isInterState={isInterState} />
          <div className="flex justify-end mt-6">
            <div className="w-full max-w-xs space-y-2 text-[13px]">
              <div className="flex justify-between text-slate-600"><span>Amount</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
              {isInterState
                ? <div className="flex justify-between text-slate-600"><span>IGST</span><span>₹{totals.totalIgst.toFixed(2)}</span></div>
                : <>
                    <div className="flex justify-between text-slate-600"><span>SGST</span><span>₹{totals.totalSgst.toFixed(2)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>CGST</span><span>₹{totals.totalCgst.toFixed(2)}</span></div>
                  </>}
              <div className="flex justify-between font-bold text-[16px] border-t-2 border-slate-200 pt-3 mt-1"><span>Total Value (INR)</span><span className="nums">₹{totals.totalAmount.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <label className="lbl">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="inp" />
        </div>

        <div className="flex items-center gap-3 pb-4">
          <button type="submit" className="btn btn-primary btn-lg">{editId ? "Update Goods Receipt" : "Save Goods Receipt"}</button>
          <button type="button" onClick={() => router.push("/goods-receipts")} className="btn btn-outline btn-lg">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function GoodsReceiptNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>}>
      <GoodsReceiptForm />
    </Suspense>
  );
}
