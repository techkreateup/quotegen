"use client";

import { useEffect, useState, useMemo } from "react";
import { Client } from "@/lib/types";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Search, Edit2, Trash2, X, Eye, Upload, Users, FileText, Receipt, Filter, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import ModalPortal from "@/components/ModalPortal";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog, alertDialog } from "@/components/Dialog";

const INDUSTRIES = ["Technology","Retail","Tourism","Photography","Decor and Events","Computer Software","Education","Healthcare","Finance","Manufacturing","Food & Beverage","Real Estate","Marketing","Consulting","Other"];
const CLIENT_STATUSES = ["All", "Active", "Inactive", "At Risk"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name-az", label: "Name A→Z" },
  { value: "name-za", label: "Name Z→A" },
];

const empty: Omit<Client,"id"|"createdAt"|"updatedAt"> = { businessName:"",industry:"",country:"India",state:"",city:"",phones:[""],email:"",gstin:"",pan:"",status:"Active",address:"",logoUrl:"",defaultCc:"",defaultBcc:"" };

export default function ClientsPage() {
  const [clients, setClients]     = useState<Client[]>([]);
  const [search, setSearch]       = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm]           = useState<Omit<Client,"id"|"createdAt"|"updatedAt">>(empty);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New filter states
  const [statusFilter, setStatusFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [cityFilter, setCityFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = async (p = page) => {
    try {
      const res = await apiGet<{ data: Client[]; total: number; page: number; totalPages: number }>(`/api/clients?page=${p}&limit=20`);
      if (res) {
        setClients(res.data.map(c=>({...c,status:c.status===("AtRisk" as string)?"At Risk":c.status}) as Client));
        setTotalPages(res.totalPages);
        setTotalCount(res.total);
        setPage(res.page);
      }
    } catch {}
  };
  useEffect(() => { fetchData(); }, []);

  const handlePageChange = (p: number) => { fetchData(p); };

  const hasFilters = statusFilter !== "All" || search || industryFilter || sortBy !== "newest" || cityFilter;
  const hasActiveFilters = industryFilter !== "" || sortBy !== "newest" || cityFilter !== "";

  const clearFilters = () => {
    setStatusFilter("All"); setSearch(""); setIndustryFilter(""); setSortBy("newest"); setCityFilter("");
  };

  const filtered = useMemo(() => {
    const list = clients
      .filter(c => statusFilter === "All" || c.status === statusFilter)
      .filter(c => c.businessName.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.industry.toLowerCase().includes(search.toLowerCase()))
      .filter(c => !industryFilter || c.industry === industryFilter)
      .filter(c => !cityFilter || c.city.toLowerCase().includes(cityFilter.toLowerCase()));

    switch (sortBy) {
      case "oldest": list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case "name-az": list.sort((a, b) => a.businessName.localeCompare(b.businessName)); break;
      case "name-za": list.sort((a, b) => b.businessName.localeCompare(a.businessName)); break;
      default: list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [clients, statusFilter, search, industryFilter, cityFilter, sortBy]);

  const close = () => { setShowForm(false); setEditingId(null); setForm(empty); };

  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!form.businessName.trim()) return;
    setSubmitting(true);
    const payload = { ...form, status: form.status==="At Risk"?"AtRisk":form.status };
    try { editingId ? await apiPut(`/api/clients/${editingId}`,payload) : await apiPost("/api/clients",payload); await fetchData(); close(); toast.success(editingId ? "Client updated" : "Client added"); } catch(err) { toast.error(String(err)); } finally { setSubmitting(false); }
  }
  function handleEdit(c: Client) { setForm({...c,phones:c.phones?.length?c.phones:[""],logoUrl:c.logoUrl||""}); setEditingId(c.id); setShowForm(true); }
  async function handleDelete(id: string) { if ((await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this client?" }))) { try { await apiDelete(`/api/clients/${id}`); await fetchData(); toast.success("Client deleted"); } catch { toast.error("Failed to delete client"); } } }
  async function handleStatus(id: string, status: Client["status"]) { try { await apiPut(`/api/clients/${id}`,{status:status==="At Risk"?"AtRisk":status}); await fetchData(); } catch { toast.error("Failed to update status"); } }

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Clients" breadcrumbs={[{label:"Sales & Invoices"},{label:"Clients"}]}
        action={<PermissionGate module="clients" action="create"><button onClick={()=>{setForm(empty);setEditingId(null);setShowForm(true);}} className="btn btn-primary"><Plus size={14}/> Add Client</button></PermissionGate>} />

      {/* Modal */}
      {showForm && (
        <ModalPortal>
        <div className="modal-bg">
          <div className="modal">
            <div className="flex items-start justify-between px-4 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">{editingId?"Edit Client":"Add Client"}</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">Fill in the client details below</p>
              </div>
              <button onClick={close} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15}/></button>
            </div>
            <form onSubmit={handleSubmit} className="px-4 sm:px-7 py-5 space-y-4">
              {/* Logo */}
              <div>
                <label className="lbl">Client Logo</label>
                {form.logoUrl ? (
                  <div className="relative inline-block">
                    <img src={form.logoUrl} alt="" className="h-12 max-w-[140px] object-contain rounded-lg border border-slate-200 p-1.5 bg-slate-50"/>
                    <button type="button" onClick={()=>setForm({...form,logoUrl:""})} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"><X size={10}/></button>
                  </div>
                ):(
                  <label className="inline-flex items-center gap-2 px-4 py-2 border-[1.5px] border-dashed border-indigo-200 rounded-lg bg-indigo-50/50 text-[12.5px] text-indigo-600 font-medium cursor-pointer hover:bg-indigo-50 transition-colors">
                    <Upload size={13}/> Upload Logo
                    <input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onloadend=()=>setForm(prev=>({...prev,logoUrl:r.result as string}));r.readAsDataURL(f);}}/>
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="lbl">Business Name *</label><input required type="text" value={form.businessName} onChange={e=>setForm({...form,businessName:e.target.value})} className="inp" placeholder="Company name"/></div>
                <div><label className="lbl">Industry</label><select value={form.industry} onChange={e=>setForm({...form,industry:e.target.value})} className="inp"><option value="">Select</option>{INDUSTRIES.map(i=><option key={i}>{i}</option>)}</select></div>
                <div><label className="lbl">Country</label><input type="text" value={form.country} onChange={e=>setForm({...form,country:e.target.value})} className="inp"/></div>
                <div><label className="lbl">State</label><input type="text" value={form.state} onChange={e=>setForm({...form,state:e.target.value})} className="inp" placeholder="e.g. Tamil Nadu"/></div>
                <div><label className="lbl">City</label><input type="text" value={form.city} onChange={e=>setForm({...form,city:e.target.value})} className="inp"/></div>
                <div><label className="lbl">Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="inp" placeholder="billing@company.com"/></div>
                <div><label className="lbl">Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value as Client["status"]})} className="inp"><option>Active</option><option>Inactive</option><option>At Risk</option></select></div>
                <div><label className="lbl">GSTIN</label><input type="text" value={form.gstin} onChange={e=>setForm({...form,gstin:e.target.value})} className="inp" placeholder="22AAAAA0000A1Z5"/></div>
                <div><label className="lbl">PAN</label><input type="text" value={form.pan} onChange={e=>setForm({...form,pan:e.target.value})} className="inp" placeholder="AAAAA9999A"/></div>
                <div><label className="lbl">Default CC <span className="text-slate-400 font-normal">(auto-CC'd on emails)</span></label><input type="text" value={form.defaultCc||""} onChange={e=>setForm({...form,defaultCc:e.target.value})} className="inp" placeholder="accounts@client.com"/></div>
                <div><label className="lbl">Default BCC</label><input type="text" value={form.defaultBcc||""} onChange={e=>setForm({...form,defaultBcc:e.target.value})} className="inp" placeholder="optional"/></div>
              </div>

              <div>
                <label className="lbl">Phone Numbers</label>
                {form.phones.map((ph,i)=>(
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={ph} onChange={e=>{const phones=[...form.phones];phones[i]=e.target.value;setForm({...form,phones});}} className="inp flex-1" placeholder="+91 XXXXX XXXXX"/>
                    {form.phones.length>1&&<button type="button" onClick={()=>setForm({...form,phones:form.phones.filter((_,j)=>j!==i)})} className="btn btn-danger-soft btn-icon shrink-0"><Trash2 size={13}/></button>}
                  </div>
                ))}
                <button type="button" onClick={()=>setForm({...form,phones:[...form.phones,""]})} className="text-[12px] font-semibold text-indigo-600 flex items-center gap-1 hover:text-indigo-700"><Plus size={12}/> Add Phone</button>
              </div>

              <div><label className="lbl">Address</label><textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})} rows={2} className="inp"/></div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={close} className="btn btn-outline" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><div className="spinner spinner-sm"/> {editingId?"Updating…":"Saving…"}</> : editingId?"Update Client":"Save Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Table card */}
      <div className="card overflow-hidden w-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {CLIENT_STATUSES.map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} className={`pill${statusFilter===s?" active":""}`}>{s}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasFilters && <button onClick={clearFilters} className="text-[11px] text-indigo-500 hover:text-indigo-700 cursor-pointer font-medium">Clear filters</button>}
              <span className="text-[12px] text-slate-400 hidden sm:block">{filtered.length} of {totalCount} clients</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="search-box flex-1 sm:flex-none">
              <Search size={13} className="search-ico"/>
              <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search clients…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`sm:hidden mob-filter-btn${hasActiveFilters ? " has-filters" : ""}`}
            >
              <Filter size={14}/>
              Filters
              {showFilters ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            <select value={industryFilter} onChange={e=>setIndustryFilter(e.target.value)} className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none">
              <option value="">All Industries</option>
              {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none">
              {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="text" value={cityFilter} onChange={e=>setCityFilter(e.target.value)} className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none w-32" placeholder="Filter by city…"/>
          </div>
          {showFilters && (
            <div className="sm:hidden flex flex-col gap-3">
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-600 outline-none">
                {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={industryFilter} onChange={e=>setIndustryFilter(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-600 outline-none">
                <option value="">All Industries</option>
                {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
              </select>
              <input type="text" value={cityFilter} onChange={e=>setCityFilter(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-600 outline-none" placeholder="Filter by city…"/>
              {hasActiveFilters && (
                <button onClick={() => { setIndustryFilter(""); setSortBy("newest"); setCityFilter(""); }} className="text-[13px] text-indigo-500 hover:text-indigo-700 font-medium self-start">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead><tr>
              {["#","Client","Industry","Phone","Email","Country","Status","Actions"].map(h=><th key={h} className={h==="#"?"mob-hide":["Phone","Email","Country"].includes(h)?"mob-hide tab-hide":""}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={8}><div className="empty"><div className="empty-icon"><Users size={36} color="#D1D5DB"/></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No clients yet</h3><p className="text-[13px] text-slate-400 mt-1">Add your first client to start creating quotations and invoices.</p><button onClick={()=>{setForm(empty);setEditingId(null);setShowForm(true);}} className="btn btn-primary mt-4"><Plus size={14}/> Add Client</button></div></td></tr>
              ):filtered.map((c,i)=>(
                <tr key={c.id}>
                  <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i+1}</td>
                  <td className="mob-primary">
                    <div className="flex items-center gap-2.5">
                      {c.logoUrl?<img src={c.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0"/>:<div className="av av-md shrink-0 text-white" style={{background:"linear-gradient(135deg,#6366F1,#818CF8)"}}>{c.businessName.charAt(0).toUpperCase()}</div>}
                      <span className="font-semibold text-slate-900 text-[13px]">{c.businessName}</span>
                    </div>
                  </td>
                  <td>{c.industry?<span className="text-[11.5px] font-medium px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">{c.industry}</span>:<span className="text-slate-300">—</span>}</td>
                  <td className="text-[12px] mob-hide tab-hide">{c.phones?.filter(Boolean).join(", ")||"—"}</td>
                  <td className="text-[12px] mob-hide tab-hide">{c.email||"—"}</td>
                  <td className="text-[12px] mob-hide tab-hide">{c.country}</td>
                  <td><StatusBadge status={c.status}/></td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <Link href={`/clients/view?id=${c.id}`} className="act" title="View"><Eye size={14}/></Link>
                      <PermissionGate module="clients" action="edit"><button onClick={()=>handleEdit(c)} className="act" title="Edit" aria-label="Edit client"><Edit2 size={14}/></button></PermissionGate>
                      <PermissionGate module="quotations" action="create"><Link href={`/quotations/new?clientId=${c.id}`} className="act" title="New Quotation" aria-label="New quotation for client"><FileText size={14}/></Link></PermissionGate>
                      <PermissionGate module="invoices" action="create"><Link href={`/invoices/new?clientId=${c.id}`} className="act" title="New Invoice" aria-label="New invoice for client"><Receipt size={14}/></Link></PermissionGate>
                      <PermissionGate module="clients" action="delete"><button onClick={()=>handleDelete(c.id)} className="act del" title="Delete" aria-label="Delete client"><Trash2 size={14}/></button></PermissionGate>
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
