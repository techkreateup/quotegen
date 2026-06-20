"use client";

import { useEffect, useState } from "react";
import { CreditNote } from "@/lib/types";
import { apiGet, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Search, Trash2, X, FileMinus, Eye, Pencil } from "lucide-react";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/lib/store";
import Link from "next/link";
import ModalPortal from "@/components/ModalPortal";
import PermissionGate from "@/components/PermissionGate";

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [search, setSearch] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);

  const toast = useToast();

  const fetchAll = async () => {
    try {
      const [cn] = await Promise.all([
        apiGet<CreditNote[]>("/api/credit-notes"),
      ]);
      if (cn) setCreditNotes(cn);
    } catch {}
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = creditNotes.filter((cn) =>
    cn.creditNoteNo.toLowerCase().includes(search.toLowerCase()) ||
    cn.clientName.toLowerCase().includes(search.toLowerCase()) ||
    cn.reason.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(id: string) {
    if (confirm("Delete this credit note?")) {
      try { await apiDelete(`/api/credit-notes/${id}`); await fetchAll(); toast.success("Credit note deleted"); } catch { toast.error("Failed to delete"); }
    }
  }

  const viewNote = viewId ? creditNotes.find((cn) => cn.id === viewId) : null;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Credit Notes"
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Credit Notes" }]}
        action={
          <PermissionGate module="credit-notes" action="create">
            <Link href="/credit-notes/new" className="btn btn-primary">
              New Credit Note
            </Link>
          </PermissionGate>
        }
      />

      {/* View Modal */}
      {viewNote && (
        <ModalPortal>
        <div className="modal-bg">
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="flex items-start justify-between px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">{viewNote.creditNoteNo}</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">{viewNote.clientName}</p>
              </div>
              <button onClick={() => setViewId(null)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
            </div>
            <div className="px-4 sm:px-7 py-5 space-y-3 text-[13px]">
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span>{formatDate(viewNote.creditNoteDate)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={viewNote.status} /></div>
              {viewNote.invoiceNo && <div className="flex justify-between"><span className="text-slate-500">Invoice</span><span>{viewNote.invoiceNo}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Reason</span><span>{viewNote.reason}</span></div>
              <div className="border-t border-slate-100 pt-3">
                <p className="font-semibold mb-2">Line Items</p>
                {viewNote.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-[12px] py-1">
                    <span>{item.itemName} x{item.quantity}</span>
                    <span>₹{item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-[15px]">
                <span>Total</span>
                <span>₹{viewNote.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              {viewNote.notes && <div className="pt-2"><p className="text-slate-500 text-[12px]">{viewNote.notes}</p></div>}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Table */}
      <div className="card overflow-hidden w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <span className="text-[12px] text-slate-400">{filtered.length} credit notes</span>
          <div className="search-box flex-1 sm:flex-none">
            <Search size={13} className="search-ico" />
            <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search credit notes..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th className="mob-hide">#</th>
                <th>Credit Note No</th>
                <th className="mob-hide">Date</th>
                <th className="mob-hide">Client</th>
                <th className="mob-hide tab-hide">Invoice</th>
                <th className="mob-hide tab-hide">Reason</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty">
                      <div className="empty-icon"><FileMinus size={20} /></div>
                      <p className="text-[13px] text-slate-400">No credit notes yet.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((cn, i) => (
                <tr key={cn.id}>
                  <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i + 1}</td>
                  <td className="mob-primary font-mono text-[12px] font-semibold">{cn.creditNoteNo}<span className="font-medium text-slate-500 text-[12px] sm:hidden"> · {cn.clientName}</span></td>
                  <td className="mob-hide text-[12px]">{formatDate(cn.creditNoteDate)}</td>
                  <td className="mob-hide text-[13px] font-medium" data-label="Client">{cn.clientName}</td>
                  <td className="mob-hide tab-hide text-[12px] font-mono">{cn.invoiceNo || "—"}</td>
                  <td className="mob-hide tab-hide text-[12px]">{cn.reason || "—"}</td>
                  <td className="text-[13px] font-semibold" data-label="Amt">₹{cn.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td><StatusBadge status={cn.status} /></td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setViewId(cn.id)} className="act" title="View"><Eye size={14} /></button>
                      <PermissionGate module="credit-notes" action="edit"><Link href={`/credit-notes/new?id=${cn.id}`} className="act" title="Edit"><Pencil size={14} /></Link></PermissionGate>
                      <PermissionGate module="credit-notes" action="delete"><button onClick={() => handleDelete(cn.id)} className="act del" title="Delete"><Trash2 size={14} /></button></PermissionGate>
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
