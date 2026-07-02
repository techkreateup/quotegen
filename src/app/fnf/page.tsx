"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPost } from "@/lib/api";
import { Employee } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Plus, X, FileMinus, Eye } from "lucide-react";
import ModalPortal from "@/components/ModalPortal";
import { format } from "date-fns";

interface Row { id: string; employeeId: string; employee: { name: string; employeeCode: string; designation: string; department: string }; settlementDate: string; lastWorkingDate: string; exitReason: string; totalCredits: number; totalDeductions: number; netSettlement: number; status: string; }

export default function FnfPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ employeeId: "", exitReason: "Resignation", lastWorkingDate: format(new Date(), "yyyy-MM-dd"), noticeServedDays: 0, leaveBalanceDays: 0, bonusPending: 0, reimbursementsPending: 0, outstandingLoans: 0, professionalTax: 0, tds: 0, basicDaOverride: 0, notes: "" });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => apiGet<Row[]>("/api/fnf").then(setRows).catch(() => {});
  useEffect(() => { load(); apiGet<Employee[] | { data: Employee[] }>("/api/employees").then((d) => setEmps(Array.isArray(d) ? d : d.data)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await apiPost<Row>("/api/fnf", form);
      setShow(false); load();
      toast.success(`Draft ready — net ₹${r.netSettlement.toLocaleString("en-IN")}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  const totals = rows.reduce((s, r) => ({ credit: s.credit + r.totalCredits, ded: s.ded + r.totalDeductions, net: s.net + r.netSettlement }), { credit: 0, ded: 0, net: 0 });

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Full & Final Settlement" breadcrumbs={[{ label: "HR & Payroll" }, { label: "F&F" }]}
        action={<button onClick={() => setShow(true)} className="btn btn-primary"><Plus size={14} /> New F&amp;F</button>} />

      <div className="flex flex-wrap gap-3">
        <div className="card p-4 flex-1 min-w-[180px]"><div className="text-[11.5px] font-semibold text-emerald-600">TOTAL CREDITS</div><div className="text-[22px] font-bold text-slate-900 mt-1 nums">₹{Math.round(totals.credit).toLocaleString("en-IN")}</div></div>
        <div className="card p-4 flex-1 min-w-[180px]"><div className="text-[11.5px] font-semibold text-red-600">TOTAL DEDUCTIONS</div><div className="text-[22px] font-bold text-slate-900 mt-1 nums">₹{Math.round(totals.ded).toLocaleString("en-IN")}</div></div>
        <div className="card p-4 flex-1 min-w-[180px]"><div className="text-[11.5px] font-semibold text-indigo-600">NET PAYOUT</div><div className="text-[22px] font-bold text-slate-900 mt-1 nums">₹{Math.round(totals.net).toLocaleString("en-IN")}</div></div>
        <div className="card p-4 flex-1 min-w-[180px]"><div className="text-[11.5px] font-semibold text-slate-500">EXITS ON RECORD</div><div className="text-[22px] font-bold text-slate-900 mt-1 nums">{rows.length}</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Employee</th><th>Exit Reason</th><th>LWD</th><th className="right">Credits</th><th className="right">Deductions</th><th className="right">Net</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8}><div className="empty"><div className="empty-icon"><FileMinus size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No F&amp;F settlements yet</h3><p className="text-[13px] text-slate-400 mt-1">Draft an F&amp;F when an employee resigns — pro-rata salary, gratuity (Sec 10(10)), leave encashment (Sec 10(10AA)), notice recovery, and unreturned assets are computed automatically.</p><button onClick={() => setShow(true)} className="btn btn-primary mt-4"><Plus size={14} /> New F&amp;F</button></div></td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <td><div className="font-semibold text-[13px]">{r.employee.name}</div><div className="text-[11px] text-slate-400">{r.employee.employeeCode} · {r.employee.designation || "—"}</div></td>
                  <td className="text-[12px]">{r.exitReason}</td>
                  <td className="text-[12px]">{r.lastWorkingDate?.split("T")[0]}</td>
                  <td className="right nums text-emerald-600">₹{Math.round(r.totalCredits).toLocaleString("en-IN")}</td>
                  <td className="right nums text-red-600">−₹{Math.round(r.totalDeductions).toLocaleString("en-IN")}</td>
                  <td className="right nums font-bold">₹{Math.round(r.netSettlement).toLocaleString("en-IN")}</td>
                  <td><span className="text-[11px] font-semibold rounded px-1.5 py-0.5" style={{ background: r.status === "Paid" ? "#DCFCE7" : r.status === "Approved" ? "#DBEAFE" : "#F3F4F6", color: r.status === "Paid" ? "#166534" : r.status === "Approved" ? "#1E40AF" : "#4B5563" }}>{r.status}</span></td>
                  <td><Link href={`/fnf/view?id=${r.id}`} className="act"><Eye size={14} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {show && (
        <ModalPortal>
          <div className="modal-bg">
            <div className="modal" style={{ maxWidth: 620 }}>
              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
                <div><h2 className="text-[16px] font-bold">Draft F&amp;F Settlement</h2><p className="text-[12px] text-slate-400 mt-0.5">Values you enter here are used only for calculation. Nothing is paid automatically.</p></div>
                <button onClick={() => setShow(false)} className="btn btn-ghost btn-icon"><X size={15} /></button>
              </div>
              <form onSubmit={submit} className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="lbl">Employee *</label><select required value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="inp"><option value="">Select…</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}</select></div>
                  <div><label className="lbl">Exit Reason</label><select value={form.exitReason} onChange={e => setForm({ ...form, exitReason: e.target.value })} className="inp">{["Resignation", "Termination", "Retirement", "Absconded"].map(r => <option key={r}>{r}</option>)}</select></div>
                  <div><label className="lbl">Last Working Date *</label><input type="date" required value={form.lastWorkingDate} onChange={e => setForm({ ...form, lastWorkingDate: e.target.value })} className="inp" /></div>
                  <div><label className="lbl">Notice Days Served</label><input type="number" min={0} value={form.noticeServedDays} onChange={e => setForm({ ...form, noticeServedDays: Number(e.target.value) })} className="inp" /></div>
                  <div><label className="lbl">Unused Leave Days</label><input type="number" min={0} value={form.leaveBalanceDays} onChange={e => setForm({ ...form, leaveBalanceDays: Number(e.target.value) })} className="inp" /></div>
                  <div><label className="lbl">Basic+DA Override ₹ (blank = 50% of gross)</label><input type="number" min={0} value={form.basicDaOverride} onChange={e => setForm({ ...form, basicDaOverride: Number(e.target.value) })} className="inp" /></div>
                  <div><label className="lbl">Bonus Pending ₹</label><input type="number" min={0} value={form.bonusPending} onChange={e => setForm({ ...form, bonusPending: Number(e.target.value) })} className="inp" /></div>
                  <div><label className="lbl">Reimbursements Pending ₹</label><input type="number" min={0} value={form.reimbursementsPending} onChange={e => setForm({ ...form, reimbursementsPending: Number(e.target.value) })} className="inp" /></div>
                  <div><label className="lbl">Outstanding Loans ₹</label><input type="number" min={0} value={form.outstandingLoans} onChange={e => setForm({ ...form, outstandingLoans: Number(e.target.value) })} className="inp" /></div>
                  <div><label className="lbl">Professional Tax ₹</label><input type="number" min={0} value={form.professionalTax} onChange={e => setForm({ ...form, professionalTax: Number(e.target.value) })} className="inp" /></div>
                  <div><label className="lbl">TDS ₹</label><input type="number" min={0} value={form.tds} onChange={e => setForm({ ...form, tds: Number(e.target.value) })} className="inp" /></div>
                </div>
                <div><label className="lbl">Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="inp" /></div>
                <p className="text-[11px] text-slate-400">Unreturned assets are picked up automatically from Employee Assets and added to Deductions.</p>
                <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShow(false)} className="btn btn-outline" disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Calculating…" : "Compute & Save Draft"}</button></div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
