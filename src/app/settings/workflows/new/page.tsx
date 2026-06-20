"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { MODULE_LABELS, type Module } from "@/lib/permissions";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/Toast";

interface StepDef {
  name: string;
  approverType: "role" | "user";
  approverRoleId: string | null;
  approverUserId: string | null;
}

interface RoleOption { id: string; name: string }
interface UserOption { id: string; name: string; email: string }

const TRIGGER_OPTIONS = [
  { value: "create", label: "On Create" },
  { value: "edit", label: "On Edit" },
  { value: "delete", label: "On Delete" },
];

const WORKFLOW_MODULES: { value: string; label: string }[] = [
  "quotations", "invoices", "receipts", "credit-notes", "employees", "salary", "vouchers",
  "vendors", "subscriptions", "transactions", "projects",
].map(m => ({ value: m, label: MODULE_LABELS[m as Module] || m }));

export default function NewWorkflowPage() {
  const router = useRouter();
  const toast = useToast();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", description: "", module: "quotations", trigger: "create",
    triggerRoleIds: [] as string[], isActive: true, allowSelfApproval: false,
  });
  const [steps, setSteps] = useState<StepDef[]>([
    { name: "Approval", approverType: "role", approverRoleId: null, approverUserId: null },
  ]);

  useEffect(() => {
    Promise.all([
      apiGet<{ roles: RoleOption[] }>("/api/settings/roles"),
      apiGet<{ users: UserOption[] }>("/api/settings/users"),
    ]).then(([r, u]) => { setRoles(r.roles); setUsers(u.users); }).catch(() => {});
  }, []);

  const addStep = () => {
    setSteps(s => [...s, { name: `Step ${s.length + 1}`, approverType: "role", approverRoleId: null, approverUserId: null }]);
  };

  const removeStep = (i: number) => setSteps(s => s.filter((_, idx) => idx !== i));

  const updateStep = (i: number, patch: Partial<StepDef>) => {
    setSteps(s => s.map((st, idx) => idx === i ? { ...st, ...patch } : st));
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps(s => {
      const arr = [...s];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };

  const toggleTriggerRole = (roleId: string) => {
    setForm(f => ({
      ...f,
      triggerRoleIds: f.triggerRoleIds.includes(roleId)
        ? f.triggerRoleIds.filter(r => r !== roleId)
        : [...f.triggerRoleIds, roleId],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/settings/workflows", { ...form, steps });
      toast.success("Workflow created");
      router.push("/settings/workflows");
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    setSaving(false);
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="New Workflow"
        subtitle="Configure approval steps for a module action"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Workflows", href: "/settings/workflows" }, { label: "New" }]}
      />

      {/* Basic Info */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="sec-title">Basic Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="lbl">Workflow Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="inp" placeholder="e.g. Quotation Approval" />
          </div>
          <div>
            <label className="lbl">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="inp" placeholder="Optional description" />
          </div>
          <div>
            <label className="lbl">Module</label>
            <select value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className="inp">
              {WORKFLOW_MODULES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Trigger Action</label>
            <select value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))} className="inp">
              {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Trigger Roles */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="sec-title">Apply to Roles</h3>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>Select which roles trigger this workflow. Leave empty to apply to all non-admin roles.</p>
        <div className="flex flex-wrap gap-2">
          {roles.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => toggleTriggerRole(r.id)}
              className={`pill ${form.triggerRoleIds.includes(r.id) ? "active" : ""}`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="sec-title">Options</h3>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>Active immediately</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.allowSelfApproval} onChange={() => setForm(f => ({ ...f, allowSelfApproval: !f.allowSelfApproval }))}
              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600" />
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>Allow self-approval</span>
          </label>
        </div>
      </div>

      {/* Steps */}
      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="sec-title" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: "none" }}>Approval Steps</h3>
          <button onClick={addStep} className="btn btn-outline btn-sm"><Plus size={13} /> Add Step</button>
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="doc-from-box flex items-start gap-3">
              <div className="flex flex-col gap-1 shrink-0 pt-2">
                <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="act" style={{ width: 22, height: 22 }}><ChevronUp size={12} /></button>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-4)", textAlign: "center", display: "block" }}>{i + 1}</span>
                <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="act" style={{ width: 22, height: 22 }}><ChevronDown size={12} /></button>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="lbl">Step Name</label>
                  <input value={step.name} onChange={e => updateStep(i, { name: e.target.value })} className="inp" style={{ height: 36, fontSize: 13 }} />
                </div>
                <div>
                  <label className="lbl">Approver Type</label>
                  <select
                    value={step.approverType}
                    onChange={e => updateStep(i, { approverType: e.target.value as "role" | "user", approverRoleId: null, approverUserId: null })}
                    className="inp" style={{ height: 36, fontSize: 13 }}
                  >
                    <option value="role">Role</option>
                    <option value="user">Specific User</option>
                  </select>
                </div>
                <div>
                  <label className="lbl">{step.approverType === "role" ? "Approver Role" : "Approver User"}</label>
                  {step.approverType === "role" ? (
                    <select value={step.approverRoleId || ""} onChange={e => updateStep(i, { approverRoleId: e.target.value || null })} className="inp" style={{ height: 36, fontSize: 13 }}>
                      <option value="">Select role...</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  ) : (
                    <select value={step.approverUserId || ""} onChange={e => updateStep(i, { approverUserId: e.target.value || null })} className="inp" style={{ height: 36, fontSize: 13 }}>
                      <option value="">Select user...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              {steps.length > 1 && (
                <button onClick={() => removeStep(i)} className="act del" style={{ marginTop: 24 }}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>

        {/* Visual Preview */}
        {steps.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Flow Preview</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-700">Trigger</span>
              {steps.map((s, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span style={{ color: "var(--text-4)" }}>→</span>
                  <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold bg-amber-50 text-amber-700">{s.name || `Step ${i + 1}`}</span>
                </span>
              ))}
              <span style={{ color: "var(--text-4)" }}>→</span>
              <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold bg-green-50 text-green-700">Complete</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button onClick={() => router.push("/settings/workflows")} className="btn btn-outline">Cancel</button>
        <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? "Creating..." : "Create Workflow"}</button>
      </div>
    </div>
  );
}
