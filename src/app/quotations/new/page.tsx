"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Quotation, Client, LineItem, CompanySettings } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { createEmptyLineItem, calculateTotals, calculateLineItem, numberToWords, roundTotal, currencySymbol } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import LineItemsEditor from "@/components/LineItemsEditor";
import { format } from "date-fns";
import { Suspense } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { currentFyLabel, expandFyTokens } from "@/lib/fy";
import DocNumberField from "@/components/DocNumberField";

function QuotationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const isProformaParam = searchParams.get("docType") === "Proforma";

  const [clients, setClients]                             = useState<Client[]>([]);
  const [docType, setDocType]                             = useState(isProformaParam ? "Proforma" : "Quotation");
  const [title, setTitle]                                 = useState(isProformaParam ? "Proforma Invoice" : "Quotation");
  const [quotationNo, setQuotationNo]                     = useState("");
  const [quotationDate, setQuotationDate]                 = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate]                             = useState("");
  const [clientId, setClientId]                           = useState("");
  const [items, setItems]                                 = useState<LineItem[]>([createEmptyLineItem()]);
  const [notes, setNotes]                                 = useState("");
  const [terms, setTerms]                                 = useState("");
  const [status, setStatus]                               = useState<Quotation["status"]>("Created");
  const [additionalCharges, setAdditionalCharges]         = useState(0);
  const [additionalChargesLabel, setAdditionalChargesLabel] = useState("");
  const [roundOff, setRoundOff]                           = useState(0);
  const [settings, setSettings]                           = useState<CompanySettings | null>(null);
  const [existing, setExisting]                           = useState<Quotation[]>([]);

  useEffect(() => {
    apiGet<Client[]>("/api/clients").then(setClients);
    apiGet<CompanySettings>("/api/settings").then(setSettings);
    apiGet<Quotation[]>("/api/quotations").then(d => setExisting(Array.isArray(d) ? d : (d as { data?: Quotation[] })?.data ?? []));
    if (editId) {
      apiGet<Quotation>(`/api/quotations/${editId}`).then((q) => {
        if (q) {
          setDocType(q.docType || "Quotation");
          setTitle(q.title); setQuotationNo(q.quotationNo); setQuotationDate(q.quotationDate);
          setDueDate(q.dueDate); setClientId(q.clientId);
          setItems(q.items.length ? q.items : [createEmptyLineItem()]);
          setNotes(q.notes); setTerms(q.termsAndConditions); setStatus(q.status);
          setAdditionalCharges(q.additionalCharges || 0);
          setAdditionalChargesLabel(q.additionalChargesLabel || "");
          setRoundOff(q.roundOff || 0);
        }
      });
    }
  }, [editId]);

  const selectedClient = clients.find((c) => c.id === clientId);
  // Foreign client → export supply: zero-rated under LUT, quoted in the client's currency.
  const isExport = !!(selectedClient?.country && selectedClient.country.trim().toLowerCase() !== "india");
  const isInterState = !isExport && !!(settings?.state && selectedClient?.state && settings.state.toLowerCase() !== selectedClient.state.toLowerCase());

  // Recalculate items when inter-state / export changes
  function handleClientChange(newClientId: string) {
    setClientId(newClientId);
    const client = clients.find((c) => c.id === newClientId);
    const newIsExport = !!(client?.country && client.country.trim().toLowerCase() !== "india");
    const newIsInterState = !newIsExport && !!(settings?.state && client?.state && settings.state.toLowerCase() !== client.state.toLowerCase());
    setItems((prev) => prev.map((item) => calculateLineItem(item, newIsInterState, newIsExport)));
  }

  const totals = calculateTotals(items, additionalCharges, roundOff);
  const grandTotal = totals.totalAmount;
  const curSym = currencySymbol(selectedClient?.currency);

  const previewNo = (() => {
    if (!settings || !clientId) return "";
    const s = settings as CompanySettings & { quotationPrefix?: string; nextQuotationNo?: number; proformaPrefix?: string; nextProformaNo?: number };
    const raw = docType === "Proforma" ? (s.proformaPrefix ?? "PI") : (s.quotationPrefix ?? "Q");
    const num = docType === "Proforma" ? (s.nextProformaNo ?? 1) : (s.nextQuotationNo ?? 1);
    const fy = currentFyLabel(s.fiscalYearStart ?? 4);
    return `${expandFyTokens(raw, fy)}${String(num).padStart(5, "0")}`;
  })();
  const trimmed = quotationNo.trim();
  const duplicateNo = !!trimmed && existing.some(q => q.quotationNo === trimmed && q.id !== editId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (duplicateNo) return;
    const data = {
      title, docType, quotationDate, dueDate, clientId,
      items, ...totals, additionalCharges, additionalChargesLabel, roundOff,
      status, notes, termsAndConditions: terms,
    };
    if (editId) {
      await apiPut(`/api/quotations/${editId}`, { ...data, quotationNo });
    } else {
      await apiPost("/api/quotations", data);
    }
    router.push("/quotations");
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={`${editId ? "Edit" : "Create New"} ${docType === "Proforma" ? "Proforma Invoice" : "Quotation"}`}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Quotations", href: "/quotations" }, { label: editId ? "Edit" : "New" }]}
      />

      <form onSubmit={handleSubmit} className="space-y-5"
        onKeyDown={(e) => {
          const tag = (e.target as HTMLElement).tagName;
          if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON") e.preventDefault();
        }}>

        {/* Document Header */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold border-b-2 border-dashed border-slate-200 focus:border-indigo-400 pb-1 bg-transparent outline-none min-w-0"
              placeholder="Title"
            />
            {settings?.logoUrl
              ? <img src={settings.logoUrl} alt="Logo" className="h-14 max-w-[180px] object-contain shrink-0 bg-white p-1 rounded" />
              : settings?.businessName
                ? <p className="text-xl font-bold shrink-0" style={{ color: settings.themeColor }}>{settings.businessName}</p>
                : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {!editId && (
              <div>
                <label className="lbl">Document Type</label>
                <select value={docType} onChange={(e) => {
                  const dt = e.target.value;
                  setDocType(dt);
                  if (title === "Quotation" || title === "Proforma Invoice") setTitle(dt === "Proforma" ? "Proforma Invoice" : "Quotation");
                }} className="inp">
                  <option value="Quotation">Quotation</option>
                  <option value="Proforma">Proforma Invoice</option>
                </select>
              </div>
            )}
            <DocNumberField label={docType === "Proforma" ? "Proforma No" : "Quotation No"}
              value={quotationNo} onChange={setQuotationNo} editing={!!editId}
              previewNo={previewNo} duplicate={duplicateNo}
              labelKind={docType === "Proforma" ? "proforma number" : "quotation number"} waitingFor="client" />
            <div>
              <label className="lbl">Quotation Date *</label>
              <input type="date" required value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)} className="inp" />
            </div>
            <div>
              <label className="lbl">Due Date</label>
              <input type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} className="inp" />
            </div>
            {editId && (
              <div>
                <label className="lbl">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as Quotation["status"])} className="inp">
                  <option value="Draft">Draft</option>
                  <option value="Created">Created</option>
                  <option value="Sent">Sent</option>
                  <option value="Won">Won</option>
                  <option value="Lost">Lost</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>

          {/* From / To */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="doc-from-box">
              <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
                Quotation From <span className="text-slate-400 font-normal">— Your Details</span>
              </h3>
              {settings?.businessName ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{settings.businessName}</p>
                  {settings.address && <p className="text-slate-500">{settings.address}</p>}
                  {(settings.city || settings.state) && (
                    <p className="text-slate-500">{[settings.city, settings.state, settings.country, settings.pincode].filter(Boolean).join(", ")}</p>
                  )}
                  {settings.gstin && <p className="text-slate-500">GSTIN: {settings.gstin}</p>}
                  {settings.pan && <p className="text-slate-500">PAN: {settings.pan}</p>}
                  {settings.email && <p className="text-slate-500">Email: {settings.email}</p>}
                  {settings.phones?.filter(Boolean).map((ph, i) => <p key={i} className="text-slate-500">Phone: {ph}</p>)}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400">
                  Configure in <a href="/settings" className="text-indigo-600 underline">Settings</a>
                </p>
              )}
            </div>
            <div className="doc-from-box">
              <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
                Quotation For <span className="text-slate-400 font-normal">— Client&apos;s Details</span>
              </h3>
              <select required value={clientId} onChange={(e) => handleClientChange(e.target.value)} className="inp mb-3">
                <option value="">Select a Client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
              {selectedClient ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{selectedClient.businessName}</p>
                  {selectedClient.address && <p className="text-slate-500">{selectedClient.address}</p>}
                  {selectedClient.phones?.filter(Boolean).map((ph, i) => <p key={i} className="text-slate-500">Phone: {ph}</p>)}
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

        {/* Line Items */}
        <div className="card p-6">
          <LineItemsEditor items={items} onChange={setItems} themeColor={settings?.themeColor} isInterState={isInterState} zeroTax={isExport} />
          {isInterState && (
            <p className="text-[11px] text-amber-600 font-medium mt-2">Inter-state supply detected - IGST applicable</p>
          )}
          {isExport && (
            <p className="text-[11px] text-blue-600 font-medium mt-2">
              Export supply ({selectedClient?.country}) — zero-rated under LUT, no GST. Amounts in {selectedClient?.currency || "client currency"}.
            </p>
          )}

          <div className="flex justify-end mt-6">
            <div className="w-full max-w-xs space-y-2 text-[13px]">
              <div className="flex justify-between text-slate-600">
                <span>Amount</span><span>{curSym}{totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span><span>−{curSym}{totals.totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {isInterState ? (
                <div className="flex justify-between text-slate-600">
                  <span>IGST</span><span>{curSym}{totals.totalIgst.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST</span><span>{curSym}{totals.totalSgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST</span><span>{curSym}{totals.totalCgst.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-dashed border-slate-200">
                <input type="text" value={additionalChargesLabel}
                  onChange={(e) => setAdditionalChargesLabel(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-md px-2 py-1 text-[11.5px] outline-none focus:border-indigo-400"
                  placeholder="Additional Charges" />
                <input type="number" value={additionalCharges}
                  onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                  className="w-24 border border-slate-200 rounded-md px-2 py-1 text-[11.5px] text-right outline-none focus:border-indigo-400"
                  step={0.01} />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11.5px] flex-1">Round Off</span>
                <button type="button" onClick={() => setRoundOff(roundTotal(totals.totalAmount - roundOff + additionalCharges, "up"))}
                  className="p-2 text-slate-400 hover:text-emerald-600 transition-colors" title="Round Up">
                  <ArrowUp size={16} />
                </button>
                <button type="button" onClick={() => setRoundOff(roundTotal(totals.totalAmount - roundOff + additionalCharges, "down"))}
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Round Down">
                  <ArrowDown size={16} />
                </button>
                <span className="w-24 text-right text-[11.5px]">{roundOff >= 0 ? "+" : ""}{curSym}{roundOff.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-bold text-[16px] border-t-2 border-slate-200 pt-3 mt-1">
                <span>Total (INR)</span>
                <span className="nums">{curSym}{grandTotal.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-slate-400 italic border-t border-dashed border-slate-200 pt-2">
                {numberToWords(grandTotal, selectedClient?.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Decision Advisor (Phase 3) is on hold — card removed per request. */}

        {/* Notes & Terms */}
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

        {settings?.email && (
          <div className="card p-4">
            <p className="text-[12.5px] font-semibold text-slate-700 mb-1">Contact Details</p>
            <p className="text-[12.5px] text-slate-500">
              {settings.contactFooter || `For any enquiry, reach out via email at ${settings.email}${settings.phones?.[0] ? ` or call ${settings.phones[0]}` : ""}`}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 pb-4">
          <button type="submit" disabled={duplicateNo} className="btn btn-primary btn-lg disabled:opacity-50">
            {editId ? `Update ${docType === "Proforma" ? "Proforma Invoice" : "Quotation"}` : "Save & Continue"}
          </button>
          <button type="button" onClick={() => router.push("/quotations")} className="btn btn-outline btn-lg">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function QuotationNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>}>
      <QuotationForm />
    </Suspense>
  );
}
