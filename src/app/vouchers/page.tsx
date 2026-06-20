"use client";

import { useEffect, useState } from "react";
import { PaymentVoucher } from "@/lib/types";
import { apiGet, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Search, Trash2, Eye, FileText, CheckCircle2, Download } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { downloadPdf } from "@/lib/pdf";
import PermissionGate from "@/components/PermissionGate";
import { useToast } from "@/components/Toast";

export default function VouchersPage() {
  const toast = useToast();
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const load = () => apiGet<PaymentVoucher[]>("/api/vouchers").then(setVouchers).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = vouchers.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.voucherNo.toLowerCase().includes(q) ||
      v.paidTo.toLowerCase().includes(q) ||
      (v.employeeName?.toLowerCase().includes(q) || false) ||
      v.description.toLowerCase().includes(q)
    );
  });

  const del = async (id: string) => {
    if (confirm("Delete this voucher?")) {
      try { await apiDelete(`/api/vouchers/${id}`); toast.success("Voucher deleted"); } catch { toast.error("Failed to delete voucher"); }
      load();
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((v) => v.id)));
  };

  const bulkDownload = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkDownloading(true);
    for (const vid of ids) {
      const v = vouchers.find((x) => x.id === vid);
      if (!v) continue;
      window.open(`/vouchers/view?id=${vid}&autodownload=1`, "_blank");
      await new Promise((r) => setTimeout(r, 500));
    }
    setBulkDownloading(false);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const fmtDate = (d: string) => {
    try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Payment Vouchers"
        breadcrumbs={[{ label: "HR & Payroll" }, { label: "Vouchers" }]}
        action={
          selected.size > 0 ? (
            <button onClick={bulkDownload} disabled={bulkDownloading} className="btn btn-primary">
              <Download size={14} /> {bulkDownloading ? "Downloading…" : `Download ${selected.size} Voucher${selected.size > 1 ? "s" : ""}`}
            </button>
          ) : undefined
        }
      />

      <div className="card overflow-hidden w-full">
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5"
          style={{ background: "#FAFBFD" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-slate-400">{filtered.length} vouchers</span>
            {selected.size > 0 && (
              <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {selected.size} selected
              </span>
            )}
          </div>
          <div className="search-box flex-1 sm:flex-none">
            <Search size={13} className="search-ico" />
            <input
              type="text"
              className="search-inp w-full sm:w-auto"
              placeholder="Search vouchers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th className="mob-hide" style={{ width: 40 }}>
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                </th>
                <th>Voucher No</th>
                <th>Date</th>
                <th>Paid To</th>
                <th className="mob-hide tab-hide">Description</th>
                <th className="right">Amount</th>
                <th className="mob-hide">Method</th>
                <th className="mob-hide tab-hide">Acknowledged</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty">
                      <div className="empty-icon"><FileText size={20} /></div>
                      <p className="text-[13px] text-slate-400">No payment vouchers yet.</p>
                      <p className="text-[11px] text-slate-300 mt-1">Process salary records to generate vouchers.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((v) => (
                  <tr key={v.id}>
                    <td className="mob-hide">
                      <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} />
                    </td>
                    <td className="mob-primary">
                      <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {v.voucherNo}
                      </span>
                    </td>
                    <td className="text-[13px]" data-label="Date">{fmtDate(v.voucherDate)}</td>
                    <td data-label="Paid To">
                      <div>
                        <div className="font-semibold text-slate-900 text-[13px]">{v.paidTo}</div>
                        {v.employeeCode && (
                          <div className="text-[11px] text-slate-400 font-mono">{v.employeeCode}</div>
                        )}
                      </div>
                    </td>
                    <td className="mob-hide tab-hide text-[12px] text-slate-500 max-w-[200px] truncate">{v.description || "—"}</td>
                    <td className="text-right font-bold nums text-[13px]" data-label="Amt">{fmt(v.amount)}</td>
                    <td className="mob-hide text-[12px]">{v.paymentMethod}</td>
                    <td className="mob-hide tab-hide">
                      {v.isAcknowledged ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> Yes
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">No</span>
                      )}
                    </td>
                    <td className="mob-actions">
                      <div className="flex items-center gap-0.5">
                        <Link href={`/vouchers/view?id=${v.id}`} className="act" title="View">
                          <Eye size={14} />
                        </Link>
                        <PermissionGate module="vouchers" action="delete"><button onClick={() => del(v.id)} className="act del" title="Delete">
                          <Trash2 size={14} />
                        </button></PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
