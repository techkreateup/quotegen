"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditNote, Client, Invoice, LineItem, CompanySettings } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { createEmptyLineItem, calculateTotals, calculateLineItem, numberToWords } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import LineItemsEditor from "@/components/LineItemsEditor";
import { format } from "date-fns";
import { Suspense } from "react";
import { currentFyLabel, expandFyTokens } from "@/lib/fy";
import DocNumberField from "@/components/DocNumberField";

function CreditNoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [clients, setClients]         = useState<Client[]>([]);
  const [invoices, setInvoices]       = useState<Invoice[]>([]);
  const [creditNoteNo, setCreditNoteNo] = useState("");
  const [creditNoteDate, setCreditNoteDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [clientId, setClientId]       = useState("");
  const [invoiceId, setInvoiceId]     = useState("");
  const [reason, setReason]           = useState("");
  const [notes, setNotes]             = useState("");
  const [status, setStatus]           = useState<CreditNote["status"]>("Draft");
  const [items, setItems]             = useState<LineItem[]>([createEmptyLineItem()]);
  const [settings, setSettings]       = useState<CompanySettings | null>(null);
  const [existing, setExisting]       = useState<CreditNote[]>([]);

  useEffect(() => {
    async function loadData() {
      const [clientsData, invoicesData, settingsData, existingData] = await Promise.all([
        apiGet<Client[] | { data: Client[] }>("/api/clients"),
        apiGet<Invoice[] | { data: Invoice[] }>("/api/invoices"),
        apiGet<CompanySettings>("/api/settings"),
        apiGet<CreditNote[] | { data: CreditNote[] }>("/api/credit-notes"),
      ]);
      if (clientsData) setClients(Array.isArray(clientsData) ? clientsData : clientsData.data);
      if (invoicesData) setInvoices(Array.isArray(invoicesData) ? invoicesData : invoicesData.data);
      if (settingsData) setSettings(settingsData);
      if (existingData) setExisting(Array.isArray(existingData) ? existingData : existingData.data ?? []);

      if (editId) {
        const cn = await apiGet<CreditNote>(`/api/credit-notes/${editId}`);
        if (cn) {
          setCreditNoteNo(cn.creditNoteNo);
          setCreditNoteDate(cn.creditNoteDate);
          setClientId(cn.clientId);
          setInvoiceId(cn.invoiceId || "");
          setReason(cn.reason);
          setNotes(cn.notes || "");
          setStatus(cn.status as CreditNote["status"]);
          setItems(cn.items?.length ? cn.items : [createEmptyLineItem()]);
        }
      }
    }
    loadData();
  }, [editId]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const isInterState = !!(settings?.state && selectedClient?.state && settings.state.toLowerCase() !== selectedClient.state.toLowerCase());

  function handleClientChange(newClientId: string) {
    setClientId(newClientId);
    const client = clients.find((c) => c.id === newClientId);
    const newIsInterState = !!(settings?.state && client?.state && settings.state.toLowerCase() !== client.state.toLowerCase());
    setItems((prev) => prev.map((item) => calculateLineItem(item, newIsInterState)));
  }

  const totals = calculateTotals(items);

  const previewNo = (() => {
    if (!settings || !clientId) return "";
    const s = settings as CompanySettings & { creditNotePrefix?: string; nextCreditNoteNo?: number };
    const raw = s.creditNotePrefix ?? "CN";
    const num = s.nextCreditNoteNo ?? 1;
    const fy = currentFyLabel(s.fiscalYearStart ?? 4);
    return `${expandFyTokens(raw, fy)}${String(num).padStart(5, "0")}`;
  })();
  const trimmed = creditNoteNo.trim();
  const duplicateNo = !!trimmed && existing.some(c => c.creditNoteNo === trimmed && c.id !== editId);

  async function handleSubmit(e: React.FormEvent) {
    if (duplicateNo) { e.preventDefault(); return; }
    e.preventDefault();
    if (!clientId) return;
    const client = clients.find((c) => c.id === clientId);
    const data = {
      creditNoteNo,
      creditNoteDate,
      clientId,
      clientName: client?.businessName || "",
      invoiceId: invoiceId || null,
      items,
      ...totals,
      reason,
      status,
      notes,
    };
    if (editId) {
      await apiPut(`/api/credit-notes/${editId}`, data);
    } else {
      await apiPost("/api/credit-notes", data);
    }
    router.push("/credit-notes");
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={editId ? "Edit Credit Note" : "Create New Credit Note"}
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Credit Notes", href: "/credit-notes" }, { label: editId ? "Edit" : "New" }]}
      />

      <form onSubmit={handleSubmit} className="space-y-5"
        onKeyDown={(e) => {
          const tag = (e.target as HTMLElement).tagName;
          if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON") e.preventDefault();
        }}>

        {/* Document Header */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Credit Note</h2>
            {settings?.logoUrl
              ? <img src={settings.logoUrl} alt="Logo" className="h-14 max-w-[180px] object-contain shrink-0" />
              : settings?.businessName
                ? <p className="text-xl font-bold shrink-0" style={{ color: settings.themeColor }}>{settings.businessName}</p>
                : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="lbl">Client *</label>
              <select required value={clientId} onChange={(e) => handleClientChange(e.target.value)} className="inp">
                <option value="">Select Client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Against Invoice (optional)</label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="inp">
                <option value="">None</option>
                {invoices.filter((i) => !clientId || i.clientId === clientId).map((i) => (
                  <option key={i.id} value={i.id}>{i.invoiceNo} - ₹{i.totalAmount}</option>
                ))}
              </select>
            </div>
            <DocNumberField label="Credit Note No" value={creditNoteNo} onChange={setCreditNoteNo}
              editing={!!editId} previewNo={previewNo} duplicate={duplicateNo}
              labelKind="credit note number" waitingFor="client" />
            <div>
              <label className="lbl">Credit Note Date *</label>
              <input type="date" required value={creditNoteDate}
                onChange={(e) => setCreditNoteDate(e.target.value)} className="inp" />
            </div>
            <div>
              <label className="lbl">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as CreditNote["status"])} className="inp">
                <option value="Draft">Draft</option>
                <option value="Issued">Issued</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="lbl">Reason *</label>
            <input type="text" required value={reason} onChange={(e) => setReason(e.target.value)}
              className="inp max-w-md" placeholder="e.g. Goods returned, Pricing error" />
          </div>

          {/* From / To */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="doc-from-box">
              <h3 className="text-[12.5px] font-semibold mb-3 pb-2 border-b border-dashed border-slate-200" style={{ color: settings?.themeColor || "var(--primary)" }}>
                From
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
                To
              </h3>
              {selectedClient ? (
                <div className="space-y-1 text-[13px]">
                  <p className="font-semibold text-slate-900">{selectedClient.businessName}</p>
                  {selectedClient.address && <p className="text-slate-500">{selectedClient.address}</p>}
                  {selectedClient.phones?.filter(Boolean).map((ph, i) => <p key={i} className="text-slate-500">Phone: {ph}</p>)}
                  {selectedClient.email && <p className="text-slate-500">Email: {selectedClient.email}</p>}
                </div>
              ) : (
                <div className="text-center py-4 text-[13px] text-slate-400">Select a client above</div>
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

        {/* Notes */}
        <div className="card p-6">
          <div>
            <label className="lbl">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="inp" />
          </div>
        </div>

        <div className="flex items-center gap-3 pb-4">
          <button type="submit" disabled={duplicateNo} className="btn btn-primary btn-lg disabled:opacity-50">
            {editId ? "Update Credit Note" : "Save Credit Note"}
          </button>
          <button type="button" onClick={() => router.push("/credit-notes")} className="btn btn-outline btn-lg">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CreditNoteNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>}>
      <CreditNoteForm />
    </Suspense>
  );
}
