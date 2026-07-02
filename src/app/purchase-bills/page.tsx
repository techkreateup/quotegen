"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPut, apiDelete } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Search, Eye, Edit2, Trash2, Receipt, ArrowRight, FileMinus } from "lucide-react";
import { confirmDialog } from "@/components/Dialog";
import { formatDate } from "@/lib/store";

interface Bill { id: string; billNo: string; billDate: string; dueDate: string | null; vendorId: string; vendor: { name: string; gstin: string }; totalAmount: number; status: string; purchaseOrderId: string | null; description: string; isReverseCharge?: boolean; }

const STATUSES = ["All", "Recorded", "Verified", "Cancelled"];

export default function PurchaseBillsPage() {
  const [rows, setRows] = useState<Bill[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const toast = useToast();

  const load = () => apiGet<{ data: Bill[] }>("/api/purchase-bills?limit=100").then(r => setRows(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = rows
    .filter(b => filter === "All" || b.status === filter)
    .filter(b => b.billNo.toLowerCase().includes(search.toLowerCase()) || b.vendor?.name?.toLowerCase().includes(search.toLowerCase()));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = (b: Bill) => b.status !== "Cancelled" && !!b.dueDate && new Date(b.dueDate) < today;

  async function setDueDate(id: string, dueDate: string) {
    try { await apiPut(`/api/purchase-bills/${id}`, { dueDate }); load(); toast.success("Due date updated"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function setStatus(id: string, status: string) {
    try { await apiPut(`/api/purchase-bills/${id}`, { status }); load(); toast.success(`Marked ${status}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function del(id: string) {
    if (!(await confirmDialog({ title: "Delete this vendor bill?", tone: "danger", message: "This removes the bill and its line items. Payments and debit notes are kept." }))) return;
    try { await apiDelete(`/api/purchase-bills/${id}`); load(); toast.success("Deleted"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function raiseDN(b: Bill) {
    try {
      const r = await fetch("/api/debit-notes/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseBillId: b.id, reason: "Short Supply" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Debit Note ${d.debitNoteNo} created`);
      window.location.href = `/debit-notes/new?id=${d.id}`;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Vendor Bills" breadcrumbs={[{ label: "Finance" }, { label: "Vendor Bills" }]} />

      <div className="card overflow-hidden w-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUSES.map(s => <button key={s} onClick={() => setFilter(s)} className={`pill${filter === s ? " active" : ""}`}>{s}</button>)}
            </div>
            <span className="text-[12px] text-slate-400 hidden sm:block">{filtered.length} of {rows.length} bills</span>
          </div>
          <div className="search-box flex-1 sm:flex-none max-w-md">
            <Search size={13} className="search-ico" />
            <input type="text" className="search-inp w-full" placeholder="Search bill no / vendor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Bill No</th><th>Vendor</th><th>Bill Date</th><th>Due Date</th><th className="right">Amount</th><th>Status</th><th>PO Source</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty"><div className="empty-icon"><Receipt size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No vendor bills yet</h3><p className="text-[13px] text-slate-400 mt-1">Convert a Purchase Order to create a bill, then set the vendor&apos;s bill number and due date.</p><Link href="/purchase-orders" className="btn btn-primary mt-4">Go to Purchase Orders</Link></div></td></tr>
              ) : filtered.map(b => (
                <tr key={b.id} style={isOverdue(b) ? { background: "#FEF2F2" } : {}}>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-indigo-600 text-[13px]">{b.billNo}</span>
                      {b.isReverseCharge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200" title="Reverse Charge — you pay GST">RCM</span>}
                    </div>
                    {b.description && <div className="text-[11px] text-slate-400 truncate max-w-[220px]">{b.description}</div>}
                  </td>
                  <td className="font-medium text-[13px]">{b.vendor?.name || "—"}</td>
                  <td className="text-[12px]">{formatDate(b.billDate)}</td>
                  <td><input type="date" defaultValue={b.dueDate ? b.dueDate.split("T")[0] : ""} onBlur={e => e.target.value !== (b.dueDate?.split("T")[0] || "") && setDueDate(b.id, e.target.value)} className="text-[12px] border border-slate-200 rounded-md px-1.5 py-1 outline-none focus:border-indigo-400" style={{ width: 140, background: isOverdue(b) ? "#FEE2E2" : "#fff", color: isOverdue(b) ? "#991B1B" : undefined, fontWeight: isOverdue(b) ? 600 : 400 }} /></td>
                  <td className="right nums font-bold">₹{b.totalAmount.toLocaleString("en-IN")}</td>
                  <td><select value={b.status} onChange={e => setStatus(b.id, e.target.value)} className="text-[11px] border border-slate-200 rounded-md px-1.5 py-0.5 bg-white outline-none cursor-pointer">{["Recorded", "Verified", "Cancelled"].map(s => <option key={s}>{s}</option>)}</select></td>
                  <td>{b.purchaseOrderId ? <Link href={`/purchase-orders/view?id=${b.purchaseOrderId}`} className="text-[12px] text-indigo-600 hover:underline">PO</Link> : <span className="text-[11px] text-slate-300">—</span>}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      {b.purchaseOrderId && <Link href={`/purchase-orders/view?id=${b.purchaseOrderId}`} className="act" title="View source PO"><Eye size={14} /></Link>}
                      <button onClick={() => raiseDN(b)} className="act" title="Raise Debit Note"><FileMinus size={14} /></button>
                      <Link href={`/vendors/view?id=${b.vendorId}`} className="act go" title="Pay this vendor"><ArrowRight size={14} /></Link>
                      <button onClick={() => del(b.id)} className="act del" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
