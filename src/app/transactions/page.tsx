"use client";

import { useEffect, useState, useCallback } from "react";
import { Transaction } from "@/lib/types";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  X,
  Landmark,
  TrendingUp,
  TrendingDown,
  LinkIcon,
  Download,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { downloadCSV } from "@/lib/csv";
import Pagination from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import ModalPortal from "@/components/ModalPortal";
import PermissionGate from "@/components/PermissionGate";
import { confirmDialog, alertDialog } from "@/components/Dialog";

const TYPES = ["Revenue", "Salary", "Subscription", "VendorPayment", "OfficeExpense", "Miscellaneous"] as const;
const DIRECTIONS = ["IN", "OUT"] as const;

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Revenue:       { bg: "#ECFDF5", text: "#059669" },
  Salary:        { bg: "#EFF6FF", text: "#2563EB" },
  Subscription:  { bg: "#FDF4FF", text: "#A855F7" },
  VendorPayment: { bg: "#FFF7ED", text: "#EA580C" },
  OfficeExpense: { bg: "#FEF9C3", text: "#CA8A04" },
  Miscellaneous: { bg: "#F1F5F9", text: "#64748B" },
};

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  type: "Miscellaneous" as string,
  category: "",
  description: "",
  amount: "",
  direction: "OUT" as string,
  notes: "",
};

export default function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState("");
  const [filterDir, setFilterDir] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback((pg?: number) => {
    const currentPage = pg ?? page;
    const p = new URLSearchParams();
    if (filterType) p.set("type", filterType);
    if (filterDir) p.set("direction", filterDir);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    p.set("page", String(currentPage));
    p.set("limit", "20");
    apiGet<{ data: Transaction[]; total: number; page: number; totalPages: number }>(`/api/transactions?${p}`)
      .then((res) => {
        if (res) { setRows(res.data); setTotalPages(res.totalPages); setTotalCount(res.total); setPage(res.page); }
      })
      .catch(() => {});
  }, [filterType, filterDir, dateFrom, dateTo, page]);

  useEffect(() => { load(1); }, [filterType, filterDir, dateFrom, dateTo]);

  const handlePageChange = (p: number) => { load(p); };

  /* ── client-side filter + sort ── */
  const displayRows = rows
    .filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.description.toLowerCase().includes(q) && !r.category.toLowerCase().includes(q)) return false;
      }
      if (amountMin && r.amount < Number(amountMin)) return false;
      if (amountMax && r.amount > Number(amountMax)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case "oldest": return (a.date || "") < (b.date || "") ? -1 : 1;
        case "amount-desc": return b.amount - a.amount;
        case "amount-asc": return a.amount - b.amount;
        default: return 0; // newest — server default
      }
    });

  const hasFilters = filterType || filterDir || dateFrom || dateTo || search || amountMin || amountMax;

  const clearAllFilters = () => {
    setFilterType(""); setFilterDir(""); setDateFrom(""); setDateTo("");
    setSearch(""); setSort("newest"); setAmountMin(""); setAmountMax("");
  };

  /* ── summaries ── */
  const totalIn = rows.filter((r) => r.direction === "IN").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.direction === "OUT").reduce((s, r) => s + r.amount, 0);
  const net = totalIn - totalOut;

  const fmt = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const fmtDate = (d: string) => {
    try {
      const dt = new Date(d + "T00:00:00");
      return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  };

  /* ── form ── */
  const openModal = () => {
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };
  const closeModal = () => setShowModal(false);

  const save = async () => {
    if (!form.date || !form.amount || !form.description) return;
    setSaving(true);
    try {
      await apiPost("/api/transactions", {
        date: form.date,
        type: form.type,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        direction: form.direction,
        notes: form.notes,
      });
      closeModal();
      load();
      toast.success("Transaction saved");
    } catch {
      toast.error("Failed to save transaction");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if ((await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this manual transaction?" }))) {
      try { await apiDelete(`/api/transactions/${id}`); toast.success("Transaction deleted"); } catch { toast.error("Failed to delete"); }
      load();
    }
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="Financial ledger — all income and expenses"
        breadcrumbs={[{ label: "Finance" }, { label: "Transactions" }]}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                downloadCSV(
                  `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Date", "Type", "Direction", "Category", "Description", "Amount", "Notes"],
                  rows.map((r) => [r.date?.slice(0, 10), r.type, r.direction, r.category, r.description, r.amount, r.notes])
                );
              }}
              className="btn btn-outline"
            >
              <Download size={14} /> Export CSV
            </button>
            <PermissionGate module="transactions" action="create"><button onClick={openModal} className="btn btn-primary">
              <Plus size={14} /> Add Transaction
            </button></PermissionGate>
          </div>
        }
      />

      {/* ── summary cards ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Total Income", value: fmt(totalIn), color: "#059669", icon: TrendingUp },
          { label: "Total Expenses", value: fmt(totalOut), color: "#DC2626", icon: TrendingDown },
          { label: "Net Balance", value: fmt(net), color: net >= 0 ? "#059669" : "#DC2626", icon: Landmark },
        ].map((c) => (
          <div key={c.label} className="card" style={{ padding: "12px 10px" }}>
            <div className="flex items-center gap-1.5">
              <c.icon size={13} className="max-sm:hidden" style={{ color: c.color }} />
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium uppercase tracking-wide">{c.label}</span>
            </div>
            <div className="text-[16px] sm:text-[20px] font-bold mt-1 nums" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── table card ── */}
      <div className="card overflow-hidden w-full">
        {/* filter bar */}
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5 flex-wrap"
          style={{ background: "#FAFBFD" }}
        >
          <div className="hidden sm:contents">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none"
            >
              <option value="">All Types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={filterDir}
              onChange={(e) => setFilterDir(e.target.value)}
              className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none"
            >
              <option value="">All Directions</option>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-slate-400">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-slate-400">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none"
              />
            </div>

            <select value={sort} onChange={(e) => setSort(e.target.value)} className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="amount-desc">Amount High→Low</option>
              <option value="amount-asc">Amount Low→High</option>
            </select>

            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-slate-400">Min</label>
              <input type="number" min="0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none w-20" placeholder="0" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-slate-400">Max</label>
              <input type="number" min="0" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none w-20" placeholder="∞" />
            </div>
          </div>

          <button onClick={() => setShowFilters(!showFilters)} className={`sm:hidden mob-filter-btn${filterType || filterDir || dateFrom || dateTo || sort !== "newest" || amountMin || amountMax ? " has-filters" : ""}`}>
            <Filter size={14} /> Filter {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <div className="search-box flex-1 sm:flex-none">
            <Search size={13} className="search-ico" />
            <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search description/category..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {hasFilters && (
            <button onClick={clearAllFilters} className="text-[11px] text-indigo-500 cursor-pointer hover:underline">Clear all</button>
          )}

          <span className="text-[12px] text-slate-400 ml-auto">{displayRows.length} of {totalCount} transactions</span>
        </div>

        {showFilters && (
          <div className="sm:hidden flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6]" style={{ background: "#FAFBFD" }}>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Type</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                <option value="">All Types</option>
                {TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Direction</label>
              <select value={filterDir} onChange={(e) => setFilterDir(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                <option value="">All Directions</option>
                {DIRECTIONS.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Sort</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="amount-desc">Amount High→Low</option>
                <option value="amount-asc">Amount Low→High</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-slate-500 font-semibold">Min Amount</label>
                <input type="number" min="0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" placeholder="0" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[12px] text-slate-500 font-semibold">Max Amount</label>
                <input type="number" min="0" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none" placeholder="∞" />
              </div>
            </div>
          </div>
        )}

        {/* table */}
        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="mob-hide tab-hide">Category</th>
                <th>Description</th>
                <th className="right">Amount</th>
                <th className="mob-hide tab-hide">Direction</th>
                <th className="mob-hide tab-hide">Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      <div className="empty-icon"><Landmark size={36} color="#D1D5DB" /></div>
                      <h3 className="text-[15px] font-semibold text-slate-700 mt-3">No transactions yet</h3>
                      <p className="text-[13px] text-slate-400 mt-1">Record income and expenses to track your business finances.</p>
                      <button onClick={openModal} className="btn btn-primary mt-4">
                        <Plus size={14} /> Add Transaction
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                displayRows.map((t) => {
                  const tc = TYPE_COLORS[t.type] || TYPE_COLORS.Miscellaneous;
                  const isManual = !t.referenceType;
                  return (
                    <tr key={t.id}>
                      <td data-label="Date">
                        <span className="text-[13px] text-slate-700 whitespace-nowrap">{fmtDate(t.date)}</span>
                      </td>
                      <td className="mob-primary">
                        <span
                          className="pill"
                          style={{ background: tc.bg, color: tc.text }}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="mob-hide tab-hide">
                        <span className="text-[13px] text-slate-600">{t.category}</span>
                      </td>
                      <td className="mob-primary">
                        <span className="text-[13px] text-slate-700 max-w-[260px] truncate block">{t.description}</span>
                      </td>
                      <td className="right" data-label="Amt">
                        <span
                          className="text-[13px] font-semibold nums"
                          style={{ color: t.direction === "IN" ? "#059669" : "#DC2626" }}
                        >
                          {t.direction === "IN" ? "+" : "-"}{fmt(t.amount)}
                        </span>
                      </td>
                      <td className="mob-hide tab-hide">
                        <span className="flex items-center gap-1 text-[12px]">
                          {t.direction === "IN" ? (
                            <ArrowDownLeft size={13} className="text-emerald-500" />
                          ) : (
                            <ArrowUpRight size={13} className="text-red-500" />
                          )}
                          <span className={t.direction === "IN" ? "text-emerald-600" : "text-red-600"}>
                            {t.direction}
                          </span>
                        </span>
                      </td>
                      <td className="mob-hide tab-hide">
                        {isManual ? (
                          <span className="text-[11px] text-slate-400 italic">Manual</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-indigo-500">
                            <LinkIcon size={10} /> {t.referenceType}
                          </span>
                        )}
                      </td>
                      <td className="mob-actions">
                        {isManual ? (
                          <PermissionGate module="transactions" action="delete"><button onClick={() => del(t.id)} className="act del" title="Delete" aria-label="Delete transaction">
                            <Trash2 size={13} />
                          </button></PermissionGate>
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      </div>

      {/* ── add transaction modal ── */}
      {showModal && (
        <ModalPortal>
        <div className="modal-bg" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="flex items-start justify-between px-5 sm:px-7 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Add Transaction</h2>
                <p className="text-[12px] text-slate-400 mt-0.5">Record a manual income or expense entry</p>
              </div>
              <button onClick={closeModal} className="btn btn-ghost btn-icon ml-4 mt-0.5">
                <X size={15} />
              </button>
            </div>

            <div className="px-5 sm:px-7 py-5 space-y-4">
              {/* date + type row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Date *</label>
                  <input
                    type="date"
                    className="inp"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="lbl">Type *</label>
                  <select
                    className="inp"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* category + direction */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Category</label>
                  <input
                    type="text"
                    className="inp"
                    placeholder="e.g. Office Rent"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
                <div>
                  <label className="lbl">Direction *</label>
                  <select
                    className="inp"
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value })}
                  >
                    <option value="IN">IN (Income)</option>
                    <option value="OUT">OUT (Expense)</option>
                  </select>
                </div>
              </div>

              {/* description */}
              <div>
                <label className="lbl">Description *</label>
                <input
                  type="text"
                  className="inp"
                  placeholder="Brief description of the transaction"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* amount */}
              <div>
                <label className="lbl">Amount (INR) *</label>
                <input
                  type="number"
                  className="inp"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              {/* notes */}
              <div>
                <label className="lbl">Notes</label>
                <textarea
                  className="inp"
                  rows={2}
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button onClick={closeModal} className="btn btn-outline">Cancel</button>
                <button
                  onClick={save}
                  disabled={saving || !form.date || !form.amount || !form.description}
                  className="btn btn-primary"
                >
                  {saving ? <><div className="spinner spinner-sm"/> Saving…</> : "Save Transaction"}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
