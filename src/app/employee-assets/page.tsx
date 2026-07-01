"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Employee } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Plus, X, Trash2, Package, Edit2 } from "lucide-react";
import ModalPortal from "@/components/ModalPortal";
import { confirmDialog } from "@/components/Dialog";
import { format } from "date-fns";

interface Asset { id: string; employeeId: string; employee?: { name: string; employeeCode: string }; assetType: string; tag: string; description: string; value: number; issuedDate: string; expectedReturn: string | null; returnedDate: string | null; status: string; recoveryAmount: number; notes: string; }

const TYPES = ["Laptop", "Mobile", "ID Card", "Vehicle", "Furniture", "Software", "Other"];
const STATUSES = ["Issued", "Returned", "Lost", "Damaged", "Recovered"];

export default function AssetsPage() {
  const [rows, setRows] = useState<Asset[]>([]);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Asset | null>(null);
  const [form, setForm] = useState({ employeeId: "", assetType: "Laptop", tag: "", description: "", value: 0, issuedDate: format(new Date(), "yyyy-MM-dd"), expectedReturn: "", status: "Issued", recoveryAmount: 0, notes: "" });
  const toast = useToast();

  const load = () => apiGet<Asset[]>("/api/employee-assets").then(setRows).catch(() => {});
  useEffect(() => { load(); apiGet<Employee[] | { data: Employee[] }>("/api/employees").then((d) => setEmps(Array.isArray(d) ? d : d.data)); }, []);

  function openNew() { setEdit(null); setForm({ employeeId: "", assetType: "Laptop", tag: "", description: "", value: 0, issuedDate: format(new Date(), "yyyy-MM-dd"), expectedReturn: "", status: "Issued", recoveryAmount: 0, notes: "" }); setShow(true); }
  function openEdit(a: Asset) {
    setEdit(a); setShow(true);
    setForm({ employeeId: a.employeeId, assetType: a.assetType, tag: a.tag, description: a.description, value: a.value, issuedDate: a.issuedDate?.split("T")[0] || "", expectedReturn: a.expectedReturn?.split("T")[0] || "", status: a.status, recoveryAmount: a.recoveryAmount, notes: a.notes });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (edit) await apiPut(`/api/employee-assets/${edit.id}`, form);
      else await apiPost("/api/employee-assets", form);
      setShow(false); load(); toast.success(edit ? "Updated" : "Asset issued");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function del(id: string) {
    if (await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this asset record?" })) apiDelete(`/api/employee-assets/${id}`).then(() => { load(); toast.success("Deleted"); });
  }

  const pending = rows.filter(r => r.status === "Issued" || r.status === "Lost" || r.status === "Damaged");

  return (
    <div className="w-full space-y-5">
      <PageHeader title="Employee Assets" breadcrumbs={[{ label: "HR & Payroll" }, { label: "Assets" }]}
        action={<button onClick={openNew} className="btn btn-primary"><Plus size={14} /> Issue Asset</button>} />

      <div className="flex flex-wrap gap-3">
        <div className="card p-4 flex-1 min-w-[180px]"><div className="text-[11.5px] font-semibold text-indigo-600">TOTAL ASSETS</div><div className="text-[22px] font-bold text-slate-900 mt-1 nums">{rows.length}</div></div>
        <div className="card p-4 flex-1 min-w-[180px]"><div className="text-[11.5px] font-semibold text-amber-600">PENDING RETURN</div><div className="text-[22px] font-bold text-slate-900 mt-1 nums">{pending.length}</div></div>
        <div className="card p-4 flex-1 min-w-[180px]"><div className="text-[11.5px] font-semibold text-emerald-600">ASSET VALUE (Open)</div><div className="text-[22px] font-bold text-slate-900 mt-1 nums">₹{pending.reduce((s, r) => s + (r.value || 0), 0).toLocaleString("en-IN")}</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Employee</th><th>Type</th><th>Tag</th><th className="right">Value</th><th>Issued</th><th>Expected Return</th><th>Status</th><th className="right">Recovery ₹</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9}><div className="empty"><div className="empty-icon"><Package size={36} color="#D1D5DB" /></div><h3 className="text-[15px] font-semibold text-slate-700 mt-3">No assets tracked yet</h3><p className="text-[13px] text-slate-400 mt-1">Track laptops, phones, ID cards and other items so unreturned items feed automatically into F&amp;F settlements.</p><button onClick={openNew} className="btn btn-primary mt-4"><Plus size={14} /> Issue Asset</button></div></td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <td><div className="font-semibold text-[13px] text-slate-900">{r.employee?.name || "—"}</div><div className="text-[11px] text-slate-400">{r.employee?.employeeCode}</div></td>
                  <td className="text-[12px]">{r.assetType}</td>
                  <td className="text-[12px] font-mono">{r.tag || "—"}</td>
                  <td className="right nums">₹{(r.value || 0).toLocaleString("en-IN")}</td>
                  <td className="text-[12px]">{r.issuedDate?.split("T")[0]}</td>
                  <td className="text-[12px]">{r.expectedReturn?.split("T")[0] || "—"}</td>
                  <td><span className="text-[11px] font-semibold rounded px-1.5 py-0.5" style={{ background: r.status === "Returned" || r.status === "Recovered" ? "#DCFCE7" : r.status === "Lost" || r.status === "Damaged" ? "#FEE2E2" : "#FEF3C7", color: r.status === "Returned" || r.status === "Recovered" ? "#166534" : r.status === "Lost" || r.status === "Damaged" ? "#991B1B" : "#92400E" }}>{r.status}</span></td>
                  <td className="right nums">{r.recoveryAmount ? `₹${r.recoveryAmount.toLocaleString("en-IN")}` : "—"}</td>
                  <td><div className="flex gap-1"><button onClick={() => openEdit(r)} className="act"><Edit2 size={14} /></button><button onClick={() => del(r.id)} className="act del"><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {show && (
        <ModalPortal>
          <div className="modal-bg">
            <div className="modal" style={{ maxWidth: 560 }}>
              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-[16px] font-bold">{edit ? "Edit Asset" : "Issue Asset"}</h2>
                <button onClick={() => setShow(false)} className="btn btn-ghost btn-icon"><X size={15} /></button>
              </div>
              <form onSubmit={submit} className="px-6 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="lbl">Employee *</label><select required value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="inp"><option value="">Select…</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>)}</select></div>
                  <div><label className="lbl">Type *</label><select value={form.assetType} onChange={e => setForm({ ...form, assetType: e.target.value })} className="inp">{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label className="lbl">Tag / Serial</label><input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} className="inp" placeholder="MB-2024-018" /></div>
                  <div><label className="lbl">Value ₹</label><input type="number" min={0} value={form.value} onChange={e => setForm({ ...form, value: Number(e.target.value) })} className="inp" /></div>
                  <div><label className="lbl">Issued Date *</label><input type="date" required value={form.issuedDate} onChange={e => setForm({ ...form, issuedDate: e.target.value })} className="inp" /></div>
                  <div><label className="lbl">Expected Return</label><input type="date" value={form.expectedReturn} onChange={e => setForm({ ...form, expectedReturn: e.target.value })} className="inp" /></div>
                  <div><label className="lbl">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="inp">{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label className="lbl">Recovery ₹ (at F&amp;F if unreturned)</label><input type="number" min={0} value={form.recoveryAmount} onChange={e => setForm({ ...form, recoveryAmount: Number(e.target.value) })} className="inp" /></div>
                </div>
                <div><label className="lbl">Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="inp" /></div>
                <div><label className="lbl">Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="inp" /></div>
                <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShow(false)} className="btn btn-outline">Cancel</button><button type="submit" className="btn btn-primary">{edit ? "Save" : "Issue"}</button></div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
