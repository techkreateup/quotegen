"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DebitNote, Vendor, LineItem, CompanySettings } from "@/lib/types";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { createEmptyLineItem, calculateTotals, calculateLineItem } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import LineItemsEditor from "@/components/LineItemsEditor";
import { format } from "date-fns";

const REASONS = ["Short Supply", "Overbilling", "Rate Variance", "Return", "Damage", "Other"];

function DebitNoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [debitNoteNo, setDebitNoteNo] = useState("");
  const [debitNoteDate, setDebitNoteDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vendorId, setVendorId] = useState("");
  const [reason, setReason] = useState("Short Supply");
  const [items, setItems] = useState<LineItem[]>([createEmptyLineItem()]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<DebitNote["status"]>("Draft");
  const [isInterState, setIsInterState] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    apiGet<Vendor[] | { data: Vendor[] }>("/api/vendors").then((d) => setVendors(Array.isArray(d) ? d : d.data));
    apiGet<CompanySettings>("/api/settings").then(setSettings);
    if (editId) {
      apiGet<DebitNote>(`/api/debit-notes/${editId}`).then((d) => {
        if (d) {
          setDebitNoteNo(d.debitNoteNo); setDebitNoteDate(d.debitNoteDate); setVendorId(d.vendorId);
          setReason(d.reason || "Short Supply"); setItems(d.items.length ? d.items : [createEmptyLineItem()]);
          setNotes(d.notes); setStatus(d.status); setIsInterState((d.totalIgst || 0) > 0);
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
    const data = { debitNoteDate, vendorId, reason, items, ...totals, status, notes };
    if (editId) await apiPut(`/api/debit-notes/${editId}`, { ...data, debitNoteNo });
    else await apiPost("/api/debit-notes", data);
    router.push("/debit-notes");
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader title={editId ? "Edit Debit Note" : "Create New Debit Note"}
        breadcrumbs={[{ label: "Finance" }, { label: "Debit Notes", href: "/debit-notes" }, { label: editId ? "Edit" : "New" }]} />
      <form onSubmit={handleSubmit} className="space-y-5"
        onKeyDown={(e) => { const tag = (e.target as HTMLElement).tagName; if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON") e.preventDefault(); }}>
        <div className="card p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div><label className="lbl">DN No {!editId && <span className="text-slate-400 font-normal">(auto if blank)</span>}</label><input type="text" value={debitNoteNo} onChange={(e) => setDebitNoteNo(e.target.value)} className="inp font-mono" placeholder={editId ? "" : "auto-generated"} /></div>
            <div><label className="lbl">Date *</label><input type="date" required value={debitNoteDate} onChange={(e) => setDebitNoteDate(e.target.value)} className="inp" /></div>
            <div><label className="lbl">Reason</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="inp">
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {editId && (
              <div><label className="lbl">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as DebitNote["status"])} className="inp">
                  {["Draft", "Issued", "Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
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
              Vendor <span className="text-slate-400 font-normal">— Debit raised against</span>
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
              <div className="flex justify-between font-bold text-[16px] border-t-2 border-slate-200 pt-3 mt-1"><span>Debit Amount (INR)</span><span className="nums" style={{color:'#dc2626'}}>−₹{totals.totalAmount.toFixed(2)}</span></div>
              <p className="text-[11px] text-slate-400 mt-1">This reduces the amount payable to the vendor.</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <label className="lbl">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="inp" placeholder="Explain the debit reason (short receipt qty, rate difference, etc.)" />
        </div>

        <div className="flex items-center gap-3 pb-4">
          <button type="submit" className="btn btn-primary btn-lg">{editId ? "Update Debit Note" : "Save Debit Note"}</button>
          <button type="button" onClick={() => router.push("/debit-notes")} className="btn btn-outline btn-lg">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function DebitNoteNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400 text-[13px]">Loading…</div>}>
      <DebitNoteForm />
    </Suspense>
  );
}
