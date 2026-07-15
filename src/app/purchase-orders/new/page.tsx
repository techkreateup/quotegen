"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PurchaseOrder, Vendor, LineItem, CompanySettings } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { createEmptyLineItem, calculateTotals, calculateLineItem, numberToWords, roundTotal } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import LineItemsEditor from "@/components/LineItemsEditor";
import { format } from "date-fns";
import { ArrowUp, ArrowDown } from "lucide-react";
import { currentFyLabel, expandFyTokens } from "@/lib/fy";
import DocNumberField from "@/components/DocNumberField";

function PurchaseOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [title, setTitle] = useState("Purchase Order");
  const [purchaseOrderNo, setPurchaseOrderNo] = useState("");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expectedDate, setExpectedDate] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState<PurchaseOrder["status"]>("Draft");
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [additionalChargesLabel, setAdditionalChargesLabel] = useState("");
  const [roundOff, setRoundOff] = useState(0);
  const [isInterState, setIsInterState] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [existing, setExisting] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    apiGet<Vendor[] | { data: Vendor[] }>("/api/vendors").then((d) => setVendors(Array.isArray(d) ? d : d.data));
    apiGet<CompanySettings>("/api/settings").then(setSettings);
    apiGet<PurchaseOrder[] | { data: PurchaseOrder[] }>("/api/purchase-orders").then(d => setExisting(Array.isArray(d) ? d : d.data ?? []));
    if (editId) {
      apiGet<PurchaseOrder>(`/api/purchase-orders/${editId}`).then((o) => {
        if (o) {
          setTitle(o.title); setPurchaseOrderNo(o.purchaseOrderNo); setOrderDate(o.orderDate);
          setExpectedDate(o.expectedDate); setVendorId(o.vendorId);
          setItems(o.items.length ? o.items : [createEmptyLineItem()]);
          setNotes(o.notes); setTerms(o.termsAndConditions); setStatus(o.status);
          setAdditionalCharges(o.additionalCharges || 0);
          setAdditionalChargesLabel(o.additionalChargesLabel || "");
          setRoundOff(o.roundOff || 0);
          setIsInterState((o.totalIgst || 0) > 0);
        }
      });
    }
  }, [editId]);

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  function toggleInterState(next: boolean) {
    setIsInterState(next);
    setItems((prev) => prev.map((item) => calculateLineItem(item, next)));
  }

  const totals = calculateTotals(items, additionalCharges, roundOff);
  const grandTotal = totals.totalAmount;

  const previewNo = (() => {
    if (!settings || !vendorId) return "";
    const s = settings as CompanySettings & { poPrefix?: string; nextPoNo?: number };
    const raw = s.poPrefix ?? "PO";
    const num = s.nextPoNo ?? 1;
    const fy = currentFyLabel(s.fiscalYearStart ?? 4);
    return `${expandFyTokens(raw, fy)}${String(num).padStart(5, "0")}`;
  })();
  const trimmed = purchaseOrderNo.trim();
  const duplicateNo = !!trimmed && existing.some(o => o.purchaseOrderNo === trimmed && o.id !== editId);

  async function handleSubmit(e: React.FormEvent) {
    if (duplicateNo) { e.preventDefault(); return; }
    e.preventDefault();
    const data = {
      title, orderDate, expectedDate, vendorId,
      items, ...totals, additionalCharges, additionalChargesLabel, roundOff,
      status, notes, termsAndConditions: terms,
    };
    if (editId) await apiPut(`/api/purchase-orders/${editId}`, { ...data, purchaseOrderNo });
    else await apiPost("/api/purchase-orders", data);
    router.push("/purchase-orders");
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={editId ? "Edit Purchase Order" : "Create New Purchase Order"}
        breadcrumbs={[{ label: "Finance" }, { label: "Purchase Orders", href: "/purchase-orders" }, { label: editId ? "Edit" : "New" }]}
      />

      <form onSubmit={handleSubmit} className="space-y-5"
        onKeyDown={(e) => {
          const tag = (e.target as HTMLElement).tagName;
          if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON") e.preventDefault();
        }}>

        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold border-b-2 border-dashed border-slate-200 focus:border-indigo-400 pb-1 bg-transparent outline-none min-w-0" placeholder="Title" />
            {settings?.logoUrl
              ? <img src={settings.logoUrl} alt="Logo" className="h-14 max-w-[180px] object-contain shrink-0 bg-white p-1 rounded" />
              : settings?.businessName
                ? <p className="text-xl font-bold shrink-0" style={{ color: settings.themeColor }}>{settings.businessName}</p>
                : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <DocNumberField label="PO No" value={purchaseOrderNo} onChange={setPurchaseOrderNo}
              editing={!!editId} previewNo={previewNo} duplicate={duplicateNo}
              labelKind="PO number" waitingFor="vendor" />
            <div>
              <label className="lbl">Order Date *</label>
              <input type="date" required value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="inp" />
            </div>
            <div>
              <label className="lbl">Expected Date</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="inp" />
            </div>
            {editId && (
              <div>
                <label className="lbl">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as PurchaseOrder["status"])} className="inp">
                  {["Draft", "Issued", "PartiallyReceived", "Received", "Billed", "Closed", "Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
                <input type="checkbox" checked={isInterState} onChange={(e) => toggleInterState(e.target.checked)} />
                Inter-state (IGST)
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="doc-from-box">
              <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
                Ordered By <span className="text-slate-400 font-normal">— Your Details</span>
              </h3>
              {settings?.businessName ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{settings.businessName}</p>
                  {settings.address && <p className="text-slate-500">{settings.address}</p>}
                  {(settings.city || settings.state) && (
                    <p className="text-slate-500">{[settings.city, settings.state, settings.country, settings.pincode].filter(Boolean).join(", ")}</p>
                  )}
                  {settings.gstin && <p className="text-slate-500">GSTIN: {settings.gstin}</p>}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400">Configure in <a href="/settings" className="text-indigo-600 underline">Settings</a></p>
              )}
            </div>
            <div className="doc-from-box">
              <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
                Vendor <span className="text-slate-400 font-normal">— Supplier Details</span>
              </h3>
              <select required value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="inp mb-3">
                <option value="">Select a Vendor</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              {selectedVendor ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{selectedVendor.name}</p>
                  {selectedVendor.address && <p className="text-slate-500">{selectedVendor.address}</p>}
                  {selectedVendor.phone && <p className="text-slate-500">Phone: {selectedVendor.phone}</p>}
                  {selectedVendor.email && <p className="text-slate-500">Email: {selectedVendor.email}</p>}
                  {selectedVendor.gstin && <p className="text-slate-500">GSTIN: {selectedVendor.gstin}</p>}
                </div>
              ) : (
                <div className="text-center py-4 text-[13px] text-slate-400">
                  <p>Select a vendor from the list</p>
                  <p className="my-1 text-slate-300">or</p>
                  <a href="/vendors" className="btn btn-outline btn-sm mt-1">+ Add New Vendor</a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-6">
          <LineItemsEditor items={items} onChange={setItems} themeColor={settings?.themeColor} isInterState={isInterState} />

          <div className="flex justify-end mt-6">
            <div className="w-full max-w-xs space-y-2 text-[13px]">
              <div className="flex justify-between text-slate-600"><span>Amount</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−₹{totals.totalDiscount.toFixed(2)}</span></div>
              )}
              {isInterState ? (
                <div className="flex justify-between text-slate-600"><span>IGST</span><span>₹{totals.totalIgst.toFixed(2)}</span></div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600"><span>SGST</span><span>₹{totals.totalSgst.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>CGST</span><span>₹{totals.totalCgst.toFixed(2)}</span></div>
                </>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-dashed border-slate-200">
                <input type="text" value={additionalChargesLabel} onChange={(e) => setAdditionalChargesLabel(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-md px-2 py-1 text-[11.5px] outline-none focus:border-indigo-400" placeholder="Additional Charges" />
                <input type="number" value={additionalCharges} onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                  className="w-24 border border-slate-200 rounded-md px-2 py-1 text-[11.5px] text-right outline-none focus:border-indigo-400" step={0.01} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11.5px] flex-1">Round Off</span>
                <button type="button" onClick={() => setRoundOff(roundTotal(totals.totalAmount - roundOff + additionalCharges, "up"))}
                  className="p-2 text-slate-400 hover:text-emerald-600 transition-colors" title="Round Up"><ArrowUp size={16} /></button>
                <button type="button" onClick={() => setRoundOff(roundTotal(totals.totalAmount - roundOff + additionalCharges, "down"))}
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Round Down"><ArrowDown size={16} /></button>
                <span className="w-24 text-right text-[11.5px]">{roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-[16px] border-t-2 border-slate-200 pt-3 mt-1">
                <span>Total (INR)</span><span className="nums">₹{grandTotal.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-slate-400 italic border-t border-dashed border-slate-200 pt-2">{numberToWords(grandTotal)}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="lbl">Terms & Conditions</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} className="inp" />
            </div>
            <div>
              <label className="lbl">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="inp" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pb-4">
          <button type="submit" disabled={duplicateNo} className="btn btn-primary btn-lg disabled:opacity-50">{editId ? "Update Purchase Order" : "Save Purchase Order"}</button>
          <button type="button" onClick={() => router.push("/purchase-orders")} className="btn btn-outline btn-lg">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function PurchaseOrderNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>}>
      <PurchaseOrderForm />
    </Suspense>
  );
}
