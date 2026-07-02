"use client";

import { useEffect, useState } from "react";
import { Vendor } from "@/lib/types";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, Search, Edit2, Trash2, X, Eye, Package, Filter, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import ModalPortal from "@/components/ModalPortal";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog, alertDialog } from "@/components/Dialog";
import { TDS_SECTIONS } from "@/lib/tds";

interface VendorRow extends Vendor {
  totalPaid: number;
  paymentCount: number;
}

const empty = { name: "", email: "", phone: "", address: "", gstin: "", notes: "", tdsSection: "", tdsRate: 0 };

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const load = async (p = page) => {
    try {
      const res = await apiGet<{ data: VendorRow[]; total: number; page: number; totalPages: number }>(`/api/vendors?page=${p}&limit=20`);
      if (res) { setVendors(res.data); setTotalPages(res.totalPages); setTotalCount(res.total); setPage(res.page); }
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const handlePageChange = (p: number) => { load(p); };

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.email.toLowerCase().includes(search.toLowerCase()) ||
      v.gstin.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    switch (sort) {
      case "name-asc": return a.name.localeCompare(b.name);
      case "name-desc": return b.name.localeCompare(a.name);
      case "most-payments": return b.paymentCount - a.paymentCount;
      default: return 0; // newest — server default
    }
  });

  const toast = useToast();
  const close = () => { setShowForm(false); setEditingId(null); setForm(empty); };

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      editingId
        ? await apiPut(`/api/vendors/${editingId}`, form)
        : await apiPost("/api/vendors", form);
      await load();
      close();
      toast.success(editingId ? "Vendor updated" : "Vendor added");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(v: VendorRow) {
    setForm({ name: v.name, email: v.email, phone: v.phone, address: v.address, gstin: v.gstin, notes: v.notes, tdsSection: v.tdsSection || "", tdsRate: v.tdsRate || 0 });
    setEditingId(v.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if ((await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this vendor?" }))) {
      try { await apiDelete(`/api/vendors/${id}`); await load(); toast.success("Vendor deleted"); } catch { toast.error("Failed to delete vendor"); }
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Vendors"
        breadcrumbs={[{ label: "Finance" }, { label: "Vendors" }]}
        action={
          <PermissionGate module="vendors" action="create"><button onClick={() => { setForm(empty); setEditingId(null); setShowForm(true); }} className="btn btn-primary">
            <Plus size={14} /> Add Vendor
          </button></PermissionGate>
        }
      />

      {/* Modal */}
      {showForm && (
        <ModalPortal>
        <div className="modal-bg">
          <div className="modal">
            <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
                  {editingId ? "Edit Vendor" : "Add Vendor"}
                </h2>
                <p className="text-[12px] text-slate-400 mt-0.5">Fill in the vendor details below</p>
              </div>
              <button onClick={close} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 sm:px-7 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Vendor Name *</label>
                  <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="inp" placeholder="Vendor name" />
                </div>
                <div>
                  <label className="lbl">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="inp" placeholder="vendor@company.com" />
                </div>
                <div>
                  <label className="lbl">Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="inp" placeholder="+91 XXXXX XXXXX" />
                </div>
                <div>
                  <label className="lbl">GSTIN</label>
                  <input type="text" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="inp" placeholder="22AAAAA0000A1Z5" />
                </div>
              </div>
              <div>
                <label className="lbl">Address</label>
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="inp" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="lbl">TDS Section <span className="text-slate-400 font-normal">(default for payments)</span></label>
                  <select value={form.tdsSection} onChange={(e) => {
                    const code = e.target.value;
                    const preset = TDS_SECTIONS.find(s => s.code === code);
                    setForm({ ...form, tdsSection: code, tdsRate: preset?.defaultRate ?? 0 });
                  }} className="inp">
                    {TDS_SECTIONS.map(s => <option key={s.code || "none"} value={s.code}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">TDS Rate (%)</label>
                  <input type="number" step="0.01" min="0" value={form.tdsRate} onChange={(e) => setForm({ ...form, tdsRate: Number(e.target.value) || 0 })} className="inp" disabled={!form.tdsSection} />
                </div>
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="inp" />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={close} className="btn btn-outline" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><div className="spinner spinner-sm"/> Saving…</> : editingId ? "Update Vendor" : "Save Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Table card */}
      <div className="card overflow-hidden w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <span className="text-[12px] text-slate-400">{filtered.length} of {totalCount} vendors</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none">
            <option value="newest">Newest</option>
            <option value="name-asc">Name A→Z</option>
            <option value="name-desc">Name Z→A</option>
            <option value="most-payments">Most Payments</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)} className={`sm:hidden mob-filter-btn${sort !== "newest" ? " has-filters" : ""}`}>
            <Filter size={14} /> Filter {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <div className="search-box flex-1 sm:flex-none">
            <Search size={13} className="search-ico" />
            <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search vendors…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {showFilters && (
          <div className="sm:hidden flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6]" style={{ background: "#FAFBFD" }}>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Sort By</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                <option value="newest">Newest</option>
                <option value="name-asc">Name A→Z</option>
                <option value="name-desc">Name Z→A</option>
                <option value="most-payments">Most Payments</option>
              </select>
            </div>
          </div>
        )}
        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th className="mob-hide">#</th>
                <th>Name</th>
                <th className="mob-hide tab-hide">Email</th>
                <th className="mob-hide tab-hide">Phone</th>
                <th className="mob-hide tab-hide">GSTIN</th>
                <th>Total Paid</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      <div className="empty-icon"><Package size={36} color="#D1D5DB" /></div>
                      <h3 className="text-[15px] font-semibold text-slate-700 mt-3">No vendors yet</h3>
                      <p className="text-[13px] text-slate-400 mt-1">Add vendors to track payments and manage your supply chain.</p>
                      <button onClick={() => { setForm(empty); setEditingId(null); setShowForm(true); }} className="btn btn-primary mt-4"><Plus size={14} /> Add Vendor</button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((v, i) => (
                  <tr key={v.id}>
                    <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i + 1}</td>
                    <td className="mob-primary">
                      <div className="flex items-center gap-2.5">
                        <div className="av av-md shrink-0 text-white" style={{ background: "linear-gradient(135deg,#6366F1,#818CF8)" }}>
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900 text-[13px]">{v.name}</span>
                      </div>
                    </td>
                    <td className="mob-hide tab-hide text-[12px]" data-label="Email">{v.email || "—"}</td>
                    <td className="mob-hide tab-hide text-[12px]" data-label="Phone">{v.phone || "—"}</td>
                    <td className="mob-hide tab-hide text-[12px]">{v.gstin || "—"}</td>
                    <td className="text-[12px] font-semibold text-slate-700" data-label="Paid">{fmt(v.totalPaid)}</td>
                    <td className="mob-actions">
                      <div className="flex items-center gap-0.5">
                        <Link href={`/vendors/view?id=${v.id}`} className="act" title="View" aria-label="View vendor"><Eye size={14} /></Link>
                        <PermissionGate module="vendors" action="edit"><button onClick={() => handleEdit(v)} className="act" title="Edit" aria-label="Edit vendor"><Edit2 size={14} /></button></PermissionGate>
                        <PermissionGate module="vendors" action="delete"><button onClick={() => handleDelete(v.id)} className="act del" title="Delete" aria-label="Delete vendor"><Trash2 size={14} /></button></PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      </div>
    </div>
  );
}
