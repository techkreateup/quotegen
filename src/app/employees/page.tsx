"use client";

import { useEffect, useState, useMemo } from "react";
import { Employee } from "@/lib/types";
import { apiGet, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Search, Edit2, Trash2, UserCircle, Filter, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import PermissionGate from "@/components/PermissionGate";
import { useToast } from "@/components/Toast";

const EMP_STATUSES = ["All", "Active", "Inactive"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "name-az", label: "Name A→Z" },
  { value: "salary-desc", label: "Salary High→Low" },
  { value: "salary-asc", label: "Salary Low→High" },
];

export default function EmployeesPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New filter states
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const load = async (p = page) => {
    try {
      const res = await apiGet<{ data: Employee[]; total: number; page: number; totalPages: number }>(`/api/employees?page=${p}&limit=20`);
      if (res) { setEmployees(res.data); setTotalPages(res.totalPages); setTotalCount(res.total); setPage(res.page); }
    } catch {}
  };
  useEffect(()=>{load();},[]);

  const handlePageChange = (p: number) => { load(p); };

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [employees]);

  const hasFilters = statusFilter !== "All" || search || deptFilter || sortBy !== "newest";

  const clearFilters = () => {
    setStatusFilter("All"); setSearch(""); setDeptFilter(""); setSortBy("newest");
  };

  const filtered = useMemo(() => {
    const list = employees
      .filter(e => statusFilter === "All" || e.status === statusFilter)
      .filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
        e.designation.toLowerCase().includes(search.toLowerCase()) ||
        e.department.toLowerCase().includes(search.toLowerCase())
      )
      .filter(e => !deptFilter || e.department === deptFilter);

    switch (sortBy) {
      case "name-az": list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "salary-desc": list.sort((a, b) => (b.salary || 0) - (a.salary || 0)); break;
      case "salary-asc": list.sort((a, b) => (a.salary || 0) - (b.salary || 0)); break;
      default: list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [employees, statusFilter, search, deptFilter, sortBy]);

  const del = async (id: string) => { if(confirm("Delete employee?")) { try{await apiDelete(`/api/employees/${id}`); toast.success("Employee deleted");}catch{ toast.error("Failed to delete employee"); } load(); } };
  const chStatus = async (id: string, s: Employee["status"]) => { try{await apiPut(`/api/employees/${id}`,{status:s});}catch{ toast.error("Failed to update status"); } load(); };

  const fmt = (n: number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);

  return (
    <div className="w-full space-y-6">
      <PageHeader title="Employees" breadcrumbs={[{label:"HR & Payroll"},{label:"Employees"}]}
        action={<PermissionGate module="employees" action="create"><Link href="/employees/new" className="btn btn-primary"><Plus size={14}/> Add Employee</Link></PermissionGate>} />

      <div className="card overflow-hidden w-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:pb-1" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {EMP_STATUSES.map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} className={`pill${statusFilter===s?" active":""}`}>{s}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasFilters && <button onClick={clearFilters} className="text-[11px] text-indigo-500 hover:text-indigo-700 cursor-pointer font-medium">Clear filters</button>}
              <span className="text-[12px] text-slate-400 hidden sm:block">{filtered.length} of {totalCount} employees</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="search-box flex-1 sm:flex-none">
              <Search size={13} className="search-ico"/>
              <input type="text" className="search-inp w-full sm:w-auto" placeholder="Search name, code, designation…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <button onClick={()=>setShowFilters(!showFilters)} className={`sm:hidden mob-filter-btn${sortBy !== "newest" || deptFilter ? " has-filters" : ""}`}>
              <Filter size={14}/>
              {showFilters ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            {departments.length > 0 && (
              <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none">
                <option value="">All Departments</option>
                {departments.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="hidden sm:block text-[12px] border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600 outline-none">
              {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {showFilters && (
            <div className="sm:hidden flex flex-col gap-3 pt-2 border-t border-[#EEF0F6]">
              <div>
                <label className="text-[12px] text-slate-500 font-semibold mb-1 block">Sort By</label>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-600 outline-none">
                  {SORT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {departments.length > 0 && (
                <div>
                  <label className="text-[12px] text-slate-500 font-semibold mb-1 block">Department</label>
                  <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="w-full h-[44px] text-[14px] border border-slate-200 rounded-[10px] px-3 bg-white text-slate-600 outline-none">
                    <option value="">All Departments</option>
                    {departments.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
              {(sortBy !== "newest" || deptFilter) && (
                <button onClick={()=>{setSortBy("newest");setDeptFilter("");}} className="text-[13px] text-indigo-500 hover:text-indigo-700 font-medium py-1">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead><tr>
              <th className="mob-hide tab-hide">Code</th><th>Employee</th><th>Designation</th><th className="tab-hide">Department</th><th className="tab-hide">Phone</th><th className="right tab-hide">Salary</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={8}><div className="empty"><div className="empty-icon"><UserCircle size={36} color="#D1D5DB"/></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No employees yet</h3><p className="text-[13px] text-slate-400 mt-1">Add your team members to manage payroll and generate vouchers.</p><Link href="/employees/new" className="btn btn-primary mt-4"><Plus size={14}/> Add Employee</Link></div></td></tr>
              ):filtered.map(emp=>(
                <tr key={emp.id}>
                  <td className="mob-hide tab-hide"><span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{emp.employeeCode}</span></td>
                  <td className="mob-primary" data-label="Employee">
                    <div className="flex items-center gap-2.5">
                      {emp.photoUrl?<img src={emp.photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0"/>:<div className="av av-md shrink-0 text-white" style={{background:"linear-gradient(135deg,#6366F1,#818CF8)"}}>{emp.name.charAt(0).toUpperCase()}</div>}
                      <div>
                        <div className="font-semibold text-slate-900 text-[13px]">{emp.name}</div>
                        <div className="text-[11px] text-slate-400">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-[13px]" data-label="Designation">{emp.designation||"—"}</td>
                  <td className="mob-hide tab-hide" data-label="Department">{emp.department?<span className="text-[11.5px] font-medium px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md">{emp.department}</span>:<span className="text-slate-300">—</span>}</td>
                  <td className="mob-hide tab-hide text-[12px]" data-label="Phone">{emp.phone||"—"}</td>
                  <td className="mob-hide tab-hide text-right font-bold nums text-[13px]" data-label="Salary">{emp.salary?fmt(emp.salary):"—"}</td>
                  <td data-label="Status">
                    <select value={emp.status} onChange={e=>chStatus(emp.id,e.target.value as Employee["status"])} className="text-[11px] border border-slate-200 rounded-md px-1.5 py-0.5 bg-white text-slate-500 outline-none cursor-pointer">
                      <option>Active</option><option>Inactive</option>
                    </select>
                  </td>
                  <td className="mob-actions">
                    <div className="flex items-center gap-0.5">
                      <PermissionGate module="employees" action="edit"><Link href={`/employees/new?id=${emp.id}`} className="act" title="Edit" aria-label="Edit employee"><Edit2 size={14}/></Link></PermissionGate>
                      <PermissionGate module="employees" action="delete"><button onClick={()=>del(emp.id)} className="act del" title="Delete" aria-label="Delete employee"><Trash2 size={14}/></button></PermissionGate>
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
