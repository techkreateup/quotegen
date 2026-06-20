"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { MODULE_LABELS, type Module } from "@/lib/permissions";
import { Plus, Trash2, Edit2, GitBranch, Copy, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface WorkflowStep {
  id: string; stepOrder: number; name: string; approverType: string;
  approverRoleId: string | null; approverUserId: string | null;
  approverRole?: { id: string; name: string } | null;
}

interface Workflow {
  id: string; name: string; description: string; module: string; trigger: string;
  triggerRoleIds: string[]; isActive: boolean; allowSelfApproval: boolean;
  steps: WorkflowStep[]; _count: { instances: number }; createdAt: string;
}

interface RoleOption { id: string; name: string }

export default function WorkflowsPage() {
  const toast = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    try {
      const [wf, r] = await Promise.all([
        apiGet<{ workflows: Workflow[] }>("/api/settings/workflows"),
        apiGet<{ roles: RoleOption[] }>("/api/settings/roles"),
      ]);
      setWorkflows(wf.workflows);
      setRoles(r.roles);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const del = async (wf: Workflow) => {
    if (!confirm(`Delete workflow "${wf.name}"?`)) return;
    try { await apiDelete(`/api/settings/workflows/${wf.id}`); toast.success("Workflow deleted"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to delete workflow"); }
  };

  const toggleActive = async (wf: Workflow) => {
    try {
      await apiPut(`/api/settings/workflows/${wf.id}`, { isActive: !wf.isActive });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to update workflow"); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Approval Workflows"
        subtitle="Create custom approval flows for module actions"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Workflows" }]}
        action={<Link href="/settings/workflows/new" className="btn btn-primary"><Plus size={14} /> New Workflow</Link>}
      />

      {workflows.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><GitBranch size={22} /></div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>No workflows yet</p>
            <p style={{ fontSize: 12, color: "var(--text-4)", marginBottom: 16 }}>Create approval workflows to require sign-off before actions are finalized</p>
            <Link href="/settings/workflows/new" className="btn btn-primary btn-sm">Create First Workflow</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map(wf => (
            <div key={wf.id} className="card">
              <div
                className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-2 sm:gap-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                style={{ padding: "14px 16px" }}
                onClick={() => setExpanded(expanded === wf.id ? null : wf.id)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: wf.isActive ? "var(--success)" : "var(--text-4)" }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{wf.name}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                        {MODULE_LABELS[wf.module as Module] || wf.module}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">
                        {wf.trigger.toUpperCase()}
                      </span>
                    </div>
                    {wf.description && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{wf.description}</div>}
                    <div className="flex items-center gap-3 mt-1 sm:hidden">
                      <span style={{ fontSize: 11, color: "var(--text-4)" }}>{wf.steps.length} step{wf.steps.length !== 1 ? "s" : ""}</span>
                      <span style={{ fontSize: 11, color: "var(--text-4)" }}>{fmtDate(wf.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <span className="hidden sm:inline" style={{ fontSize: 11, color: "var(--text-4)", flexShrink: 0 }}>{wf.steps.length} step{wf.steps.length !== 1 ? "s" : ""}</span>
                <span className="hidden sm:inline" style={{ fontSize: 11, color: "var(--text-4)", flexShrink: 0 }}>{fmtDate(wf.createdAt)}</span>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleActive(wf)} className={`pill ${wf.isActive ? "active" : ""}`} style={{ height: 26, fontSize: 10, padding: "0 10px" }}>
                    {wf.isActive ? "Active" : "Inactive"}
                  </button>
                  <Link href={`/settings/workflows/${wf.id}`} className="act" title="Edit"><Edit2 size={14} /></Link>
                  <button onClick={() => del(wf)} className="act del" title="Delete"><Trash2 size={14} /></button>
                </div>
                {expanded === wf.id ? <ChevronUp size={14} className="shrink-0" style={{ color: "var(--text-4)" }} /> : <ChevronDown size={14} className="shrink-0" style={{ color: "var(--text-4)" }} />}
              </div>

              {expanded === wf.id && (
                <div style={{ padding: "0 20px 16px", borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Approval Steps</div>
                  <div className="flex items-start gap-2 flex-wrap">
                    {wf.steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-2">
                        <div className="doc-from-box" style={{ padding: "8px 12px" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{step.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                            {step.approverType === "role" ? `Role: ${step.approverRole?.name || "—"}` : "Specific user"}
                          </div>
                        </div>
                        {i < wf.steps.length - 1 && <span style={{ color: "var(--text-4)", fontSize: 16 }}>→</span>}
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <span style={{ color: "var(--text-4)", fontSize: 16 }}>→</span>
                      <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "var(--radius)", padding: "8px 12px" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#059669" }}>Done</div>
                      </div>
                    </div>
                  </div>
                  {wf.triggerRoleIds.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-3)" }}>
                      Applies to roles: {wf.triggerRoleIds.map(rid => roles.find(r => r.id === rid)?.name || rid).join(", ")}
                    </div>
                  )}
                  {wf.triggerRoleIds.length === 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-4)" }}>Applies to all non-admin roles</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
