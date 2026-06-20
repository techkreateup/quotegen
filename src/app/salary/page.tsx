"use client";

import { useEffect, useState } from "react";
import { SalaryRecord } from "@/lib/types";
import { apiGet, apiDelete, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, Search, Trash2, CheckCircle, DollarSign, Eye, Download, Filter, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { downloadCSV } from "@/lib/csv";
import PermissionGate from "@/components/PermissionGate";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function SalaryPage() {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [showFilters, setShowFilters] = useState(false);

  const toast = useToast();

  const load = () => {
    const params = new URLSearchParams();
    if (filterMonth) params.set("month", filterMonth);
    if (filterYear) params.set("year", filterYear);
    apiGet<SalaryRecord[]>(`/api/salary?${params}`).then(setRecords).catch(() => {});
  };
  useEffect(() => { load(); }, [filterMonth, filterYear]);

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return (
      (r.employeeName?.toLowerCase().includes(q) || false) ||
      (r.employeeCode?.toLowerCase().includes(q) || false)
    );
  });

  const del = async (id: string) => {
    if (confirm("Delete this salary record? Associated voucher and transaction will also be removed.")) {
      try { await apiDelete(`/api/salary/${id}`); toast.success("Salary record deleted"); } catch { toast.error("Failed to delete"); }
      load();
    }
  };

  const process = async (id: string) => {
    if (confirm("Process salary and generate payment voucher?")) {
      try { await apiPost(`/api/salary/${id}/process`, {}); toast.success("Salary processed & voucher generated"); } catch { toast.error("Failed to process salary"); }
      load();
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const statusColor = (s: string) => {
    if (s === "Paid") return { bg: "#ECFDF5", text: "#059669" };
    if (s === "Processing") return { bg: "#FEF9C3", text: "#CA8A04" };
    return { bg: "#FEF2F2", text: "#DC2626" };
  };

  const totalNet = filtered.reduce((s, r) => s + r.netSalary, 0);
  const totalPaid = filtered.filter((r) => r.status === "Paid").reduce((s, r) => s + r.netSalary, 0);
  const totalPending = filtered.filter((r) => r.status === "Pending").reduce((s, r) => s + r.netSalary, 0);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Salary Management"
        breadcrumbs={[{ label: "HR & Payroll" }, { label: "Salary" }]}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {filtered.length > 0 && (
              <button onClick={() => downloadCSV(`salary-${filterYear || "all"}.csv`, ["Employee","Code","Period","Basic","Deductions","Bonuses","Net","Status"], filtered.map(r => [r.employeeName, r.employeeCode, `${MONTHS[r.month-1]} ${r.year}`, r.basicSalary, r.deductions, r.bonuses, r.netSalary, r.status]))} className="btn btn-outline">
                <Download size={14}/> Export
              </button>
            )}
            <PermissionGate module="salary" action="create"><Link href="/salary/new" className="btn btn-primary">
              <Plus size={14} /> Generate Salary
            </Link></PermissionGate>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Total Payroll", value: fmt(totalNet), color: "#6366F1" },
          { label: "Paid", value: fmt(totalPaid), color: "#059669" },
          { label: "Pending", value: fmt(totalPending), color: "#DC2626" },
        ].map((c) => (
          <div key={c.label} className="card" style={{ padding: "12px 10px" }}>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium uppercase tracking-wide">{c.label}</div>
            <div className="text-[16px] sm:text-[20px] font-bold mt-1 nums" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden w-full">
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5"
          style={{ background: "#FAFBFD" }}
        >
          <div className="flex items-center gap-2">
            <div className="hidden sm:contents">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none"
              >
                <option value="">All Months</option>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none"
              >
                <option value="">All Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`sm:hidden mob-filter-btn${filterMonth || filterYear !== String(new Date().getFullYear()) ? " has-filters" : ""}`}>
              <Filter size={14} /> Filter {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <span className="text-[12px] text-slate-400">{filtered.length} records</span>
          </div>
          <div className="search-box flex-1 sm:flex-none">
            <Search size={13} className="search-ico" />
            <input
              type="text"
              className="search-inp w-full sm:w-auto"
              placeholder="Search employee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {showFilters && (
          <div className="sm:hidden flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6]" style={{ background: "#FAFBFD" }}>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Month</label>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                <option value="">All Months</option>
                {MONTHS.map((m, i) => (<option key={i} value={i + 1}>{m}</option>))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] text-slate-500 font-semibold">Year</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-700 outline-none">
                <option value="">All Years</option>
                {years.map((y) => (<option key={y} value={y}>{y}</option>))}
              </select>
            </div>
          </div>
        )}

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th className="mob-hide tab-hide right">Basic</th>
                <th className="mob-hide tab-hide right">Deductions</th>
                <th className="mob-hide tab-hide right">Bonuses</th>
                <th className="right">Net Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty">
                      <div className="empty-icon">
                        <DollarSign size={20} />
                      </div>
                      <p className="text-[13px] text-slate-400">No salary records found.</p>
                      <Link href="/salary/new" className="mt-3 text-[12px] font-semibold text-indigo-600 hover:text-indigo-700">
                        + Generate salary records
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => {
                  const sc = statusColor(rec.status);
                  return (
                    <tr key={rec.id}>
                      <td className="mob-primary">
                        <div>
                          <div className="font-semibold text-slate-900 text-[13px]">{rec.employeeName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{rec.employeeCode}</div>
                        </div>
                      </td>
                      <td className="text-[13px]" data-label="Period">
                        {MONTHS[rec.month - 1]} {rec.year}
                      </td>
                      <td className="mob-hide tab-hide text-right nums text-[13px]">{fmt(rec.basicSalary)}</td>
                      <td className="mob-hide tab-hide text-right nums text-[13px] text-red-500">{rec.deductions ? `-${fmt(rec.deductions)}` : "—"}</td>
                      <td className="mob-hide tab-hide text-right nums text-[13px] text-green-600">{rec.bonuses ? `+${fmt(rec.bonuses)}` : "—"}</td>
                      <td className="text-right font-bold nums text-[13px]" data-label="Amt">{fmt(rec.netSalary)}</td>
                      <td>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="mob-actions">
                        <div className="flex items-center gap-0.5">
                          {rec.status === "Pending" && (
                            <PermissionGate module="salary" action="edit"><button onClick={() => process(rec.id)} className="act" title="Process & Pay">
                              <CheckCircle size={14} />
                            </button></PermissionGate>
                          )}
                          {rec.voucherId && (
                            <Link href={`/vouchers/view?id=${rec.voucherId}`} className="act" title="View Voucher">
                              <Eye size={14} />
                            </Link>
                          )}
                          <PermissionGate module="salary" action="delete"><button onClick={() => del(rec.id)} className="act del" title="Delete">
                            <Trash2 size={14} />
                          </button></PermissionGate>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
