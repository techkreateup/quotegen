"use client";

import { useEffect, useState } from "react";
import { Quotation, Client } from "@/lib/types";
import { apiGet, apiPut, apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Search, Edit2, Trash2, Eye, ArrowRight, FileText, Copy, ChevronDown, ChevronUp, Filter, ClipboardList } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog, alertDialog } from "@/components/Dialog";

const STATUSES = ["All","Draft","Created","Sent","Won","Lost","Cancelled"];

type SortOption = "newest" | "oldest" | "amount_high" | "amount_low" | "client_az" | "client_za";
const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "amount_high", label: "Amount: High→Low" },
  { key: "amount_low", label: "Amount: Low→High" },
  { key: "client_az", label: "Client A→Z" },
  { key: "client_za", label: "Client Z→A" },
];

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("All");
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sort, setSort]             = useState<SortOption>("newest");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [minAmount, setMinAmount]   = useState("");
  const [maxAmount, setMaxAmount]   = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const load = async (p = page) => {
    try {
      const res = await apiGet<{ data: Quotation[]; total: number; page: number; totalPages: number }>(`/api/quotations?page=${p}&limit=20`);
      if (res) { setQuotations(res.data); setTotalPages(res.totalPages); setTotalCount(res.total); setPage(res.page); }
    } catch {}
  };

  useEffect(() => {
    load();
    apiGet<Client[] | { data: Client[] }>("/api/clients").then(c => { if (c) setClients(Array.isArray(c) ? c : c.data); }).catch(() => {});
  }, []);

  const handlePageChange = (p: number) => { load(p); };

  const filtered = quotations
    .filter(q => filter === "All" || q.status === filter)
    .filter(q => q.quotationNo.toLowerCase().includes(search.toLowerCase()) || q.clientName?.toLowerCase().includes(search.toLowerCase()))
    .filter(q => {
      if (dateFrom && new Date(q.quotationDate) < new Date(dateFrom)) return false;
      if (dateTo && new Date(q.quotationDate) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    })
    .filter(q => {
      if (minAmount && q.totalAmount < Number(minAmount)) return false;
      if (maxAmount && q.totalAmount > Number(maxAmount)) return false;
      return true;
    })
    .filter(q => clientFilter === "all" || q.clientId === clientFilter)
    .sort((a, b) => {
      switch (sort) {
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "amount_high": return b.totalAmount - a.totalAmount;
        case "amount_low": return a.totalAmount - b.totalAmount;
        case "client_az": return (a.clientName || "").localeCompare(b.clientName || "");
        case "client_za": return (b.clientName || "").localeCompare(a.clientName || "");
      }
    });

  const toast = useToast();
  const del = async (id: string) => { if((await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this quotation?" }))) apiDelete(`/api/quotations/${id}`).then(()=>{load();toast.success("Quotation deleted");}).catch(()=>toast.error("Failed to delete")); };
  const changeStatus = (id: string, s: Quotation["status"]) => apiPut(`/api/quotations/${id}`,{status:s}).then(()=>load()).catch(()=>toast.error("Failed to update status"));
  const convertToSO = async (id: string) => {
    try {
      const r = await fetch("/api/sales-orders/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quotationId: id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Sales Order ${d.number} created`);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Convert failed"); }
  };
  const convertToInvoice = async (id: string) => {
    try {
      const r = await fetch("/api/invoices/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromType: "quotation", fromId: id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Invoice ${d.number} created`);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Convert failed"); }
  };

  const hasActiveFilters = dateFrom || dateTo || minAmount || maxAmount || clientFilter !== "all";

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Quotations" breadcrumbs={[{label:"Sales & Invoices"},{label:"Quotations"}]}
        action={<PermissionGate module="quotations" action="create"><div className="flex items-center gap-2"><Link href="/quotations/new?docType=Proforma" className="btn btn-outline"><Plus size={14}/> New Proforma</Link><Link href="/quotations/new" className="btn btn-primary"><Plus size={14}/> New Quotation</Link></div></PermissionGate>} />

      <div className="card overflow-hidden w-full">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          {/* Status pills — horizontal scroll on mobile */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {STATUSES.map(s=>(
                <button key={s} onClick={()=>{ setFilter(s); setPage(1); }} className={`pill${filter===s?" active":""}`}>{s}</button>
              ))}
            </div>
            <span className="text-[12px] text-slate-400 shrink-0 hidden sm:block">{filtered.length} of {totalCount} quotations</span>
          </div>

          {/* Search + filter button row (mobile) / Search + inline filters (desktop) */}
          <div className="flex items-center gap-2 sm:gap-3 sm:flex-wrap">
            <div className="search-box flex-1 sm:flex-none">
              <Search size={13} className="search-ico"/>
              <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search quotation or client..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>

            {/* Mobile: single filter toggle button */}
            <button onClick={() => setShowFilters(!showFilters)}
              className={`sm:hidden mob-filter-btn${hasActiveFilters || sort !== "newest" || clientFilter !== "all" ? " has-filters" : ""}`}>
              <Filter size={14} /> Filter {showFilters ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
            </button>

            {/* Desktop: inline filter controls */}
            <select value={sort} onChange={e => setSort(e.target.value as SortOption)}
              className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none cursor-pointer">
              {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
              className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none cursor-pointer">
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </select>
            <button onClick={() => setShowFilters(!showFilters)}
              className="hidden sm:flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md px-2 py-1.5 bg-white cursor-pointer"
              style={hasActiveFilters ? { borderColor: "#4F46E5", color: "#4F46E5" } : {}}
            >
              <Filter size={12} /> Filters {showFilters ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
            </button>
          </div>

          {/* Mobile filter drawer */}
          {showFilters && (
            <div className="sm:hidden flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-slate-500 font-semibold">Sort by</label>
                <select value={sort} onChange={e => setSort(e.target.value as SortOption)}
                  className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                  {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-slate-500 font-semibold">Client</label>
                <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
                  className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                  <option value="all">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-slate-500 font-semibold">From Date</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-slate-500 font-semibold">To Date</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-slate-500 font-semibold">Min Amount</label>
                  <input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="₹ 0"
                    className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-slate-500 font-semibold">Max Amount</label>
                  <input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="₹ Any"
                    className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
                </div>
              </div>
              {(hasActiveFilters || sort !== "newest" || clientFilter !== "all") && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setMinAmount(""); setMaxAmount(""); setClientFilter("all"); setSort("newest"); }}
                  className="text-[13px] text-red-500 font-semibold py-2 cursor-pointer">
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Desktop advanced filters row */}
          {showFilters && (
            <div className="hidden sm:flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400 font-medium">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="text-[12px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 outline-none" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400 font-medium">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="text-[12px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 outline-none" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400 font-medium">Min ₹</label>
                <input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="0"
                  className="text-[12px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 outline-none w-24" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400 font-medium">Max ₹</label>
                <input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="Any"
                  className="text-[12px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 outline-none w-24" />
              </div>
              {hasActiveFilters && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setMinAmount(""); setMaxAmount(""); setClientFilter("all"); }}
                  className="text-[11px] text-red-500 hover:text-red-700 font-medium cursor-pointer">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead><tr>
              <th className="mob-hide">#</th><th>Quotation No</th><th className="mob-hide tab-hide">Client</th><th>Date</th><th className="right">Amount</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={7}><div className="empty"><div className="empty-icon"><FileText size={36} color="#D1D5DB"/></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No quotations yet</h3><p className="text-[13px] text-slate-400 mt-1">Create your first quotation to send professional proposals to clients.</p><Link href="/quotations/new" className="btn btn-primary mt-4"><Plus size={14}/> New Quotation</Link></div></td></tr>
              ):filtered.map((q,i)=>(
                <tr key={q.id} onClick={(e)=>{ if((e.target as HTMLElement).closest('input,button,a,label')) return; window.location.href=`/quotations/view?id=${q.id}`; }} style={{cursor:'pointer'}}>
                  <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i+1}</td>
                  <td className="mob-primary">
                    <div>
                      <span className="font-bold text-indigo-600 text-[13px]">{q.quotationNo}</span>
                      {q.docType === "Proforma" && <span className="ml-1.5 text-[10px] font-semibold text-purple-600 bg-purple-50 border border-purple-200 rounded px-1 py-0.5 align-middle">PROFORMA</span>}
                      <span className="font-medium text-slate-500 text-[12px] sm:hidden"> · {q.clientName||"—"}</span>
                    </div>
                    {q.title&&q.title!=="Quotation"&&<div className="text-[11px] text-slate-400 mt-0.5">{q.title}</div>}
                  </td>
                  <td className="mob-hide tab-hide font-medium text-[13px]">{q.clientName||"—"}</td>
                  <td className="text-[12px]" data-label="Date">{formatDate(q.quotationDate)}</td>
                  <td className="text-right font-bold nums text-slate-900" data-label="Amt">₹{q.totalAmount.toLocaleString("en-IN")}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={q.status}/>
                      <select value={q.status} onChange={e=>changeStatus(q.id,e.target.value as Quotation["status"])} className="text-[11px] border border-slate-200 rounded-md px-1.5 py-0.5 bg-white text-slate-500 outline-none cursor-pointer max-sm:hidden">
                        {["Draft","Created","Sent","Won","Lost","Cancelled"].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <Link href={`/quotations/view?id=${q.id}`} className="act" title="View" aria-label="View quotation"><Eye size={14}/></Link>
                      <PermissionGate module="quotations" action="edit"><Link href={`/quotations/new?id=${q.id}`} className="act" title="Edit" aria-label="Edit quotation"><Edit2 size={14}/></Link></PermissionGate>
                      <PermissionGate module="quotations" action="create"><Link href={`/quotations/new?clone=${q.id}`} className="act" title="Duplicate" aria-label="Duplicate quotation"><Copy size={14}/></Link></PermissionGate>
                      <PermissionGate module="sales-orders" action="create"><button onClick={()=>convertToSO(q.id)} className="act" title="Convert to Sales Order" aria-label="Convert to sales order"><ClipboardList size={14}/></button></PermissionGate>
                      <PermissionGate module="invoices" action="create"><button onClick={()=>convertToInvoice(q.id)} className="act go" title="Convert to Invoice" aria-label="Convert to invoice"><ArrowRight size={14}/></button></PermissionGate>
                      <PermissionGate module="quotations" action="delete"><button onClick={()=>del(q.id)} className="act del" title="Delete" aria-label="Delete quotation"><Trash2 size={14}/></button></PermissionGate>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      </div>
    </div>
  );
}
