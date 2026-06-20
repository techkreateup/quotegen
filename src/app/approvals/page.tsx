"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import ModalPortal from "@/components/ModalPortal";
import { MODULE_LABELS, type Module } from "@/lib/permissions";
import { CheckCircle, XCircle, Clock, X } from "lucide-react";
import { useToast } from "@/components/Toast";

interface ApprovalItem {
  id: string;
  workflowId: string;
  entityId: string;
  entityType: string;
  status: string;
  currentStep: number;
  initiatedBy: string;
  createdAt: string;
  currentStepName: string;
  workflow: {
    name: string;
    module: string;
    trigger: string;
    steps: { stepOrder: number; name: string }[];
  };
  approvals: { stepOrder: number; approverId: string; decision: string; comments: string | null; decidedAt: string }[];
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{ item: ApprovalItem; decision: "approved" | "rejected" } | null>(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const load = async () => {
    try {
      const r = await apiGet<{ approvals: ApprovalItem[] }>("/api/approvals");
      setItems(r.approvals);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async () => {
    if (!actionModal) return;
    if (actionModal.decision === "rejected" && !comments.trim()) return;
    setSubmitting(true);
    try {
      await apiPost(`/api/approvals/${actionModal.item.id}`, {
        decision: actionModal.decision,
        comments: comments.trim() || undefined,
      });
      toast.success(actionModal.decision === "approved" ? "Approved successfully" : "Rejected");
      setActionModal(null);
      setComments("");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    setSubmitting(false);
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Pending Approvals"
        subtitle="Items waiting for your approval"
        breadcrumbs={[{ label: "Approvals" }]}
      />

      {loading ? (
        <div className="card">
          <div className="empty">
            <div className="spinner spinner-dark spinner-lg" />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon" style={{ background: "#ECFDF5" }}><CheckCircle size={22} style={{ color: "var(--success)" }} /></div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>All caught up!</p>
            <p style={{ fontSize: 12, color: "var(--text-4)" }}>No items pending your approval</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="card" style={{ padding: "16px 20px" }}>
              <div className="flex flex-col sm:flex-row items-start gap-3">
                <div className="av av-md" style={{ background: "#FFFBEB" }}>
                  <Clock size={16} style={{ color: "var(--warning)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{item.workflow.name}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                      {MODULE_LABELS[item.entityType as Module] || item.entityType}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                      {item.workflow.trigger.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
                    Entity: <span style={{ fontWeight: 600, color: "var(--text-2)" }}>#{item.entityId.slice(-8)}</span>
                    <span style={{ margin: "0 8px", color: "var(--text-4)" }}>·</span>
                    Submitted {fmtDate(item.createdAt)}
                  </div>

                  {/* Step progress */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {item.workflow.steps.map((step, i) => {
                      const approval = item.approvals.find(a => a.stepOrder === step.stepOrder);
                      const isCurrent = step.stepOrder === item.currentStep;
                      return (
                        <span key={i} className="flex items-center gap-1.5">
                          {i > 0 && <span style={{ color: "var(--text-4)", fontSize: 12 }}>→</span>}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            approval?.decision === "approved" ? "bg-green-50 text-green-700" :
                            approval?.decision === "rejected" ? "bg-red-50 text-red-700" :
                            isCurrent ? "bg-amber-50 text-amber-700" :
                            "bg-slate-50 text-slate-400"
                          }`} style={isCurrent ? { boxShadow: "0 0 0 1px #F59E0B" } : undefined}>
                            {step.name}
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  {/* Past approvals */}
                  {item.approvals.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {item.approvals.map((a, i) => (
                        <div key={i} style={{ fontSize: 11, color: "var(--text-3)" }}>
                          Step {a.stepOrder} — <span style={{ fontWeight: 600, color: a.decision === "approved" ? "var(--success)" : "var(--danger)" }}>{a.decision}</span>
                          {a.comments && <span style={{ color: "var(--text-4)" }}> — &ldquo;{a.comments}&rdquo;</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setActionModal({ item, decision: "approved" }); setComments(""); }}
                    className="btn btn-success btn-sm"
                  >
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button
                    onClick={() => { setActionModal({ item, decision: "rejected" }); setComments(""); }}
                    className="btn btn-danger-soft btn-sm"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <ModalPortal>
          <div className="modal-bg">
            <div className="modal" style={{ maxWidth: 440 }}>
              <div className="flex items-start justify-between px-4 sm:px-7 py-5 border-b border-slate-100">
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
                    {actionModal.decision === "approved" ? "Approve" : "Reject"} Item
                  </h2>
                  <p className="text-[12px] text-slate-400 mt-0.5">
                    {actionModal.decision === "approved"
                      ? "Add an optional comment for this approval."
                      : "Please provide a reason for rejection (required)."}
                  </p>
                </div>
                <button onClick={() => setActionModal(null)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
              </div>
              <div className="px-4 sm:px-7 py-5">
                <label className="lbl">{actionModal.decision === "approved" ? "Comments (optional)" : "Reason for rejection"}</label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder={actionModal.decision === "approved" ? "Optional comments..." : "Reason for rejection..."}
                  className="inp"
                  style={{ minHeight: 80 }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 px-4 sm:px-7 py-4 border-t border-slate-100">
                <button onClick={() => setActionModal(null)} className="btn btn-outline">Cancel</button>
                <button
                  onClick={handleAction}
                  disabled={submitting || (actionModal.decision === "rejected" && !comments.trim())}
                  className={actionModal.decision === "approved" ? "btn btn-success" : "btn btn-danger-soft"}
                  style={actionModal.decision === "rejected" ? { background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" } : undefined}
                >
                  {submitting ? "Processing..." : actionModal.decision === "approved" ? "Confirm Approve" : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
