"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Invoice, Client, LineItem, Quotation, CompanySettings } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { createEmptyLineItem, calculateTotals, calculateLineItem, numberToWords, roundTotal } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import LineItemsEditor from "@/components/LineItemsEditor";
import { format } from "date-fns";
import { Suspense } from "react";
import { ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { currentFyLabel, expandFyTokens } from "@/lib/fy";

function InvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const fromQuotation = searchParams.get("from_quotation");

  const [clients, setClients]                             = useState<Client[]>([]);
  const [quotations, setQuotations]                       = useState<Quotation[]>([]);
  const [invoices, setInvoices]                           = useState<Invoice[]>([]);
  const [title, setTitle]                                 = useState("Invoice");
  const [invoiceNo, setInvoiceNo]                         = useState("");
  const [invoiceDate, setInvoiceDate]                     = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate]                             = useState("");
  const [clientId, setClientId]                           = useState("");
  const [quotationId, setQuotationId]                     = useState("");
  const [items, setItems]                                 = useState<LineItem[]>([createEmptyLineItem()]);
  const [notes, setNotes]                                 = useState("");
  const [terms, setTerms]                                 = useState("");
  const [status, setStatus]                               = useState<Invoice["status"]>("Unpaid");
  const [paymentDate, setPaymentDate]                     = useState("");
  const [additionalCharges, setAdditionalCharges]         = useState(0);
  const [additionalChargesLabel, setAdditionalChargesLabel] = useState("");
  const [roundOff, setRoundOff]                           = useState(0);
  const [settings, setSettings]                           = useState<CompanySettings | null>(null);

  useEffect(() => {
    async function loadData() {
      const [clientsData, quotationsData, settingsData, invoicesData] = await Promise.all([
        apiGet<Client[]>("/api/clients"),
        apiGet<Quotation[]>("/api/quotations"),
        apiGet<CompanySettings>("/api/settings"),
        apiGet<Invoice[]>("/api/invoices"),
      ]);
      if (clientsData) setClients(clientsData);
      if (quotationsData) setQuotations(quotationsData);
      if (settingsData) setSettings(settingsData);
      if (invoicesData) setInvoices(invoicesData);

      if (editId) {
        const inv = await apiGet<Invoice>(`/api/invoices/${editId}`);
        if (inv) {
          setTitle(inv.title); setInvoiceNo(inv.invoiceNo); setInvoiceDate(inv.invoiceDate);
          setDueDate(inv.dueDate); setClientId(inv.clientId); setQuotationId(inv.quotationId);
          setItems(inv.items.length ? inv.items : [createEmptyLineItem()]);
          setNotes(inv.notes); setTerms(inv.termsAndConditions);
          setStatus(inv.status as Invoice["status"]);
          setPaymentDate(inv.paymentDate); setAdditionalCharges(inv.additionalCharges || 0);
          setAdditionalChargesLabel(inv.additionalChargesLabel || ""); setRoundOff(inv.roundOff || 0);
        }
      }
      if (fromQuotation) {
        const allQuotations = quotationsData || [];
        const q = allQuotations.find((qt) => qt.id === fromQuotation);
        if (q) {
          // Recompute line items so amounts/taxes are correct for the invoice —
          // calculateTotals sums each item's computed `amount`, so copying raw
          // items would otherwise yield a ₹0 total.
          const cl = (clientsData || []).find((c) => c.id === q.clientId);
          const inter = !!(settingsData?.state && cl?.state && settingsData.state.toLowerCase() !== cl.state.toLowerCase());
          setClientId(q.clientId); setItems((q.items || []).map((it) => calculateLineItem(it, inter))); setNotes(q.notes);
          setTerms(q.termsAndConditions); setQuotationId(fromQuotation);
          setTitle(`Invoice - ${q.title}`); setAdditionalCharges(q.additionalCharges || 0);
          setAdditionalChargesLabel(q.additionalChargesLabel || ""); setRoundOff(q.roundOff || 0);
        }
      }
    }
    loadData();
  }, [editId, fromQuotation]);

  function handleConvertFromQuotation(qId: string) {
    const q = quotations.find((qt) => qt.id === qId);
    if (!q) return;
    const cl = clients.find((c) => c.id === q.clientId);
    const inter = !!(settings?.state && cl?.state && settings.state.toLowerCase() !== cl.state.toLowerCase());
    setClientId(q.clientId); setItems((q.items || []).map((it) => calculateLineItem(it, inter))); setNotes(q.notes);
    setTerms(q.termsAndConditions); setQuotationId(qId); setTitle(`Invoice - ${q.title}`);
    setAdditionalCharges(q.additionalCharges || 0); setRoundOff(q.roundOff || 0);
  }

  const selectedClient = clients.find((c) => c.id === clientId);
  const isInterState = !!(settings?.state && selectedClient?.state && settings.state.toLowerCase() !== selectedClient.state.toLowerCase());

  function handleClientChange(newClientId: string) {
    setClientId(newClientId);
    const client = clients.find((c) => c.id === newClientId);
    const newIsInterState = !!(settings?.state && client?.state && settings.state.toLowerCase() !== client.state.toLowerCase());
    setItems((prev) => prev.map((item) => calculateLineItem(item, newIsInterState)));
  }

  const totals = calculateTotals(items, additionalCharges, roundOff);

  // Preview of the next auto-issued invoice number, mirroring the server's
  // series-picking logic in /api/invoices POST: when separateGstInvoices is on
  // and the SELECTED client has no GSTIN, we use the non-GST series. Only
  // shown once a client is picked so the preview stays accurate.
  const previewNo = (() => {
    if (!settings || !clientId) return "";
    const s = settings as CompanySettings & { invoicePrefix?: string; nextInvoiceNo?: number; nonGstInvoicePrefix?: string; nextNonGstInvoiceNo?: number; separateGstInvoices?: boolean };
    const client = clients.find(c => c.id === clientId);
    const nonGst = !!s.separateGstInvoices && !client?.gstin?.trim();
    const raw = nonGst ? (s.nonGstInvoicePrefix ?? "NGI") : (s.invoicePrefix ?? "INV");
    const num = nonGst ? (s.nextNonGstInvoiceNo ?? 1) : (s.nextInvoiceNo ?? 1);
    const fy = currentFyLabel(s.fiscalYearStart ?? 4);
    return `${expandFyTokens(raw, fy)}${String(num).padStart(5, "0")}`;
  })();
  const previewSeriesLabel = (() => {
    const s = settings as (CompanySettings & { separateGstInvoices?: boolean }) | null;
    if (!s?.separateGstInvoices || !clientId) return "";
    const client = clients.find(c => c.id === clientId);
    return client?.gstin?.trim() ? "GST series" : "Non-GST series";
  })();

  // Duplicate check — a fresh invoice may not reuse an existing number, and
  // editing may not clash with any OTHER invoice. Runs against the list we
  // already fetched; the server enforces the same rule (P2002 → 409) as backup.
  const invNoTrimmed = invoiceNo.trim();
  const duplicateNo = !!invNoTrimmed && invoices.some(i => i.invoiceNo === invNoTrimmed && i.id !== editId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (duplicateNo) return;
    const client = clients.find((c) => c.id === clientId);
    const data = {
      title, invoiceDate, dueDate, clientId, clientName: client?.businessName || "",
      items, ...totals, additionalCharges, additionalChargesLabel, roundOff,
      status, paymentDate, quotationId, notes, termsAndConditions: terms,
    };
    const apiData = { ...data };
    if (editId) {
      await apiPut(`/api/invoices/${editId}`, { ...apiData, invoiceNo });
    } else {
      await apiPost("/api/invoices", { ...apiData, invoiceNo: invoiceNo || "" });
    }
    router.push("/invoices");
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={editId ? "Edit Invoice" : "Create New Invoice"}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Invoices", href: "/invoices" }, { label: editId ? "Edit" : "New" }]}
      />

      <form onSubmit={handleSubmit} className="space-y-5"
        onKeyDown={(e) => {
          const tag = (e.target as HTMLElement).tagName;
          if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON") e.preventDefault();
        }}>

        {/* Convert from Quotation */}
        {!editId && quotations.length > 0 && (
          <div className="card p-4">
            <label className="lbl">Convert from Quotation (optional)</label>
            <select value={quotationId} onChange={(e) => handleConvertFromQuotation(e.target.value)}
              className="inp max-w-md">
              <option value="">Select Quotation</option>
              {quotations
                .filter((q) => (q.status === "Won" || q.status === "Created"))
                .filter((q) => !invoices.some((inv) => inv.quotationId === q.id) || q.id === quotationId)
                .map((q) => (
                <option key={q.id} value={q.id}>{q.quotationNo} — {q.clientName} (₹{q.totalAmount})</option>
              ))}
            </select>
          </div>
        )}

        {/* Document Header */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-bold border-b-2 border-dashed border-slate-200 focus:border-indigo-400 pb-1 bg-transparent outline-none min-w-0"
              placeholder="Title"
            />
            {settings?.logoUrl
              ? <img src={settings.logoUrl} alt="Logo" className="h-14 max-w-[180px] object-contain shrink-0" />
              : settings?.businessName
                ? <p className="text-xl font-bold shrink-0" style={{ color: settings.themeColor }}>{settings.businessName}</p>
                : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="lbl">Invoice No</label>
              <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                className={`inp font-mono${duplicateNo ? " !border-red-400 !ring-red-100" : ""}`}
                placeholder={editId ? "" : (previewNo || (clientId ? "auto" : "select client first"))} />
              {duplicateNo ? (
                <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1"><AlertTriangle size={11} /> This invoice number is already in use. Pick another.</p>
              ) : !editId && !invoiceNo && previewNo ? (
                <p className="text-[11px] text-slate-400 mt-1">
                  Auto-issue as <button type="button" onClick={() => setInvoiceNo(previewNo)} className="font-mono text-indigo-600 hover:underline">{previewNo}</button>{previewSeriesLabel && <span className="ml-1">· {previewSeriesLabel}</span>}
                </p>
              ) : !editId && !clientId ? (
                <p className="text-[11px] text-slate-400 mt-1">Pick a client to preview the number, or type your own.</p>
              ) : null}
            </div>
            <div>
              <label className="lbl">Invoice Date *</label>
              <input type="date" required value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)} className="inp" />
            </div>
            <div>
              <label className="lbl">Due Date</label>
              <input type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} className="inp" />
            </div>
            <div>
              <label className="lbl">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Invoice["status"])} className="inp">
                <option value="Draft">Draft</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
                <option value="PartiallyPaid">Partially Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="lbl">Payment Date</label>
              <input type="date" value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)} className="inp" />
            </div>
          </div>

          {/* Billed By / Billed To */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="doc-from-box">
              <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
                Billed By
              </h3>
              {settings?.businessName ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{settings.businessName}</p>
                  {settings.address && <p className="text-slate-500">{settings.address}</p>}
                  {settings.gstin && <p className="text-slate-500">GSTIN: {settings.gstin}</p>}
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
                Billed To
              </h3>
              <select required value={clientId} onChange={(e) => handleClientChange(e.target.value)} className="inp mb-3">
                <option value="">Select Client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
              {selectedClient ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{selectedClient.businessName}</p>
                  {selectedClient.address && <p className="text-slate-500">{selectedClient.address}</p>}
                  {selectedClient.phones?.filter(Boolean).map((ph, i) => <p key={i} className="text-slate-500">Phone: {ph}</p>)}
                  {selectedClient.email && <p className="text-slate-500">Email: {selectedClient.email}</p>}
                </div>
              ) : (
                <div className="text-center py-4 text-[13px] text-slate-400">Select a client</div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="card p-6">
          <LineItemsEditor items={items} onChange={setItems} themeColor={settings?.themeColor} isInterState={isInterState} />
          {isInterState && (
            <p className="text-[11px] text-amber-600 font-medium mt-2">Inter-state supply detected - IGST applicable</p>
          )}
          <div className="flex justify-end mt-6">
            <div className="w-full max-w-xs space-y-2 text-[13px]">
              <div className="flex justify-between text-slate-600">
                <span>Amount</span><span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span><span>−₹{totals.totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {isInterState ? (
                <div className="flex justify-between text-slate-600">
                  <span>IGST</span><span>₹{totals.totalIgst.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST</span><span>₹{totals.totalSgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST</span><span>₹{totals.totalCgst.toFixed(2)}</span>
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
                <button type="button" onClick={() => setRoundOff(roundTotal(totals.totalAmount - roundOff, "up"))}
                  className="p-2 text-slate-400 hover:text-emerald-600 transition-colors" title="Round Up">
                  <ArrowUp size={16} />
                </button>
                <button type="button" onClick={() => setRoundOff(roundTotal(totals.totalAmount - roundOff, "down"))}
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Round Down">
                  <ArrowDown size={16} />
                </button>
                <span className="w-24 text-right text-[11.5px]">{roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-bold text-[16px] border-t-2 border-slate-200 pt-3 mt-1">
                <span>Total (INR)</span>
                <span className="nums">₹{totals.totalAmount.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-slate-400 italic border-t border-dashed border-slate-200 pt-2">
                {numberToWords(totals.totalAmount)}
              </p>
            </div>
          </div>
        </div>

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

        <div className="flex items-center gap-3 pb-4">
          <button type="submit" disabled={duplicateNo} className="btn btn-primary btn-lg disabled:opacity-50">
            {editId ? "Update Invoice" : "Save & Continue"}
          </button>
          <button type="button" onClick={() => router.push("/invoices")} className="btn btn-outline btn-lg">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function InvoiceNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>}>
      <InvoiceForm />
    </Suspense>
  );
}
