"use client";

import { useEffect, useState } from "react";
import { PaymentReceipt } from "@/lib/types";
import { formatDate } from "@/lib/store";
import { apiGet, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Search, Eye, Trash2, CreditCard } from "lucide-react";
import Link from "next/link";
import PermissionGate from "@/components/PermissionGate";
import { useToast } from "@/components/Toast";

export default function PaymentReceiptsPage() {
  const toast = useToast();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [search, setSearch]     = useState("");

  const load = () => apiGet<PaymentReceipt[]>("/api/receipts").then(setReceipts).catch(()=>{});
  useEffect(()=>{load();},[]);

  const filtered = receipts
    .filter(r=>r.receiptNo.toLowerCase().includes(search.toLowerCase())||r.clientName.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());

  const del = async (id: string) => { if(confirm("Delete receipt?")) { try{await apiDelete(`/api/receipts/${id}`); toast.success("Receipt deleted");}catch{ toast.error("Failed to delete receipt"); } load(); } };

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Payment Receipts" breadcrumbs={[{label:"Sales & Invoices"},{label:"Payment Receipts"}]}
        action={<PermissionGate module="receipts" action="create"><Link href="/payment-receipts/new" className="btn btn-success"><Plus size={14}/> Record Payment</Link></PermissionGate>} />

      <div className="card overflow-hidden w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <span className="text-[12px] text-slate-400">{filtered.length} of {receipts.length} receipts</span>
          <div className="search-box flex-1 sm:flex-none">
            <Search size={13} className="search-ico"/>
            <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search receipts…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead><tr>
              <th className="mob-hide">#</th><th>Receipt No</th><th className="mob-hide">Client</th><th className="mob-hide tab-hide">Invoice</th><th className="mob-hide">Date</th><th className="mob-hide tab-hide">Method</th><th className="right">Amount</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={9}><div className="empty"><div className="empty-icon"><CreditCard size={20}/></div><p className="text-[13px] text-slate-400">No payment receipts found</p></div></td></tr>
              ):filtered.map((r,i)=>(
                <tr key={r.id}>
                  <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i+1}</td>
                  <td className="mob-primary font-bold text-indigo-600 text-[13px]">{r.receiptNo}<span className="font-medium text-slate-500 text-[12px] sm:hidden"> · {r.clientName}</span></td>
                  <td className="mob-hide font-medium text-[13px]" data-label="Client">{r.clientName}</td>
                  <td className="mob-hide tab-hide text-[12px] text-slate-500">{r.invoiceNo}</td>
                  <td className="mob-hide text-[12px]">{formatDate(r.receiptDate)}</td>
                  <td className="mob-hide tab-hide"><span className="text-[11.5px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">{r.paymentMethod}</span></td>
                  <td className="text-right font-bold nums text-emerald-600" data-label="Amt">₹{r.amount.toLocaleString("en-IN")}</td>
                  <td><StatusBadge status={r.status}/></td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <Link href={`/payment-receipts/view?id=${r.id}`} className="act" title="View"><Eye size={14}/></Link>
                      <PermissionGate module="receipts" action="delete"><button onClick={()=>del(r.id)} className="act del" title="Delete"><Trash2 size={14}/></button></PermissionGate>
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
