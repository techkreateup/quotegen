"use client";

import { useEffect, useState } from "react";
import { RecurringInvoice } from "@/lib/types";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/store";
import PageHeader from "@/components/PageHeader";
import { Plus, CalendarClock, Trash2, Edit2, Play, Pause, Zap } from "lucide-react";
import Link from "next/link";
import PermissionGate from "@/components/PermissionGate";
import { useToast } from "@/components/Toast";
import { confirmDialog, alertDialog } from "@/components/Dialog";

export default function RecurringInvoicesPage() {
  const toast = useToast();
  const [recurring, setRecurring] = useState<RecurringInvoice[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState("");

  async function loadData() {
    const rec = await apiGet<RecurringInvoice[]>("/api/recurring-invoices");
    setRecurring(rec);
  }

  useEffect(() => { loadData(); }, []);

  async function handleDelete(id: string) {
    if (!(await confirmDialog({ title: "Please confirm", tone: "danger", message: "Delete this recurring invoice?" }))) return;
    try { await apiDelete(`/api/recurring-invoices/${id}`); toast.success("Recurring invoice deleted"); }
    catch { toast.error("Failed to delete recurring invoice"); }
    loadData();
  }

  async function toggleActive(rec: RecurringInvoice) {
    try { await apiPut(`/api/recurring-invoices/${rec.id}`, { isActive: !rec.isActive }); }
    catch { toast.error("Failed to update recurring invoice"); }
    loadData();
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenResult("");
    try {
      const res = await apiPost<{ message: string; invoices: string[] }>("/api/recurring-invoices/generate", {});
      setGenResult(res.message);
      loadData();
    } catch (err) {
      setGenResult(err instanceof Error ? err.message : "Generation failed");
    }
    setGenerating(false);
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Recurring Invoices"
        breadcrumbs={[{ label: "Sales & Invoices" }, { label: "Recurring" }]}
        action={
          <div className="flex items-center gap-2">
            <button onClick={handleGenerate} disabled={generating} className="btn btn-success btn-sm">
              <Zap size={14} /> {generating ? "Generating..." : "Generate Due"}
            </button>
            <PermissionGate module="recurring-invoices" action="create"><Link href="/recurring-invoices/new" className="btn btn-primary btn-sm">
              <Plus size={14} /> New Recurring
            </Link></PermissionGate>
          </div>
        }
      />

      {genResult && (
        <div className="info-banner info-green">{genResult}</div>
      )}

      <div className="card overflow-hidden w-full">
        {recurring.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><CalendarClock size={22} /></div>
            <p className="text-[13px] text-slate-500 font-medium">No recurring invoices</p>
            <p className="text-[12px] text-slate-400 mt-1">Set up automated invoices that repeat on a schedule</p>
            <PermissionGate module="recurring-invoices" action="create"><Link href="/recurring-invoices/new" className="btn btn-primary btn-sm mt-4">
              <Plus size={14} /> Create First Recurring Invoice
            </Link></PermissionGate>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl tbl-cards">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Client</th>
                  <th className="mob-hide">Frequency</th>
                  <th>Next Due</th>
                  <th className="right">Amount</th>
                  <th>Status</th>
                  <th className="mob-hide tab-hide">Last Generated</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recurring.map((rec) => (
                  <tr key={rec.id}>
                    <td className="mob-primary font-medium text-slate-900">{rec.title}</td>
                    <td data-label="Client">{rec.clientName || "—"}</td>
                    <td className="mob-hide">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700">
                        {rec.frequency}
                      </span>
                    </td>
                    <td data-label="Due">{formatDate(rec.nextDueDate)}</td>
                    <td className="text-right nums font-medium" data-label="Amt">₹{rec.totalAmount.toFixed(2)}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        rec.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {rec.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="mob-hide tab-hide text-[12px] text-slate-500">
                      {rec.lastGeneratedAt ? formatDate(rec.lastGeneratedAt) : "Never"}
                    </td>
                    <td className="mob-actions">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button onClick={() => toggleActive(rec)} className="act" title={rec.isActive ? "Pause" : "Resume"}>
                          {rec.isActive ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <PermissionGate module="recurring-invoices" action="edit"><Link href={`/recurring-invoices/new?id=${rec.id}`} className="act"><Edit2 size={14} /></Link></PermissionGate>
                        <PermissionGate module="recurring-invoices" action="delete"><button onClick={() => handleDelete(rec.id)} className="act del"><Trash2 size={14} /></button></PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
