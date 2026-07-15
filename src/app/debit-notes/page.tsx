"use client";

import { useEffect, useState } from "react";
import { DebitNote } from "@/lib/types";
import { apiGet, apiPut, apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Search, Edit2, Trash2, Eye, FileMinus } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog } from "@/components/Dialog";

const STATUSES = ["All", "Draft", "Issued", "Cancelled"];
const STATUS_OPTIONS = ["Draft", "Issued", "Cancelled"];

export default function DebitNotesPage() {
  const [rows, setRows] = useState<DebitNote[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const toast = useToast();

  const load = async (p = page) => {
    try {
      const res = await apiGet<{ data: DebitNote[]; total: number; page: number; totalPages: number }>(`/api/debit-notes?page=${p}&limit=20`);
      if (res) { setRows(res.data); setTotalPages(res.totalPages); setTotalCount(res.total); setPage(res.page); }
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const filtered = rows
    .filter(d => filter === "All" || d.status === filter)
    .filter(d => d.debitNoteNo.toLowerCase().includes(search.toLowerCase()) || d.vendorName?.toLowerCase().includes(search.toLowerCase()));

  const del = async (id: string) => {
    if (await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this debit note?" }))
      apiDelete(`/api/debit-notes/${id}`).then(() => { load(); toast.success("Debit note deleted"); }).catch(() => toast.error("Failed to delete"));
  };
  const changeStatus = (id: string, s: DebitNote["status"]) =>
    apiPut(`/api/debit-notes/${id}`, { status: s }).then(() => load()).catch(() => toast.error("Failed to update status"));

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Debit Notes" breadcrumbs={[{ label: "Finance" }, { label: "Debit Notes" }]}
        action={<PermissionGate module="debit-notes" action="create"><Link href="/debit-notes/new" className="btn btn-primary"><Plus size={14} /> New Debit Note</Link></PermissionGate>} />

      <div className="card overflow-hidden w-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {STATUSES.map(s => <button key={s} onClick={() => { setFilter(s); setPage(1); }} className={`pill${filter === s ? " active" : ""}`}>{s}</button>)}
            </div>
            <span className="text-[12px] text-slate-400 shrink-0 hidden sm:block">{filtered.length} of {totalCount} notes</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="search-box flex-1 sm:flex-none">
              <Search size={13} className="search-ico" />
              <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search debit note / vendor..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead><tr>
              <th className="mob-hide">#</th><th>DN No</th><th className="mob-hide tab-hide">Vendor</th><th className="mob-hide">Reason</th><th>Date</th><th className="right">Amount</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty"><div className="empty-icon"><FileMinus size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No debit notes yet</h3><p className="text-[13px] text-slate-400 mt-1">Raise a debit note when a vendor bill needs to be reduced — short supply, rate variance, or returns.</p><Link href="/debit-notes/new" className="btn btn-primary mt-4"><Plus size={14} /> New Debit Note</Link></div></td></tr>
              ) : filtered.map((d, i) => (
                <tr key={d.id} onClick={(e)=>{ if((e.target as HTMLElement).closest('input,button,a,label')) return; window.location.href=`/debit-notes/view?id=${d.id}`; }} style={{cursor:'pointer'}}>
                  <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i + 1}</td>
                  <td className="mob-primary">
                    <div>
                      <span className="font-bold text-indigo-600 text-[13px]">{d.debitNoteNo}</span>
                      <span className="font-medium text-slate-500 text-[12px] sm:hidden"> · {d.vendorName || "—"}</span>
                    </div>
                  </td>
                  <td className="mob-hide tab-hide font-medium text-[13px]">{d.vendorName || "—"}</td>
                  <td className="mob-hide text-[12px] text-slate-500">{d.reason}</td>
                  <td className="text-[12px]" data-label="Date">{formatDate(d.debitNoteDate)}</td>
                  <td className="text-right font-bold nums text-slate-900" data-label="Amt">−₹{d.totalAmount.toLocaleString("en-IN")}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={d.status} />
                      <select value={d.status} onChange={e => changeStatus(d.id, e.target.value as DebitNote["status"])} className="text-[11px] border border-slate-200 rounded-md px-1.5 py-0.5 bg-white text-slate-500 outline-none cursor-pointer max-sm:hidden">
                        {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <Link href={`/debit-notes/view?id=${d.id}`} className="act" title="View" aria-label="View debit note"><Eye size={14} /></Link>
                      <PermissionGate module="debit-notes" action="edit"><Link href={`/debit-notes/new?id=${d.id}`} className="act" title="Edit" aria-label="Edit debit note"><Edit2 size={14} /></Link></PermissionGate>
                      <PermissionGate module="debit-notes" action="delete"><button onClick={() => del(d.id)} className="act del" title="Delete" aria-label="Delete debit note"><Trash2 size={14} /></button></PermissionGate>
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
