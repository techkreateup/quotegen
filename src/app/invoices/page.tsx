"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Invoice, Client, CompanySettings } from "@/lib/types";
import { apiGet, apiDelete, apiPut, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import DocumentPreview from "@/components/DocumentPreview";
import { downloadPdf } from "@/lib/pdf";
import { Plus, Search, Edit2, Trash2, Eye, Receipt, Download, Copy, DollarSign, FileDown, Filter, ChevronUp, ChevronDown } from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog, alertDialog } from "@/components/Dialog";

const STATUSES = ["All","Draft","Unpaid","Paid","PartiallyPaid","Overdue","Cancelled"];
const STATUS_LABELS: Record<string,string> = { PartiallyPaid: "Partially Paid" };
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "amount-desc", label: "Amount High→Low" },
  { value: "amount-asc", label: "Amount Low→High" },
  { value: "client-az", label: "Client A→Z" },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("All");
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New filter states
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [amountMin, setAmountMin]   = useState("");
  const [amountMax, setAmountMax]   = useState("");
  const [sortBy, setSortBy]         = useState("newest");
  const [clientFilter, setClientFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [settings, setSettings]     = useState<CompanySettings | null>(null);
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const pdfResolveRef = useRef<(() => void) | null>(null);
  const toast = useToast();

  const load = async (p = page) => {
    try {
      const res = await apiGet<{ data: Invoice[]; total: number; page: number; totalPages: number }>(`/api/invoices?page=${p}&limit=20`);
      if (res) {
        setInvoices(res.data);
        setTotalPages(res.totalPages);
        setTotalCount(res.total);
        setPage(res.page);
      }
    } catch {}
  };

  const loadClients = async () => {
    try {
      const res = await apiGet<{ data: Client[] }>("/api/clients?page=1&limit=500");
      if (res) setClients(res.data);
    } catch {}
  };

  useEffect(()=>{
    load();
    loadClients();
    apiGet<CompanySettings>("/api/settings").then(s => { if (s) setSettings(s); }).catch(() => {});
  },[]);

  const handlePageChange = (p: number) => { load(p); };

  const hasActiveFilters = dateFrom || dateTo || amountMin || amountMax || clientFilter;
  const hasFilters = filter !== "All" || search || dateFrom || dateTo || amountMin || amountMax || sortBy !== "newest" || clientFilter;

  const clearFilters = () => {
    setFilter("All"); setSearch(""); setDateFrom(""); setDateTo("");
    setAmountMin(""); setAmountMax(""); setSortBy("newest"); setClientFilter("");
  };

  const filtered = useMemo(() => {
    const list = invoices
      .filter(i => filter === "All" || i.status === filter)
      .filter(i => i.invoiceNo.toLowerCase().includes(search.toLowerCase()) || (i as Invoice & { clientName?: string }).clientName?.toLowerCase().includes(search.toLowerCase()))
      .filter(i => !clientFilter || i.clientId === clientFilter)
      .filter(i => {
        if (dateFrom && new Date(i.invoiceDate) < new Date(dateFrom)) return false;
        if (dateTo && new Date(i.invoiceDate) > new Date(dateTo)) return false;
        return true;
      })
      .filter(i => {
        if (amountMin && i.totalAmount < Number(amountMin)) return false;
        if (amountMax && i.totalAmount > Number(amountMax)) return false;
        return true;
      });

    switch (sortBy) {
      case "oldest": list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case "amount-desc": list.sort((a, b) => b.totalAmount - a.totalAmount); break;
      case "amount-asc": list.sort((a, b) => a.totalAmount - b.totalAmount); break;
      case "client-az": list.sort((a, b) => ((a as Invoice & { clientName?: string }).clientName || "").localeCompare((b as Invoice & { clientName?: string }).clientName || "")); break;
      default: list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [invoices, filter, search, clientFilter, dateFrom, dateTo, amountMin, amountMax, sortBy]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };
  const bulkDownloadPdf = async () => {
    const ids = Array.from(selected);
    if (!ids.length || !settings) return;
    setBulkDownloading(true);
    toast.info(`Generating ${ids.length} PDF${ids.length > 1 ? "s" : ""}...`);

    for (let idx = 0; idx < ids.length; idx++) {
      const inv = invoices.find(i => i.id === ids[idx]);
      if (!inv) continue;

      // Fetch full invoice data with line items
      let fullInv: Invoice;
      try {
        fullInv = await apiGet<Invoice>(`/api/invoices/${inv.id}`);
      } catch { continue; }

      // Render the hidden preview and wait for it
      await new Promise<void>((resolve) => {
        pdfResolveRef.current = resolve;
        setPdfInvoice(fullInv);
      });

      // Small delay to let DOM paint
      await new Promise(r => setTimeout(r, 300));

      // Generate PDF from the hidden element
      try {
        await downloadPdf("bulk-pdf-render", `${fullInv.invoiceNo}.pdf`);
      } catch { /* skip */ }

      setPdfInvoice(null);
      await new Promise(r => setTimeout(r, 100));
    }

    setBulkDownloading(false);
    toast.success(`${ids.length} PDF${ids.length > 1 ? "s" : ""} downloaded!`);
  };

  // Trigger resolve when pdfInvoice renders
  useEffect(() => {
    if (pdfInvoice && pdfResolveRef.current) {
      const fn = pdfResolveRef.current;
      pdfResolveRef.current = null;
      fn();
    }
  }, [pdfInvoice]);

  const del = async (id: string) => {
    const inv = invoices.find(i => i.id === id);
    const msg = inv?.status === "Paid"
      ? "This invoice is marked as Paid. Deleting it will also remove the associated payment receipt and transaction record.\n\nAre you sure you want to delete?"
      : inv?.status === "PartiallyPaid"
        ? "This invoice has partial payments recorded. Deleting it will also remove associated payment receipts.\n\nAre you sure you want to delete?"
        : "Delete this invoice?";
    if ((await confirmDialog({ title: "Please confirm", tone: "danger", message: msg }))) { try { await apiDelete(`/api/invoices/${id}`); toast.success("Invoice deleted"); } catch { toast.error("Failed to delete"); } load(); }
  };
  const changeStatus = async (id: string, s: Invoice["status"]) => {
    const inv = invoices.find(i => i.id === id);
    try {
      if (s === "Paid") {
        await apiPost(`/api/invoices/${id}/mark-paid`, {});
      } else if (inv?.status === "Paid" && s === "Unpaid") {
        if (!(await confirmDialog({ title: "Please confirm", tone: "danger", message: "This will delete the auto-generated payment receipt and transaction. Continue?" }))) return;
        await apiPost(`/api/invoices/${id}/revert-payment`, {});
      } else {
        await apiPut(`/api/invoices/${id}`, { status: s });
      }
    } catch {} load();
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Invoices" breadcrumbs={[{label:"Sales & Invoices"},{label:"Invoices"}]}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {selected.size > 0 && (
              <button onClick={bulkDownloadPdf} disabled={bulkDownloading} className="btn btn-success">
                <FileDown size={14}/> {bulkDownloading ? "Downloading…" : `Download ${selected.size} PDF${selected.size > 1 ? "s" : ""}`}
              </button>
            )}
            <button onClick={() => downloadCSV(`invoices-${new Date().toISOString().slice(0,10)}.csv`, ["Invoice No","Client","Date","Due Date","Amount","Status"], invoices.map(i => [i.invoiceNo, i.clientName, i.invoiceDate, i.dueDate, i.totalAmount, i.status]))} className="btn btn-outline"><Download size={14}/> Export</button>
            <PermissionGate module="invoices" action="create"><Link href="/invoices/new" className="btn btn-primary"><Plus size={14}/> New Invoice</Link></PermissionGate>
          </div>
        } />

      <div className="card overflow-hidden w-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          {/* Status pills */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {STATUSES.map(s=>(
                <button key={s} onClick={()=>setFilter(s)} className={`pill${filter===s?" active":""}`}>{STATUS_LABELS[s]||s}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selected.size > 0 && <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{selected.size} selected</span>}
              {hasFilters && <button onClick={clearFilters} className="text-[11px] text-indigo-500 hover:text-indigo-700 cursor-pointer font-medium">Clear filters</button>}
              <span className="text-[12px] text-slate-400 hidden sm:block">{filtered.length} of {totalCount}</span>
            </div>
          </div>

          {/* Search + filter button row (mobile) / Search + inline filters (desktop) */}
          <div className="flex items-center gap-2 sm:gap-3 sm:flex-wrap">
            <div className="search-box flex-1 sm:flex-none">
              <Search size={13} className="search-ico"/>
              <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search invoice or client…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>

            {/* Mobile: single filter toggle button */}
            <button onClick={() => setShowFilters(!showFilters)}
              className={`sm:hidden mob-filter-btn${hasActiveFilters || sortBy !== "newest" || clientFilter ? " has-filters" : ""}`}>
              <Filter size={14} /> Filter {showFilters ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
            </button>

            {/* Desktop: inline filter controls */}
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
              className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none cursor-pointer">
              {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}
              className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none cursor-pointer">
              <option value="">All Clients</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.businessName}</option>)}
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
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
                  className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                  {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-slate-500 font-semibold">Client</label>
                <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)}
                  className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                  <option value="">All Clients</option>
                  {clients.map(c=><option key={c.id} value={c.id}>{c.businessName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-slate-500 font-semibold">From Date</label>
                  <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                    className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-slate-500 font-semibold">To Date</label>
                  <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                    className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-slate-500 font-semibold">Min Amount</label>
                  <input type="number" value={amountMin} onChange={e=>setAmountMin(e.target.value)} placeholder="₹ 0"
                    className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-slate-500 font-semibold">Max Amount</label>
                  <input type="number" value={amountMax} onChange={e=>setAmountMax(e.target.value)} placeholder="₹ Any"
                    className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
                </div>
              </div>
              {(hasActiveFilters || sortBy !== "newest" || clientFilter) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setAmountMin(""); setAmountMax(""); setClientFilter(""); setSortBy("newest"); }}
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
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                  className="text-[12px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 outline-none" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400 font-medium">To</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                  className="text-[12px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 outline-none" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400 font-medium">Min ₹</label>
                <input type="number" value={amountMin} onChange={e=>setAmountMin(e.target.value)} placeholder="0"
                  className="text-[12px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 outline-none w-24" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-400 font-medium">Max ₹</label>
                <input type="number" value={amountMax} onChange={e=>setAmountMax(e.target.value)} placeholder="Any"
                  className="text-[12px] border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 outline-none w-24" />
              </div>
              {hasActiveFilters && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); setAmountMin(""); setAmountMax(""); setClientFilter(""); }}
                  className="text-[11px] text-red-500 hover:text-red-700 font-medium cursor-pointer">Clear</button>
              )}
            </div>
          )}
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead><tr>
              <th className="mob-hide" style={{width:40}}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll}/></th>
              <th className="mob-hide">#</th><th>Invoice No</th><th className="mob-hide">Client</th><th>Date</th><th className="mob-hide tab-hide">Due Date</th><th className="right">Amount</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={9}><div className="empty"><div className="empty-icon"><Receipt size={36} color="#D1D5DB"/></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No invoices yet</h3><p className="text-[13px] text-slate-400 mt-1">Create your first invoice to start billing your clients.</p><Link href="/invoices/new" className="btn btn-primary mt-4"><Plus size={14}/> New Invoice</Link></div></td></tr>
              ):filtered.map((inv,i)=>(
                <tr key={inv.id} onClick={(e)=>{ if((e.target as HTMLElement).closest('input,button,a,label')) return; window.location.href=`/invoices/view?id=${inv.id}`; }} style={{cursor:'pointer'}}>
                  <td className="mob-hide"><input type="checkbox" checked={selected.has(inv.id)} onChange={()=>toggleSelect(inv.id)}/></td>
                  <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i+1}</td>
                  <td className="mob-primary font-bold text-indigo-600 text-[13px]">{inv.invoiceNo} <span className="font-medium text-slate-500 text-[12px] sm:hidden"> · {(inv as Invoice & { clientName?: string }).clientName||"—"}</span></td>
                  <td className="mob-hide font-medium text-[13px]">{(inv as Invoice & { clientName?: string }).clientName||"—"}</td>
                  <td className="text-[12px]" data-label="Date">{formatDate(inv.invoiceDate)}</td>
                  <td className="text-[12px] mob-hide tab-hide">{inv.dueDate?formatDate(inv.dueDate):"—"}</td>
                  <td className="font-bold nums text-slate-900" data-label="Amt">₹{inv.totalAmount.toLocaleString("en-IN")}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={inv.status}/>
                      <select value={inv.status} onChange={e=>changeStatus(inv.id,e.target.value as Invoice["status"])} className="text-[11px] border border-slate-200 rounded-md px-1.5 py-0.5 bg-white text-slate-500 outline-none cursor-pointer max-sm:hidden">
                        {["Draft","Unpaid","Paid","PartiallyPaid","Overdue","Cancelled"].map(s=><option key={s} value={s}>{STATUS_LABELS[s]||s}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <Link href={`/invoices/view?id=${inv.id}`} className="act" title="View" aria-label="View invoice"><Eye size={14}/></Link>
                      <PermissionGate module="invoices" action="edit"><Link href={`/invoices/new?id=${inv.id}`} className="act" title="Edit" aria-label="Edit invoice"><Edit2 size={14}/></Link></PermissionGate>
                      <PermissionGate module="invoices" action="create"><Link href={`/invoices/new?clone=${inv.id}`} className="act" title="Duplicate" aria-label="Duplicate invoice"><Copy size={14}/></Link></PermissionGate>
                      {(inv.status === "Unpaid" || inv.status === "PartiallyPaid" || inv.status === "Overdue" || inv.status === "Draft") && (
                        <PermissionGate module="receipts" action="create"><Link href={`/payment-receipts/new?invoiceId=${inv.id}`} className="act go" title="Record Payment" aria-label="Record payment"><DollarSign size={14}/></Link></PermissionGate>
                      )}
                      <PermissionGate module="invoices" action="delete"><button onClick={()=>del(inv.id)} className="act del" title="Delete" aria-label="Delete invoice"><Trash2 size={14}/></button></PermissionGate>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      </div>

      {/* Hidden off-screen container for bulk PDF rendering */}
      {pdfInvoice && settings && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, width: 800, zIndex: -1 }}>
          <DocumentPreview
            id="bulk-pdf-render"
            type={(pdfInvoice as unknown as { isExport?: boolean }).isExport ? "Export Invoice" : "Invoice"}
            currency={clients.find((c) => c.id === pdfInvoice.clientId)?.currency}
            documentNo={pdfInvoice.invoiceNo}
            date={pdfInvoice.invoiceDate}
            dueDate={pdfInvoice.dueDate}
            title={pdfInvoice.title}
            status={pdfInvoice.status}
            settings={settings}
            clientName={pdfInvoice.clientName || ""}
            clientGstin={""}
            items={pdfInvoice.items}
            subtotal={pdfInvoice.subtotal}
            totalDiscount={pdfInvoice.totalDiscount}
            totalCgst={pdfInvoice.totalCgst}
            totalSgst={pdfInvoice.totalSgst}
            totalIgst={pdfInvoice.totalIgst}
            additionalCharges={pdfInvoice.additionalCharges}
            additionalChargesLabel={pdfInvoice.additionalChargesLabel}
            roundOff={pdfInvoice.roundOff}
            totalAmount={pdfInvoice.totalAmount}
            notes={pdfInvoice.notes}
            termsAndConditions={pdfInvoice.termsAndConditions}
            paymentDate={pdfInvoice.paymentDate}
          />
        </div>
      )}
    </div>
  );
}
