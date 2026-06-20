"use client";

import { useEffect, useState } from "react";
import { Employee } from "@/lib/types";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { useRouter } from "next/navigation";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function GenerateSalaryPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [overrides, setOverrides] = useState<Record<string, { basicSalary: string; deductions: string; bonuses: string; notes: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Employee[]>("/api/employees").then((emps) => {
      const active = emps.filter((e) => e.status === "Active");
      setEmployees(active);
      setSelected(new Set(active.map((e) => e.id)));
    }).catch(() => {});
  }, []);

  const toggleAll = () => {
    if (selected.size === employees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(employees.map((e) => e.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const getOverride = (id: string, emp?: Employee) => overrides[id] || { basicSalary: String(emp?.salary ?? 0), deductions: "0", bonuses: "0", notes: "" };
  const setOverride = (id: string, field: string, value: string) => {
    setOverrides((p) => ({ ...p, [id]: { ...getOverride(id), [field]: value } }));
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const submit = async () => {
    if (selected.size === 0) { setError("Select at least one employee"); return; }
    setSaving(true);
    setError("");
    try {
      const promises = employees
        .filter((e) => selected.has(e.id))
        .map((e) => {
          const ov = getOverride(e.id, e);
          return apiPost("/api/salary", {
            employeeId: e.id,
            month,
            year,
            basicSalary: Number(ov.basicSalary) || 0,
            deductions: Number(ov.deductions) || 0,
            bonuses: Number(ov.bonuses) || 0,
            notes: ov.notes,
          });
        });
      await Promise.all(promises);
      router.push("/salary");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate salary records");
    } finally {
      setSaving(false);
    }
  };

  const totalPayroll = employees
    .filter((e) => selected.has(e.id))
    .reduce((s, e) => {
      const ov = getOverride(e.id, e);
      return s + (Number(ov.basicSalary) || 0) - (Number(ov.deductions) || 0) + (Number(ov.bonuses) || 0);
    }, 0);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Generate Salary"
        breadcrumbs={[{ label: "HR & Payroll" }, { label: "Salary", href: "/salary" }, { label: "Generate" }]}
      />

      {/* Period selector */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="block mt-1 text-[13px] border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 outline-none w-44"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="block mt-1 text-[13px] border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 outline-none w-28"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">Total Payroll</div>
            <div className="text-[22px] font-bold text-indigo-600 nums">{fmt(totalPayroll)}</div>
          </div>
        </div>
      </div>

      {/* Employee selection table */}
      <div className="card overflow-hidden w-full">
        <div className="px-4 py-3 border-b border-[#EEF0F6] sm:px-5" style={{ background: "#FAFBFD" }}>
          <span className="text-[12px] text-slate-400">{selected.size} of {employees.length} employees selected</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={selected.size === employees.length && employees.length > 0} onChange={toggleAll} />
                </th>
                <th>Employee</th>
                <th className="right">Basic Salary</th>
                <th className="right">Deductions</th>
                <th className="right">Bonuses</th>
                <th className="right">Net Salary</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      <p className="text-[13px] text-slate-400">No active employees found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((e) => {
                  const ov = getOverride(e.id, e);
                  const basic = Number(ov.basicSalary) || 0;
                  const net = basic - (Number(ov.deductions) || 0) + (Number(ov.bonuses) || 0);
                  return (
                    <tr key={e.id} style={{ opacity: selected.has(e.id) ? 1 : 0.4 }}>
                      <td>
                        <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                      </td>
                      <td>
                        <div>
                          <div className="font-semibold text-slate-900 text-[13px]">{e.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {e.employeeCode} · {e.designation || e.department || "—"}
                          </div>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={ov.basicSalary}
                          onChange={(e2) => setOverride(e.id, "basicSalary", e2.target.value)}
                          className="w-28 text-right text-[12px] border border-slate-200 rounded px-2 py-1 outline-none ml-auto block font-medium"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={ov.deductions}
                          onChange={(e2) => setOverride(e.id, "deductions", e2.target.value)}
                          className="w-24 text-right text-[12px] border border-slate-200 rounded px-2 py-1 outline-none ml-auto block"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={ov.bonuses}
                          onChange={(e2) => setOverride(e.id, "bonuses", e2.target.value)}
                          className="w-24 text-right text-[12px] border border-slate-200 rounded px-2 py-1 outline-none ml-auto block"
                        />
                      </td>
                      <td className="text-right font-bold nums text-[13px]">{fmt(net)}</td>
                      <td>
                        <input
                          type="text"
                          value={ov.notes}
                          onChange={(e2) => setOverride(e.id, "notes", e2.target.value)}
                          placeholder="Optional note"
                          className="w-32 text-[12px] border border-slate-200 rounded px-2 py-1 outline-none"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div className="text-red-600 text-[13px] font-medium">{error}</div>}

      <div className="flex items-center gap-3 justify-end">
        <button onClick={() => router.push("/salary")} className="btn btn-secondary">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn btn-primary">
          {saving ? "Generating…" : `Generate ${selected.size} Salary Record${selected.size !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
