"use client";

import { useEffect, useState } from "react";
import { PurchaseOrder } from "@/lib/types";
import { apiGet, apiPut, apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Search, Edit2, Trash2, Eye, ArrowRight, ShoppingCart } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog } from "@/components/Dialog";

const STATUSES = ["All", "Draft", "Issued", "PartiallyReceived", "Received", "Billed", "Closed", "Cancelled"];
const STATUS_OPTIONS = ["Draft", "Issued", "PartiallyReceived", "Received", "Billed", "Closed", "Cancelled"];

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const toast = useToast();

  const load = async (p = page) => {
    try {
      const res = await apiGet<{ data: PurchaseOrder[]; total: number; page: number; totalPages: number }>(`/api/purchase-orders?page=${p}&limit=20`);
      if (res) { setRows(res.data); setTotalPages(res.totalPages); setTotalCount(res.total); setPage(res.page); }
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const filtered = rows
    .filter(o => filter === "All" || o.status === filter)
    .filter(o => o.purchaseOrderNo.toLowerCase().includes(search.toLowerCase()) || o.vendorName?.toLowerCase().includes(search.toLowerCase()));

  const del = async (id: string) => {
    if (await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this purchase order?" }))
      apiDelete(`/api/purchase-orders/${id}`).then(() => { load(); toast.success("Purchase order deleted"); }).catch(() => toast.error("Failed to delete"));
  };
  const changeStatus = (id: string, s: PurchaseOrder["status"]) =>
    apiPut(`/api/purchase-orders/${id}`, { status: s }).then(() => load()).catch(() => toast.error("Failed to update status"));

  const convertToBill = async (id: string) => {
    try {
      const r = await fetch("/api/purchase-bills/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseOrderId: id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Vendor Bill ${d.billNo} created (set the vendor's bill no on the bill)`);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Convert failed"); }
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Purchase Orders" breadcrumbs={[{ label: "Finance" }, { label: "Purchase Orders" }]}
        action={<PermissionGate module="purchase-orders" action="create"><Link href="/purchase-orders/new" className="btn btn-primary"><Plus size={14} /> New Purchase Order</Link></PermissionGate>} />

      <div className="card overflow-hidden w-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => { setFilter(s); setPage(1); }} className={`pill${filter === s ? " active" : ""}`}>{s}</button>
              ))}
            </div>
            <span className="text-[12px] text-slate-400 shrink-0 hidden sm:block">{filtered.length} of {totalCount} orders</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="search-box flex-1 sm:flex-none">
              <Search size={13} className="search-ico" />
              <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search PO / vendor..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead><tr>
              <th className="mob-hide">#</th><th>PO No</th><th className="mob-hide tab-hide">Vendor</th><th>Date</th><th className="right">Amount</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty"><div className="empty-icon"><ShoppingCart size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No purchase orders yet</h3><p className="text-[13px] text-slate-400 mt-1">Raise a PO to a vendor, then convert it to a bill when the invoice arrives.</p><Link href="/purchase-orders/new" className="btn btn-primary mt-4"><Plus size={14} /> New Purchase Order</Link></div></td></tr>
              ) : filtered.map((o, i) => (
                <tr key={o.id} onClick={(e)=>{ if((e.target as HTMLElement).closest('input,button,a,label')) return; window.location.href=`/purchase-orders/view?id=${o.id}`; }} style={{cursor:'pointer'}}>
                  <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i + 1}</td>
                  <td className="mob-primary">
                    <div>
                      <span className="font-bold text-indigo-600 text-[13px]">{o.purchaseOrderNo}</span>
                      <span className="font-medium text-slate-500 text-[12px] sm:hidden"> · {o.vendorName || "—"}</span>
                    </div>
                  </td>
                  <td className="mob-hide tab-hide font-medium text-[13px]">{o.vendorName || "—"}</td>
                  <td className="text-[12px]" data-label="Date">{formatDate(o.orderDate)}</td>
                  <td className="text-right font-bold nums text-slate-900" data-label="Amt">₹{o.totalAmount.toLocaleString("en-IN")}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={o.status} />
                      <select value={o.status} onChange={e => changeStatus(o.id, e.target.value as PurchaseOrder["status"])} className="text-[11px] border border-slate-200 rounded-md px-1.5 py-0.5 bg-white text-slate-500 outline-none cursor-pointer max-sm:hidden">
                        {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <Link href={`/purchase-orders/view?id=${o.id}`} className="act" title="View" aria-label="View purchase order"><Eye size={14} /></Link>
                      <PermissionGate module="purchase-orders" action="edit"><Link href={`/purchase-orders/new?id=${o.id}`} className="act" title="Edit" aria-label="Edit purchase order"><Edit2 size={14} /></Link></PermissionGate>
                      <PermissionGate module="purchase-bills" action="create"><button onClick={() => convertToBill(o.id)} className="act go" title="Convert to Vendor Bill" aria-label="Convert to vendor bill"><ArrowRight size={14} /></button></PermissionGate>
                      <PermissionGate module="purchase-orders" action="delete"><button onClick={() => del(o.id)} className="act del" title="Delete" aria-label="Delete purchase order"><Trash2 size={14} /></button></PermissionGate>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={(p) => load(p)} />
      </div>
    </div>
  );
}
