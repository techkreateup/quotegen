"use client";

import { useEffect, useState } from "react";
import { GoodsReceiptNote } from "@/lib/types";
import { apiGet, apiPut, apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Search, Edit2, Trash2, Eye, PackageCheck } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog } from "@/components/Dialog";

const STATUSES = ["All", "Draft", "Posted", "Cancelled"];
const STATUS_OPTIONS = ["Draft", "Posted", "Cancelled"];

export default function GoodsReceiptsPage() {
  const [rows, setRows] = useState<GoodsReceiptNote[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const toast = useToast();

  const load = async (p = page) => {
    try {
      const res = await apiGet<{ data: GoodsReceiptNote[]; total: number; page: number; totalPages: number }>(`/api/goods-receipts?page=${p}&limit=20`);
      if (res) { setRows(res.data); setTotalPages(res.totalPages); setTotalCount(res.total); setPage(res.page); }
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const filtered = rows
    .filter(g => filter === "All" || g.status === filter)
    .filter(g => g.grnNo.toLowerCase().includes(search.toLowerCase()) || g.vendorName?.toLowerCase().includes(search.toLowerCase()));

  const del = async (id: string) => {
    if (await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this goods receipt?" }))
      apiDelete(`/api/goods-receipts/${id}`).then(() => { load(); toast.success("Goods receipt deleted"); }).catch(() => toast.error("Failed to delete"));
  };
  const changeStatus = (id: string, s: GoodsReceiptNote["status"]) =>
    apiPut(`/api/goods-receipts/${id}`, { status: s }).then(() => load()).catch(() => toast.error("Failed to update status"));

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Goods Receipts" breadcrumbs={[{ label: "Finance" }, { label: "Goods Receipts" }]}
        action={<PermissionGate module="goods-receipts" action="create"><Link href="/goods-receipts/new" className="btn btn-primary"><Plus size={14} /> New Goods Receipt</Link></PermissionGate>} />

      <div className="card overflow-hidden w-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {STATUSES.map(s => <button key={s} onClick={() => { setFilter(s); setPage(1); }} className={`pill${filter === s ? " active" : ""}`}>{s}</button>)}
            </div>
            <span className="text-[12px] text-slate-400 shrink-0 hidden sm:block">{filtered.length} of {totalCount} receipts</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="search-box flex-1 sm:flex-none">
              <Search size={13} className="search-ico" />
              <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search GRN / vendor..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead><tr>
              <th className="mob-hide">#</th><th>GRN No</th><th className="mob-hide tab-hide">Vendor</th><th>Date</th><th className="right">Value</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty"><div className="empty-icon"><PackageCheck size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No goods receipts yet</h3><p className="text-[13px] text-slate-400 mt-1">Receive a purchase order&apos;s goods, or record a receipt directly.</p><Link href="/goods-receipts/new" className="btn btn-primary mt-4"><Plus size={14} /> New Goods Receipt</Link></div></td></tr>
              ) : filtered.map((g, i) => (
                <tr key={g.id}>
                  <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i + 1}</td>
                  <td className="mob-primary">
                    <div>
                      <span className="font-bold text-indigo-600 text-[13px]">{g.grnNo}</span>
                      <span className="font-medium text-slate-500 text-[12px] sm:hidden"> · {g.vendorName || "—"}</span>
                    </div>
                  </td>
                  <td className="mob-hide tab-hide font-medium text-[13px]">{g.vendorName || "—"}</td>
                  <td className="text-[12px]" data-label="Date">{formatDate(g.receiptDate)}</td>
                  <td className="text-right font-bold nums text-slate-900" data-label="Value">₹{g.totalAmount.toLocaleString("en-IN")}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={g.status} />
                      <select value={g.status} onChange={e => changeStatus(g.id, e.target.value as GoodsReceiptNote["status"])} className="text-[11px] border border-slate-200 rounded-md px-1.5 py-0.5 bg-white text-slate-500 outline-none cursor-pointer max-sm:hidden">
                        {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <Link href={`/goods-receipts/view?id=${g.id}`} className="act" title="View" aria-label="View goods receipt"><Eye size={14} /></Link>
                      <PermissionGate module="goods-receipts" action="edit"><Link href={`/goods-receipts/new?id=${g.id}`} className="act" title="Edit" aria-label="Edit goods receipt"><Edit2 size={14} /></Link></PermissionGate>
                      <PermissionGate module="goods-receipts" action="delete"><button onClick={() => del(g.id)} className="act del" title="Delete" aria-label="Delete goods receipt"><Trash2 size={14} /></button></PermissionGate>
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
