"use client";

import { useEffect, useState } from "react";
import { Subscription } from "@/lib/types";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Search, Edit2, Trash2, X, CreditCard, CalendarClock, RefreshCw, Filter, ChevronUp, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/Toast";
import ModalPortal from "@/components/ModalPortal";
import PermissionGate from "@/components/PermissionGate";

type SubWithCount = Subscription & { _count?: { payments: number } };

const CYCLES: Subscription["billingCycle"][] = ["Monthly", "Quarterly", "Yearly"];
const STATUSES: Subscription["status"][] = ["Active", "Cancelled", "Paused"];

const empty: Omit<Subscription, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  vendor: "",
  amount: 0,
  billingCycle: "Monthly",
  nextRenewalDate: new Date().toISOString().split("T")[0],
  status: "Active",
  notes: "",
};

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<SubWithCount[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [cycleFilter, setCycleFilter] = useState<string>("All");
  const [sort, setSort] = useState("newest");
  const [showPay, setShowPay] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, paidDate: new Date().toISOString().split("T")[0], notes: "" });
  const [showFilters, setShowFilters] = useState(false);

  const toast = useToast();
  const load = () => apiGet<SubWithCount[]>("/api/subscriptions").then(setSubs).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = subs.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || s.status === statusFilter;
    const matchCycle = cycleFilter === "All" || s.billingCycle === cycleFilter;
    return matchSearch && matchStatus && matchCycle;
  }).sort((a, b) => {
    switch (sort) {
      case "amount-desc": return b.amount - a.amount;
      case "renewal": return (a.nextRenewalDate || "9999") < (b.nextRenewalDate || "9999") ? -1 : 1;
      case "name-asc": return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  const close = () => { setShowForm(false); setEditingId(null); setForm(empty); };

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await apiPut(`/api/subscriptions/${editingId}`, form);
      } else {
        await apiPost("/api/subscriptions", form);
      }
      await load();
      close();
      toast.success(editingId ? "Subscription updated" : "Subscription added");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(s: SubWithCount) {
    setForm({
      name: s.name,
      vendor: s.vendor,
      amount: s.amount,
      billingCycle: s.billingCycle,
      nextRenewalDate: s.nextRenewalDate,
      status: s.status,
      notes: s.notes,
    });
    setEditingId(s.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this subscription and all its payments?")) {
      try { await apiDelete(`/api/subscriptions/${id}`); toast.success("Subscription deleted"); } catch { toast.error("Failed to delete"); }
      load();
    }
  }

  function openPay(s: SubWithCount) {
    setPayForm({ amount: s.amount, paidDate: new Date().toISOString().split("T")[0], notes: "" });
    setShowPay(s.id);
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!showPay) return;
    try {
      await apiPost(`/api/subscriptions/${showPay}/pay`, payForm);
      setShowPay(null);
      await load();
    } catch (err) {
      alert(String(err));
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const fmtDate = (d: string) => {
    try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
  };

  // Stats
  const activeSubs = subs.filter((s) => s.status === "Active");
  const totalActive = activeSubs.length;
  const monthlyCost = activeSubs.reduce((sum, s) => {
    if (s.billingCycle === "Monthly") return sum + s.amount;
    if (s.billingCycle === "Quarterly") return sum + s.amount / 3;
    if (s.billingCycle === "Yearly") return sum + s.amount / 12;
    return sum;
  }, 0);
  const annualCost = monthlyCost * 12;

  const statusCounts = {
    All: subs.length,
    Active: subs.filter((s) => s.status === "Active").length,
    Paused: subs.filter((s) => s.status === "Paused").length,
    Cancelled: subs.filter((s) => s.status === "Cancelled").length,
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Subscriptions"
        breadcrumbs={[{ label: "Finance" }, { label: "Subscriptions" }]}
        action={
          <PermissionGate module="subscriptions" action="create"><button onClick={() => { setForm(empty); setEditingId(null); setShowForm(true); }} className="btn btn-primary">
            <Plus size={14} /> Add Subscription
          </button></PermissionGate>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Active Subscriptions", shortLabel: "Active", value: String(totalActive), color: "#6366F1", icon: <RefreshCw size={16} /> },
          { label: "Monthly Cost", shortLabel: "Monthly", value: fmt(monthlyCost), color: "#059669", icon: <CreditCard size={16} /> },
          { label: "Annual Cost", shortLabel: "Annual", value: fmt(annualCost), color: "#DC2626", icon: <CalendarClock size={16} /> },
        ].map((c) => (
          <div key={c.label} className="card" style={{ padding: "12px 10px", borderLeft: `3px solid ${c.color}` }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium uppercase tracking-wide"><span className="sm:hidden">{c.shortLabel}</span><span className="max-sm:hidden">{c.label}</span></div>
                <div className="text-[16px] sm:text-[20px] font-bold mt-1 nums" style={{ color: c.color }}>{c.value}</div>
              </div>
              <div className="w-9 h-9 rounded-lg max-sm:hidden flex items-center justify-center" style={{ background: `${c.color}12`, color: c.color }}>
                {c.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <ModalPortal>
        <div className="modal-bg">
          <div className="modal">
            <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
                  {editingId ? "Edit Subscription" : "Add Subscription"}
                </h2>
                <p className="text-[12px] text-slate-400 mt-0.5">Fill in the subscription details below</p>
              </div>
              <button onClick={close} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 sm:px-7 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="lbl">Name *</label>
                  <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="inp" placeholder="e.g. AWS, Figma, Slack" />
                </div>
                <div>
                  <label className="lbl">Vendor</label>
                  <input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className="inp" placeholder="Vendor / Provider" />
                </div>
                <div>
                  <label className="lbl">Amount *</label>
                  <input required type="number" min="0" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="inp" placeholder="0.00" />
                </div>
                <div>
                  <label className="lbl">Billing Cycle</label>
                  <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value as Subscription["billingCycle"] })} className="inp">
                    {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Next Renewal Date *</label>
                  <input required type="date" value={form.nextRenewalDate} onChange={(e) => setForm({ ...form, nextRenewalDate: e.target.value })} className="inp" />
                </div>
                <div>
                  <label className="lbl">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Subscription["status"] })} className="inp">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="inp" placeholder="Optional notes..." />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={close} className="btn btn-outline" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><div className="spinner spinner-sm"/> Saving…</> : editingId ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Pay Modal */}
      {showPay && (
        <ModalPortal>
        <div className="modal-bg">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Record Payment</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  {subs.find((s) => s.id === showPay)?.name}
                </p>
              </div>
              <button onClick={() => setShowPay(null)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
            </div>
            <form onSubmit={handlePay} className="px-5 sm:px-7 py-5 space-y-4">
              <div>
                <label className="lbl">Amount *</label>
                <input required type="number" min="0" step="0.01" value={payForm.amount || ""} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} className="inp" />
              </div>
              <div>
                <label className="lbl">Payment Date *</label>
                <input required type="date" value={payForm.paidDate} onChange={(e) => setPayForm({ ...payForm, paidDate: e.target.value })} className="inp" />
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} rows={2} className="inp" placeholder="Optional notes..." />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setShowPay(null)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary"><CreditCard size={14} /> Record Payment</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } as React.CSSProperties}>
        {(["All", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`pill${statusFilter === s ? " active" : ""}`}
          >
            {s} <span className="text-[10px] opacity-60 ml-1">({statusCounts[s as keyof typeof statusCounts] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="card overflow-hidden w-full">
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5"
          style={{ background: "#FAFBFD" }}
        >
          <span className="text-[12px] text-slate-400">{filtered.length} of {subs.length} subscriptions</span>
          <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none">
            <option value="All">All Cycles</option>
            {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none">
            <option value="newest">Newest</option>
            <option value="amount-desc">Amount High→Low</option>
            <option value="renewal">Renewal soonest</option>
            <option value="name-asc">Name A→Z</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)} className={`sm:hidden mob-filter-btn${cycleFilter !== "All" || sort !== "newest" ? " has-filters" : ""}`}>
            <Filter size={14} /> Filter {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <div className="search-box flex-1 sm:flex-none">
            <Search size={13} className="search-ico" />
            <input
              type="text"
              className="search-inp w-full sm:w-auto"
              placeholder="Search subscriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {showFilters && (
          <div className="sm:hidden flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6]" style={{ background: "#FAFBFD" }}>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Billing Cycle</label>
              <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                <option value="All">All Cycles</option>
                {CYCLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Sort By</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                <option value="newest">Newest</option>
                <option value="amount-desc">Amount High→Low</option>
                <option value="renewal">Renewal soonest</option>
                <option value="name-asc">Name A→Z</option>
              </select>
            </div>
          </div>
        )}

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th>Name</th>
                <th className="mob-hide">Vendor</th>
                <th className="right">Amount</th>
                <th className="mob-hide tab-hide">Billing Cycle</th>
                <th>Next Renewal</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      <div className="empty-icon"><RefreshCw size={36} color="#D1D5DB" /></div>
                      <h3 className="text-[15px] font-semibold text-slate-700 mt-3">No subscriptions yet</h3>
                      <p className="text-[13px] text-slate-400 mt-1">Track recurring software and service subscriptions to manage expenses.</p>
                      <button
                        onClick={() => { setForm(empty); setEditingId(null); setShowForm(true); }}
                        className="btn btn-primary mt-4"
                      >
                        <Plus size={14} /> Add Subscription
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="mob-primary">
                      <div className="font-semibold text-slate-900 text-[13px]">{s.name}</div>
                    </td>
                    <td className="mob-hide text-[13px]">{s.vendor || <span className="text-slate-300">--</span>}</td>
                    <td className="text-right font-bold nums text-[13px]" data-label="Amt">{fmt(s.amount)}</td>
                    <td className="mob-hide tab-hide">
                      <span className="text-[11.5px] font-medium px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">
                        {s.billingCycle}
                      </span>
                    </td>
                    <td className="text-[12px]" data-label="Renewal">{fmtDate(s.nextRenewalDate)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="mob-actions">
                      <div className="flex items-center gap-0.5">
                        {s.status === "Active" && (
                          <PermissionGate module="subscriptions" action="edit"><button onClick={() => openPay(s)} className="act" title="Record Payment">
                            <CreditCard size={14} />
                          </button></PermissionGate>
                        )}
                        <PermissionGate module="subscriptions" action="edit"><button onClick={() => handleEdit(s)} className="act" title="Edit">
                          <Edit2 size={14} />
                        </button></PermissionGate>
                        <PermissionGate module="subscriptions" action="delete"><button onClick={() => handleDelete(s.id)} className="act del" title="Delete">
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
