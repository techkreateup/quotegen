"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DeliveryChallan, Client, LineItem, CompanySettings } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { createEmptyLineItem, calculateTotals, calculateLineItem, numberToWords, roundTotal } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import LineItemsEditor from "@/components/LineItemsEditor";
import { format } from "date-fns";
import { ArrowUp, ArrowDown } from "lucide-react";

const CHALLAN_TYPES = ["Delivery", "Returnable", "Sample", "JobWork"];

function DeliveryChallanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [clients, setClients] = useState<Client[]>([]);
  const [title, setTitle] = useState("Delivery Challan");
  const [challanNo, setChallanNo] = useState("");
  const [challanDate, setChallanDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [clientId, setClientId] = useState("");
  const [challanType, setChallanType] = useState("Delivery");
  const [vehicleNo, setVehicleNo] = useState("");
  const [items, setItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState<DeliveryChallan["status"]>("Draft");
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [additionalChargesLabel, setAdditionalChargesLabel] = useState("");
  const [roundOff, setRoundOff] = useState(0);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    apiGet<Client[]>("/api/clients").then(setClients);
    apiGet<CompanySettings>("/api/settings").then(setSettings);
    if (editId) {
      apiGet<DeliveryChallan>(`/api/delivery-challans/${editId}`).then((c) => {
        if (c) {
          setTitle(c.title); setChallanNo(c.challanNo); setChallanDate(c.challanDate); setClientId(c.clientId);
          setChallanType(c.challanType || "Delivery"); setVehicleNo(c.vehicleNo || "");
          setItems(c.items.length ? c.items : [createEmptyLineItem()]);
          setNotes(c.notes); setTerms(c.termsAndConditions); setStatus(c.status);
          setAdditionalCharges(c.additionalCharges || 0);
          setAdditionalChargesLabel(c.additionalChargesLabel || "");
          setRoundOff(c.roundOff || 0);
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
      title, challanDate, clientId, challanType, vehicleNo,
      items, ...totals, additionalCharges, additionalChargesLabel, roundOff,
      status, notes, termsAndConditions: terms,
    };
    if (editId) await apiPut(`/api/delivery-challans/${editId}`, { ...data, challanNo });
    else await apiPost("/api/delivery-challans", data);
    router.push("/delivery-challans");
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={editId ? "Edit Delivery Challan" : "Create New Delivery Challan"}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Delivery Challans", href: "/delivery-challans" }, { label: editId ? "Edit" : "New" }]}
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
            {editId && (
              <div>
                <label className="lbl">Challan No</label>
                <input type="text" value={challanNo} onChange={(e) => setChallanNo(e.target.value)} className="inp font-mono" />
              </div>
            )}
            <div>
              <label className="lbl">Challan Date *</label>
              <input type="date" required value={challanDate} onChange={(e) => setChallanDate(e.target.value)} className="inp" />
            </div>
            <div>
              <label className="lbl">Challan Type</label>
              <select value={challanType} onChange={(e) => setChallanType(e.target.value)} className="inp">
                {CHALLAN_TYPES.map(t => <option key={t} value={t}>{t === "JobWork" ? "Job Work" : t}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Vehicle No</label>
              <input type="text" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className="inp" placeholder="e.g. TN09 AB 1234" />
            </div>
            {editId && (
              <div>
                <label className="lbl">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as DeliveryChallan["status"])} className="inp">
                  {["Draft", "Issued", "Delivered", "Invoiced", "Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="doc-from-box">
              <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
                Dispatched From <span className="text-slate-400 font-normal">— Your Details</span>
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
                Ship To <span className="text-slate-400 font-normal">— Client&apos;s Details</span>
              </h3>
              <select required value={clientId} onChange={(e) => handleClientChange(e.target.value)} className="inp mb-3">
                <option value="">Select a Client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
              {selectedClient ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{selectedClient.businessName}</p>
                  {selectedClient.address && <p className="text-slate-500">{selectedClient.address}</p>}
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
                <span>Total Value (INR)</span><span className="nums">₹{grandTotal.toFixed(2)}</span>
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
          <button type="submit" className="btn btn-primary btn-lg">{editId ? "Update Challan" : "Save Challan"}</button>
          <button type="button" onClick={() => router.push("/delivery-challans")} className="btn btn-outline btn-lg">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function DeliveryChallanNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>}>
      <DeliveryChallanForm />
    </Suspense>
  );
}
