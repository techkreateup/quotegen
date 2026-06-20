"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RecurringInvoice, Client, LineItem, CompanySettings } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { createEmptyLineItem, calculateLineItem, calculateTotals, numberToWords } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import LineItemsEditor from "@/components/LineItemsEditor";
import { Suspense } from "react";
import Link from "next/link";

function RecurringInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("Recurring Invoice");
  const [frequency, setFrequency] = useState<RecurringInvoice["frequency"]>("Monthly");
  const [nextDueDate, setNextDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [cl, s] = await Promise.all([
        apiGet<Client[] | { data: Client[] }>("/api/clients"),
        apiGet<CompanySettings>("/api/settings"),
      ]);
      setClients(Array.isArray(cl) ? cl : cl.data);
      if (s) setSettings(s);

      if (editId) {
        const rec = await apiGet<RecurringInvoice>(`/api/recurring-invoices/${editId}`);
        if (rec) {
          setClientId(rec.clientId);
          setTitle(rec.title);
          setFrequency(rec.frequency);
          setNextDueDate(rec.nextDueDate);
          const recItems = rec.items as LineItem[] | null;
          setItems(recItems && recItems.length > 0 ? recItems : [createEmptyLineItem()]);
          setNotes(rec.notes);
          setTerms(rec.termsAndConditions);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const calculatedItems = items.map((item) => calculateLineItem(item, isInterState));
      const t = calculateTotals(calculatedItems);
      const data = {
        clientId, title, frequency, nextDueDate,
        items: calculatedItems, subtotal: t.subtotal, totalAmount: t.totalAmount,
        notes, termsAndConditions: terms,
      };
      if (editId) {
        await apiPut(`/api/recurring-invoices/${editId}`, data);
      } else {
        await apiPost("/api/recurring-invoices", data);
      }
      router.push("/recurring-invoices");
    } catch (err) {
      console.error("Failed to save recurring invoice:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={editId ? "Edit Recurring Invoice" : "New Recurring Invoice"}
        breadcrumbs={[
          { label: "Sales & Invoices" },
          { label: "Recurring", href: "/recurring-invoices" },
          { label: editId ? "Edit" : "New" },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-5">

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="lbl">Frequency</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringInvoice["frequency"])} className="inp">
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="lbl">Next Due Date *</label>
              <input type="date" required value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="inp" />
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
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? "Saving..." : editId ? "Update Recurring Invoice" : "Save & Continue"}
          </button>
          <Link href="/recurring-invoices" className="btn btn-outline btn-lg">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

export default function RecurringInvoiceNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Loading...</div>}>
      <RecurringInvoiceForm />
    </Suspense>
  );
}
