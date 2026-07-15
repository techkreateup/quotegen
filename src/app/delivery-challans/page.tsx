"use client";

import { useEffect, useState } from "react";
import { DeliveryChallan } from "@/lib/types";
import { apiGet, apiPut, apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Search, Edit2, Trash2, Eye, ArrowRight, Truck } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog } from "@/components/Dialog";

const STATUSES = ["All", "Draft", "Issued", "Delivered", "Invoiced", "Cancelled"];
const STATUS_OPTIONS = ["Draft", "Issued", "Delivered", "Invoiced", "Cancelled"];

export default function DeliveryChallansPage() {
  const [rows, setRows] = useState<DeliveryChallan[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const toast = useToast();

  const load = async (p = page) => {
    try {
      const res = await apiGet<{ data: DeliveryChallan[]; total: number; page: number; totalPages: number }>(`/api/delivery-challans?page=${p}&limit=20`);
      if (res) { setRows(res.data); setTotalPages(res.totalPages); setTotalCount(res.total); setPage(res.page); }
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const filtered = rows
    .filter(c => filter === "All" || c.status === filter)
    .filter(c => c.challanNo.toLowerCase().includes(search.toLowerCase()) || c.clientName?.toLowerCase().includes(search.toLowerCase()));

  const del = async (id: string) => {
    if (await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this delivery challan?" }))
      apiDelete(`/api/delivery-challans/${id}`).then(() => { load(); toast.success("Delivery challan deleted"); }).catch(() => toast.error("Failed to delete"));
  };
  const changeStatus = (id: string, s: DeliveryChallan["status"]) =>
    apiPut(`/api/delivery-challans/${id}`, { status: s }).then(() => load()).catch(() => toast.error("Failed to update status"));

  const convertToInvoice = async (id: string) => {
    try {
      const r = await fetch("/api/invoices/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromType: "deliveryChallan", fromId: id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Invoice ${d.number} created`);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Convert failed"); }
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Delivery Challans" breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Delivery Challans" }]}
        action={<PermissionGate module="delivery-challans" action="create"><Link href="/delivery-challans/new" className="btn btn-primary"><Plus size={14} /> New Challan</Link></PermissionGate>} />

      <div className="card overflow-hidden w-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => { setFilter(s); setPage(1); }} className={`pill${filter === s ? " active" : ""}`}>{s}</button>
              ))}
            </div>
            <span className="text-[12px] text-slate-400 shrink-0 hidden sm:block">{filtered.length} of {totalCount} challans</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="search-box flex-1 sm:flex-none">
              <Search size={13} className="search-ico" />
              <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search challan / client..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead><tr>
              <th className="mob-hide">#</th><th>Challan No</th><th className="mob-hide tab-hide">Client</th><th className="mob-hide">Type</th><th>Date</th><th className="right">Value</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty"><div className="empty-icon"><Truck size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No delivery challans yet</h3><p className="text-[13px] text-slate-400 mt-1">Create one when goods move out, or convert from a sales order.</p><Link href="/delivery-challans/new" className="btn btn-primary mt-4"><Plus size={14} /> New Challan</Link></div></td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.id} onClick={(e)=>{ if((e.target as HTMLElement).closest('input,button,a,label')) return; window.location.href=`/delivery-challans/view?id=${c.id}`; }} style={{cursor:'pointer'}}>
                  <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i + 1}</td>
                  <td className="mob-primary">
                    <div>
                      <span className="font-bold text-indigo-600 text-[13px]">{c.challanNo}</span>
                      <span className="font-medium text-slate-500 text-[12px] sm:hidden"> · {c.clientName || "—"}</span>
                    </div>
                  </td>
                  <td className="mob-hide tab-hide font-medium text-[13px]">{c.clientName || "—"}</td>
                  <td className="mob-hide text-[12px] text-slate-500">{c.challanType}</td>
                  <td className="text-[12px]" data-label="Date">{formatDate(c.challanDate)}</td>
                  <td className="text-right font-bold nums text-slate-900" data-label="Value">₹{c.totalAmount.toLocaleString("en-IN")}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <select value={c.status} onChange={e => changeStatus(c.id, e.target.value as DeliveryChallan["status"])} className="text-[11px] border border-slate-200 rounded-md px-1.5 py-0.5 bg-white text-slate-500 outline-none cursor-pointer max-sm:hidden">
                        {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <Link href={`/delivery-challans/view?id=${c.id}`} className="act" title="View" aria-label="View challan"><Eye size={14} /></Link>
                      <PermissionGate module="delivery-challans" action="edit"><Link href={`/delivery-challans/new?id=${c.id}`} className="act" title="Edit" aria-label="Edit challan"><Edit2 size={14} /></Link></PermissionGate>
                      <PermissionGate module="invoices" action="create"><button onClick={() => convertToInvoice(c.id)} className="act go" title="Convert to Invoice" aria-label="Convert to invoice"><ArrowRight size={14} /></button></PermissionGate>
                      <PermissionGate module="delivery-challans" action="delete"><button onClick={() => del(c.id)} className="act del" title="Delete" aria-label="Delete challan"><Trash2 size={14} /></button></PermissionGate>
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
