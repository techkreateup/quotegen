"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SalesOrder, Client, LineItem, CompanySettings } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { createEmptyLineItem, calculateTotals, calculateLineItem, numberToWords, roundTotal } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import LineItemsEditor from "@/components/LineItemsEditor";
import { format } from "date-fns";
import { ArrowUp, ArrowDown, Paperclip, X as XIcon } from "lucide-react";
import { uploadFiles } from "@/lib/uploadthing-client";

function SalesOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [clients, setClients] = useState<Client[]>([]);
  const [title, setTitle] = useState("Sales Order");
  const [salesOrderNo, setSalesOrderNo] = useState("");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientPoNumber, setClientPoNumber] = useState("");
  const [clientPoDate, setClientPoDate] = useState("");
  const [clientPoFileUrl, setClientPoFileUrl] = useState("");
  const [items, setItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState<SalesOrder["status"]>("Open");
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [additionalChargesLabel, setAdditionalChargesLabel] = useState("");
  const [roundOff, setRoundOff] = useState(0);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    apiGet<Client[]>("/api/clients").then(setClients);
    apiGet<CompanySettings>("/api/settings").then(setSettings);
    if (editId) {
      apiGet<SalesOrder>(`/api/sales-orders/${editId}`).then((o) => {
        if (o) {
          setTitle(o.title); setSalesOrderNo(o.salesOrderNo); setOrderDate(o.orderDate);
          setDueDate(o.dueDate); setClientId(o.clientId);
          setClientPoNumber(o.clientPoNumber || ""); setClientPoDate(o.clientPoDate || ""); setClientPoFileUrl(o.clientPoFileUrl || "");
          setItems(o.items.length ? o.items : [createEmptyLineItem()]);
          setNotes(o.notes); setTerms(o.termsAndConditions); setStatus(o.status);
          setAdditionalCharges(o.additionalCharges || 0);
          setAdditionalChargesLabel(o.additionalChargesLabel || "");
          setRoundOff(o.roundOff || 0);
        }
      });
    }
  }, [editId]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const isInterState = !!(settings?.state && selectedClient?.state && settings.state.toLowerCase() !== selectedClient.state.toLowerCase());

  function handleClientChange(newClientId: string) {
    setClientId(newClientId);
    const client = clients.find((c) => c.id === newClientId);
    const newIsInterState = !!(settings?.state && client?.state && settings.state.toLowerCase() !== client.state.toLowerCase());
    setItems((prev) => prev.map((item) => calculateLineItem(item, newIsInterState)));
  }

  const totals = calculateTotals(items, additionalCharges, roundOff);
  const grandTotal = totals.totalAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      title, orderDate, dueDate, clientId,
      clientPoNumber, clientPoDate, clientPoFileUrl,
      items, ...totals, additionalCharges, additionalChargesLabel, roundOff,
      status, notes, termsAndConditions: terms,
    };
    if (editId) await apiPut(`/api/sales-orders/${editId}`, { ...data, salesOrderNo });
    else await apiPost("/api/sales-orders", data);
    router.push("/sales-orders");
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={editId ? "Edit Sales Order" : "Create New Sales Order"}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Sales Orders", href: "/sales-orders" }, { label: editId ? "Edit" : "New" }]}
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
              ? <img src={settings.logoUrl} alt="Logo" className="h-14 max-w-[180px] object-contain shrink-0" />
              : settings?.businessName
                ? <p className="text-xl font-bold shrink-0" style={{ color: settings.themeColor }}>{settings.businessName}</p>
                : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="lbl">Sales Order No {!editId && <span className="text-slate-400 font-normal">(auto if blank)</span>}</label>
              <input type="text" value={salesOrderNo} onChange={(e) => setSalesOrderNo(e.target.value)} className="inp font-mono" placeholder={editId ? "" : "auto-generated"} />
            </div>
            <div>
              <label className="lbl">Order Date *</label>
              <input type="date" required value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="inp" />
            </div>
            <div>
              <label className="lbl">Due / Delivery Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="inp" />
            </div>
            {editId && (
              <div>
                <label className="lbl">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as SalesOrder["status"])} className="inp">
                  {["Draft", "Open", "PartiallyDelivered", "Delivered", "Invoiced", "Closed", "Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Client PO capture (D2) — the buyer's purchase order confirming this order */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 mb-6">
            <h3 className="text-[12.5px] font-semibold text-slate-700 mb-3">Client Purchase Order <span className="text-slate-400 font-normal">— the PO your client issued (optional)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="lbl">Client PO Number</label>
                <input type="text" value={clientPoNumber} onChange={(e) => setClientPoNumber(e.target.value)} className="inp" placeholder="e.g. PO-2026-118" />
              </div>
              <div>
                <label className="lbl">Client PO Date</label>
                <input type="date" value={clientPoDate} onChange={(e) => setClientPoDate(e.target.value)} className="inp" />
              </div>
              <div>
                <label className="lbl">PO Document</label>
                {clientPoFileUrl ? (
                  <div className="flex items-center gap-2 h-10 px-2.5 border border-slate-200 rounded-md bg-slate-50">
                    <Paperclip size={13} className="text-indigo-500 shrink-0" />
                    <a href={clientPoFileUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-[12.5px] text-indigo-600 hover:underline truncate">{clientPoFileUrl.split("/").pop() || "Attached file"}</a>
                    <button type="button" onClick={() => setClientPoFileUrl("")} className="text-slate-400 hover:text-rose-600 shrink-0" aria-label="Remove file"><XIcon size={13} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="url" value={clientPoFileUrl} onChange={(e) => setClientPoFileUrl(e.target.value)} className="inp flex-1" placeholder="https://… or upload →" />
                    <label className="btn btn-sm cursor-pointer shrink-0">
                      <Paperclip size={13} /> Upload
                      <input type="file" className="hidden" accept="application/pdf,image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          try {
                            const res = await uploadFiles("document", { files: [f], input: { category: "Other" as never, description: `Client PO for SO ${salesOrderNo || "draft"}` } });
                            const url = res?.[0]?.ufsUrl || res?.[0]?.url;
                            if (url) setClientPoFileUrl(url);
                          } catch { /* toast handled globally */ }
                        }} />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="doc-from-box">
              <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
                Order From <span className="text-slate-400 font-normal">— Your Details</span>
              </h3>
              {settings?.businessName ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{settings.businessName}</p>
                  {settings.address && <p className="text-slate-500">{settings.address}</p>}
                  {(settings.city || settings.state) && (
                    <p className="text-slate-500">{[settings.city, settings.state, settings.country, settings.pincode].filter(Boolean).join(", ")}</p>
                  )}
                  {settings.gstin && <p className="text-slate-500">GSTIN: {settings.gstin}</p>}
                  {settings.email && <p className="text-slate-500">Email: {settings.email}</p>}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400">Configure in <a href="/settings" className="text-indigo-600 underline">Settings</a></p>
              )}
            </div>
            <div className="doc-from-box">
              <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
                Order For <span className="text-slate-400 font-normal">— Client&apos;s Details</span>
              </h3>
              <select required value={clientId} onChange={(e) => handleClientChange(e.target.value)} className="inp mb-3">
                <option value="">Select a Client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
              {selectedClient ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{selectedClient.businessName}</p>
                  {selectedClient.address && <p className="text-slate-500">{selectedClient.address}</p>}
                  {selectedClient.email && <p className="text-slate-500">Email: {selectedClient.email}</p>}
                  {selectedClient.gstin && <p className="text-slate-500">GSTIN: {selectedClient.gstin}</p>}
                </div>
              ) : (
                <div className="text-center py-4 text-[13px] text-slate-400">
                  <p>Select a client from the list</p>
                  <p className="my-1 text-slate-300">or</p>
                  <a href="/clients" className="btn btn-outline btn-sm mt-1">+ Add New Client</a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card p-6">
          <LineItemsEditor items={items} onChange={setItems} themeColor={settings?.themeColor} isInterState={isInterState} />
          {isInterState && <p className="text-[11px] text-amber-600 font-medium mt-2">Inter-state supply detected - IGST applicable</p>}

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
          <button type="submit" className="btn btn-primary btn-lg">{editId ? "Update Sales Order" : "Save Sales Order"}</button>
          <button type="button" onClick={() => router.push("/sales-orders")} className="btn btn-outline btn-lg">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function SalesOrderNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>}>
      <SalesOrderForm />
    </Suspense>
  );
}
