"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import ModalPortal from "@/components/ModalPortal";
import { Plus, Search, Edit2, Trash2, Copy, Shield, X, Users, ChevronDown, ChevronRight, Zap, Eye, Lock } from "lucide-react";
import {
  MODULES, MODULE_CATEGORIES, MODULE_LABELS,
  getEmptyPermissions, type Permissions, type Module, type Action,
} from "@/lib/permissions";

interface Role {
  id: string; name: string; description: string;
  permissions: Permissions; isSystem: boolean;
  _count: { users: number }; createdAt: string;
}

const ACTIONS: Action[] = ["view", "create", "edit", "delete"];
const ACTION_LABELS: Record<Action, string> = { view: "View", create: "Create", edit: "Edit", delete: "Delete" };

const PERM_GRID = "grid grid-cols-[1fr_repeat(4,40px)_36px] sm:grid-cols-[1fr_repeat(4,64px)_56px]";
const PERM_GRID_HEADER = PERM_GRID;

const CATEGORY_COLORS: Record<string, { bg: string; text: string; accent: string; dot: string }> = {
  Sales:          { bg: "#EEF2FF", text: "#4F46E5", accent: "#C7D2FE", dot: "#6366F1" },
  "HR & Payroll": { bg: "#FFF7ED", text: "#C2410C", accent: "#FED7AA", dot: "#F97316" },
  Finance:        { bg: "#ECFDF5", text: "#047857", accent: "#A7F3D0", dot: "#10B981" },
  Admin:          { bg: "#FDF2F8", text: "#BE185D", accent: "#FBCFE8", dot: "#EC4899" },
};

function Toggle({ checked, onChange, small }: { checked: boolean; onChange: () => void; small?: boolean }) {
  const w = small ? 28 : 32;
  const h = small ? 16 : 18;
  const knob = small ? 12 : 14;
  return (
    <button
      type="button"
      onClick={onChange}
      className="role-toggle"
      style={{
        width: w, height: h, borderRadius: h / 2, padding: 2,
        background: checked ? "#4F46E5" : "#D1D5DB",
        border: "none", cursor: "pointer",
        transition: "background 150ms ease",
        display: "flex", alignItems: "center",
        flexShrink: 0,
      }}
    >
      <div style={{
        width: knob, height: knob, borderRadius: knob / 2,
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        transition: "transform 150ms ease",
        transform: checked ? `translateX(${w - knob - 4}px)` : "translateX(0)",
      }} />
    </button>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [perms, setPerms] = useState<Permissions>(getEmptyPermissions());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const load = async () => {
    try {
      const r = await apiGet<{ roles: Role[] }>("/api/settings/roles");
      setRoles(r.roles);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const filtered = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditRole(null);
    setForm({ name: "", description: "" });
    setPerms(getEmptyPermissions());
    setError("");
    setExpandedCats(Object.fromEntries(Object.keys(MODULE_CATEGORIES).map(c => [c, true])));
    setShowModal(true);
  };

  const openEdit = (r: Role) => {
    setEditRole(r);
    setForm({ name: r.name, description: r.description });
    setPerms(r.permissions || getEmptyPermissions());
    setError("");
    setExpandedCats(Object.fromEntries(Object.keys(MODULE_CATEGORIES).map(c => [c, true])));
    setShowModal(true);
  };

  const duplicate = (r: Role) => {
    setEditRole(null);
    setForm({ name: r.name + " (Copy)", description: r.description });
    setPerms(r.permissions || getEmptyPermissions());
    setError("");
    setExpandedCats(Object.fromEntries(Object.keys(MODULE_CATEGORIES).map(c => [c, true])));
    setShowModal(true);
  };

  const togglePerm = (mod: Module, action: Action) => {
    setPerms(p => ({ ...p, [mod]: { ...p[mod], [action]: !p[mod]?.[action] } }));
  };

  const toggleRow = (mod: Module) => {
    const allTrue = ACTIONS.every(a => perms[mod]?.[a]);
    setPerms(p => ({ ...p, [mod]: Object.fromEntries(ACTIONS.map(a => [a, !allTrue])) as Record<Action, boolean> }));
  };

  const toggleColumn = (action: Action) => {
    const allTrue = MODULES.every(m => perms[m]?.[action]);
    setPerms(p => {
      const next = { ...p };
      for (const m of MODULES) { next[m] = { ...next[m], [action]: !allTrue }; }
      return next;
    });
  };

  const toggleCategory = (modules: Module[]) => {
    const allTrue = modules.every(m => ACTIONS.every(a => perms[m]?.[a]));
    setPerms(p => {
      const next = { ...p };
      for (const m of modules) { next[m] = Object.fromEntries(ACTIONS.map(a => [a, !allTrue])) as Record<Action, boolean>; }
      return next;
    });
  };

  const applyPreset = (preset: "full" | "viewOnly" | "none") => {
    if (preset === "full") {
      setPerms(Object.fromEntries(MODULES.map(m => [m, { view: true, create: true, edit: true, delete: true }])) as Permissions);
    } else if (preset === "viewOnly") {
      setPerms(Object.fromEntries(MODULES.map(m => [m, { view: true, create: false, edit: false, delete: false }])) as Permissions);
    } else {
      setPerms(getEmptyPermissions());
    }
  };

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      if (editRole) {
        await apiPut(`/api/settings/roles/${editRole.id}`, { name: form.name, description: form.description, permissions: perms });
      } else {
        await apiPost("/api/settings/roles", { name: form.name, description: form.description, permissions: perms });
      }
      setShowModal(false);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setSaving(false);
  };

  const del = async (r: Role) => {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    try { await apiDelete(`/api/settings/roles/${r.id}`); load(); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const permCount = MODULES.reduce((sum, m) => sum + ACTIONS.filter(a => perms[m]?.[a]).length, 0);
  const totalPerms = MODULES.length * ACTIONS.length;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Role Management"
        subtitle="Create and manage team roles with custom permissions"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Roles" }]}
        action={<button onClick={openCreate} className="btn btn-primary"><Plus size={14} /> New Role</button>}
      />

      <div className="card" style={{ padding: "12px 16px" }}>
        <div className="search-box">
          <Search size={13} className="search-ico" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search roles..." className="search-inp" />
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th>Role Name</th>
                <th className="mob-hide">Description</th>
                <th>Users</th>
                <th className="mob-hide tab-hide">Type</th>
                <th className="mob-hide tab-hide">Created</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="mob-primary">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-indigo-500" />
                      <span className="font-medium" style={{ color: "var(--text-1)" }}>{r.name}</span>
                    </div>
                  </td>
                  <td className="mob-hide" style={{ maxWidth: 200 }}>{r.description || "—"}</td>
                  <td>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                      <Users size={10} /> {r._count.users}
                    </span>
                  </td>
                  <td className="mob-hide tab-hide">
                    {r.isSystem
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">SYSTEM</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500">CUSTOM</span>
                    }
                  </td>
                  <td className="mob-hide tab-hide">{fmtDate(r.createdAt)}</td>
                  <td className="mob-actions" style={{ textAlign: "right" }}>
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => openEdit(r)} className="act" title="Edit"><Edit2 size={14} /></button>
                      <button onClick={() => duplicate(r)} className="act" title="Duplicate"><Copy size={14} /></button>
                      {!r.isSystem && (
                        <button onClick={() => del(r)} className="act del" title="Delete"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-4)" }}>No roles found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ModalPortal>
          <div className="modal-bg">
            <div className="modal" style={{ maxWidth: 820, padding: 0 }}>
              {/* Header */}
              <div className="px-4 sm:px-7" style={{
                paddingTop: 20, paddingBottom: 16,
                borderBottom: "1px solid #E8EAEF",
                background: "linear-gradient(135deg, #FAFBFF 0%, #F5F3FF 100%)",
                borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
              }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
                    }}>
                      <Shield size={18} color="#fff" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em", margin: 0 }}>
                        {editRole ? "Edit Role" : "Create New Role"}
                      </h2>
                      <p style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>
                        {editRole ? "Modify role settings and permissions" : "Define access levels for your team members"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      border: "1px solid #E2E5EF", background: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "#94A3B8", transition: "all 150ms",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.color = "#475569"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#94A3B8"; }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="px-4 sm:px-7 py-5" style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
                {error && (
                  <div style={{
                    background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10,
                    padding: "12px 16px", fontSize: 13, color: "#DC2626", fontWeight: 500, marginBottom: 20,
                  }}>{error}</div>
                )}

                {editRole && editRole._count.users > 0 && (
                  <div style={{
                    background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10,
                    padding: "12px 16px", fontSize: 13, color: "#92400E", fontWeight: 500, marginBottom: 20,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <Users size={14} />
                    {editRole._count.users} user(s) have this role. Changes require re-login.
                  </div>
                )}

                {/* Role Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: "0.01em" }}>
                      Role Name <span style={{ color: "#DC2626" }}>*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="inp"
                      placeholder="e.g. Sales Manager"
                      disabled={editRole?.isSystem}
                      style={{ height: 40 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: "0.01em" }}>
                      Description
                    </label>
                    <input
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      className="inp"
                      placeholder="Brief description of this role"
                      style={{ height: 40 }}
                    />
                  </div>
                </div>

                {/* Permissions Section */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ marginBottom: 14 }}>
                    <div className="flex items-center gap-2.5">
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.01em", margin: 0 }}>
                        Permissions
                      </h3>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                        background: permCount === totalPerms ? "#DCFCE7" : permCount > 0 ? "#EEF2FF" : "#F1F5F9",
                        color: permCount === totalPerms ? "#16A34A" : permCount > 0 ? "#4F46E5" : "#94A3B8",
                      }}>
                        {permCount}/{totalPerms} enabled
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPreset("full")}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 6,
                          border: "1px solid #C7D2FE", background: "#EEF2FF", color: "#4F46E5",
                          cursor: "pointer", transition: "all 150ms", display: "flex", alignItems: "center", gap: 4,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#E0E7FF"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#EEF2FF"; }}
                      >
                        <Zap size={10} /> Full Access
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("viewOnly")}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 6,
                          border: "1px solid #E2E5EF", background: "#F8FAFC", color: "#64748B",
                          cursor: "pointer", transition: "all 150ms", display: "flex", alignItems: "center", gap: 4,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F1F5F9"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#F8FAFC"; }}
                      >
                        <Eye size={10} /> View Only
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("none")}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: "7px 12px", borderRadius: 6,
                          border: "1px solid #E2E5EF", background: "#F8FAFC", color: "#94A3B8",
                          cursor: "pointer", transition: "all 150ms", display: "flex", alignItems: "center", gap: 4,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F1F5F9"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#F8FAFC"; }}
                      >
                        <Lock size={10} /> No Access
                      </button>
                    </div>
                  </div>

                  {/* Column headers */}
                  <div className={PERM_GRID_HEADER} style={{
                    padding: "8px 10px", marginBottom: 2,
                  }}>
                    <div />
                    {ACTIONS.map(a => (
                      <div
                        key={a}
                        onClick={() => toggleColumn(a)}
                        style={{
                          fontSize: 10.5, fontWeight: 700, color: "#94A3B8",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          textAlign: "center", cursor: "pointer", transition: "color 150ms",
                          userSelect: "none",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#4F46E5"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#94A3B8"; }}
                      >
                        {ACTION_LABELS[a]}
                      </div>
                    ))}
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>
                      All
                    </div>
                  </div>

                  {/* Category sections */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(MODULE_CATEGORIES).map(([category, modules]) => {
                      const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Sales;
                      const expanded = expandedCats[category] !== false;
                      const catPermCount = modules.reduce((s, m) => s + ACTIONS.filter(a => perms[m]?.[a]).length, 0);
                      const catTotal = modules.length * ACTIONS.length;
                      const allCatOn = catPermCount === catTotal;

                      return (
                        <div key={category} style={{
                          border: "1px solid #E8EAEF", borderRadius: 12, overflow: "hidden",
                          background: "#fff",
                        }}>
                          {/* Category header */}
                          <div
                            style={{
                              display: "grid", gridTemplateColumns: "1fr auto",
                              padding: "10px 14px",
                              background: colors.bg,
                              cursor: "pointer", userSelect: "none",
                              borderBottom: expanded ? `1px solid ${colors.accent}` : "none",
                            }}
                            onClick={() => toggleCat(category)}
                          >
                            <div className="flex items-center gap-2.5">
                              {expanded
                                ? <ChevronDown size={14} style={{ color: colors.text }} />
                                : <ChevronRight size={14} style={{ color: colors.text }} />
                              }
                              <div style={{
                                width: 7, height: 7, borderRadius: 4, background: colors.dot, flexShrink: 0,
                              }} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{category}</span>
                              <span style={{
                                fontSize: 10, fontWeight: 600, color: colors.text, opacity: 0.7,
                                padding: "1px 6px", borderRadius: 4,
                                background: `${colors.text}10`,
                              }}>
                                {catPermCount}/{catTotal}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); toggleCategory(modules); }}
                              style={{
                                fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 5,
                                border: `1px solid ${colors.accent}`, background: allCatOn ? colors.text : "transparent",
                                color: allCatOn ? "#fff" : colors.text,
                                cursor: "pointer", transition: "all 150ms",
                              }}
                            >
                              {allCatOn ? "Revoke All" : "Grant All"}
                            </button>
                          </div>

                          {/* Module rows */}
                          {expanded && modules.map((mod, i) => {
                            const mp = perms[mod] || { view: false, create: false, edit: false, delete: false };
                            const allTrue = ACTIONS.every(a => mp[a]);
                            const anyTrue = ACTIONS.some(a => mp[a]);

                            return (
                              <div
                                key={mod}
                                className={PERM_GRID}
                                style={{
                                  padding: "9px 10px",
                                  alignItems: "center",
                                  borderBottom: i < modules.length - 1 ? "1px solid #F1F5F9" : "none",
                                  transition: "background 100ms",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = "#FAFBFF"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                              >
                                <div className="flex items-center gap-2">
                                  <div style={{
                                    width: 5, height: 5, borderRadius: 3, flexShrink: 0,
                                    background: anyTrue ? colors.dot : "#D1D5DB",
                                    transition: "background 150ms",
                                  }} />
                                  <span style={{ fontSize: 12.5, fontWeight: 500, color: anyTrue ? "#1E293B" : "#94A3B8", transition: "color 150ms" }}>
                                    {MODULE_LABELS[mod]}
                                  </span>
                                </div>
                                {ACTIONS.map(action => (
                                  <div key={action} style={{ display: "flex", justifyContent: "center" }}>
                                    <Toggle checked={mp[action] || false} onChange={() => togglePerm(mod, action)} />
                                  </div>
                                ))}
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                  <Toggle checked={allTrue} onChange={() => toggleRow(mod)} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-7" style={{
                padding: "12px 16px",
                borderTop: "1px solid #E8EAEF",
                background: "#FAFBFC",
                borderRadius: "0 0 var(--radius-xl) var(--radius-xl)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexWrap: "wrap", gap: 8,
              }}>
                <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>
                  {permCount > 0 ? `${permCount} permission${permCount > 1 ? "s" : ""} will be granted` : "No permissions selected"}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowModal(false)} className="btn btn-outline" style={{ height: 36, fontSize: 13 }}>Cancel</button>
                  <button
                    onClick={save}
                    disabled={saving || !form.name.trim()}
                    className="btn btn-primary"
                    style={{ height: 36, fontSize: 13, minWidth: 120 }}
                  >
                    {saving ? "Saving..." : editRole ? "Update Role" : "Create Role"}
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
