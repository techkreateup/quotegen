"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ModalPortal from "@/components/ModalPortal";
import { Plus, Search, Edit2, Trash2, KeyRound, Eye, X } from "lucide-react";
import Link from "next/link";
import { confirmDialog, alertDialog } from "@/components/Dialog";

interface Role { id: string; name: string }
interface User {
  id: string; name: string; email: string; isActive: boolean;
  roleId: string | null; userRole: Role | null;
  mustResetPassword: boolean; lastLoginAt: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "" });
  const [resetPw, setResetPw] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [u, r] = await Promise.all([
      apiGet<{ users: User[] }>("/api/settings/users"),
      apiGet<{ roles: Role[] }>("/api/settings/roles").catch(() => ({ roles: [] as Role[] })),
    ]);
    setUsers(u.users);
    setRoles(r.roles);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.userRole?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: "", email: "", password: "", roleId: roles[0]?.id || "" });
    setError("");
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: "", roleId: u.roleId || "" });
    setError("");
    setShowModal(true);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      if (editUser) {
        await apiPut(`/api/settings/users/${editUser.id}`, { name: form.name, email: form.email, roleId: form.roleId });
      } else {
        await apiPost("/api/settings/users", form);
      }
      setShowModal(false);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setSaving(false);
  };

  const del = async (u: User) => {
    if (!(await confirmDialog({ title: "Please confirm", tone: "danger", message: `Deactivate ${u.name}?` }))) return;
    try { await apiDelete(`/api/settings/users/${u.id}`); load(); }
    catch (e) { (await alertDialog({ title: "Notice", message: e instanceof Error ? e.message : String(e) })); }
  };

  const doReset = async () => {
    if (!resetUser) return;
    setSaving(true); setError("");
    try {
      await apiPost(`/api/settings/users/${resetUser.id}/reset-password`, { password: resetPw });
      setResetUser(null); setResetPw("");
      load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setSaving(false);
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage team members and their roles"
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Users" }]}
        action={<button onClick={openCreate} className="btn btn-primary"><Plus size={14} /> Add User</button>}
      />

      {/* Search */}
      <div className="card" style={{ padding: "12px 16px" }}>
        <div className="search-box">
          <Search size={13} className="search-ico" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="search-inp" />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl tbl-cards">
            <thead>
              <tr>
                <th>Name</th>
                <th className="mob-hide">Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="mob-hide tab-hide">Last Login</th>
                <th className="mob-hide tab-hide">Created</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td className="mob-primary font-medium" style={{ color: "var(--text-1)" }}>{u.name}</td>
                  <td data-label="Email" className="mob-hide">{u.email}</td>
                  <td>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700">
                      {u.userRole?.name || "No Role"}
                    </span>
                  </td>
                  <td><StatusBadge status={u.isActive ? "Active" : "Inactive"} /></td>
                  <td className="mob-hide tab-hide">{fmtDate(u.lastLoginAt)}</td>
                  <td className="mob-hide tab-hide">{fmtDate(u.createdAt)}</td>
                  <td className="mob-actions" style={{ textAlign: "right" }}>
                    <div className="flex items-center justify-end gap-0.5">
                      <Link href={`/settings/users/${u.id}`} className="act" title="View Details"><Eye size={14} /></Link>
                      <button onClick={() => openEdit(u)} className="act" title="Edit"><Edit2 size={14} /></button>
                      <button onClick={() => { setResetUser(u); setResetPw(""); setError(""); }} className="act" title="Reset Password"><KeyRound size={14} /></button>
                      <button onClick={() => del(u)} className="act del" title="Deactivate"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-4)" }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <ModalPortal>
          <div className="modal-bg">
            <div className="modal" style={{ maxWidth: 480 }}>
              <div className="flex items-start justify-between px-4 sm:px-4 sm:px-7 py-5 border-b border-slate-100">
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">{editUser ? "Edit User" : "Add User"}</h2>
                  <p className="text-[12px] text-slate-400 mt-0.5">{editUser ? "Update user details" : "Create a new team member"}</p>
                </div>
                <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
              </div>
              <div className="px-4 sm:px-4 sm:px-7 py-5 space-y-4">
                {error && <div className="info-banner" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 13 }}>{error}</div>}

                <div>
                  <label className="lbl">Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="inp" />
                </div>
                <div>
                  <label className="lbl">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="inp" />
                </div>
                {!editUser && (
                  <div>
                    <label className="lbl">Temporary Password</label>
                    <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="inp" placeholder="Min 8 chars, uppercase, lowercase, number" />
                  </div>
                )}
                <div>
                  <label className="lbl">Role</label>
                  <select value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))} className="inp">
                    <option value="">Select a role</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-4 sm:px-7 py-4 border-t border-slate-100">
                <button onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? "Saving..." : editUser ? "Update" : "Create"}</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <ModalPortal>
          <div className="modal-bg">
            <div className="modal" style={{ maxWidth: 420 }}>
              <div className="flex items-start justify-between px-4 sm:px-7 py-5 border-b border-slate-100">
                <div>
                  <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Reset Password</h2>
                  <p className="text-[12px] text-slate-400 mt-0.5">Set a new temporary password for <strong>{resetUser.name}</strong></p>
                </div>
                <button onClick={() => setResetUser(null)} className="btn btn-ghost btn-icon ml-4 mt-0.5"><X size={15} /></button>
              </div>
              <div className="px-4 sm:px-7 py-5 space-y-4">
                <p className="text-[13px] text-slate-500">They will be required to change it on next login.</p>
                {error && <div className="info-banner" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 13 }}>{error}</div>}
                <div>
                  <label className="lbl">New Temporary Password</label>
                  <input type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} className="inp" placeholder="Min 8 chars, uppercase, lowercase, number" />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-4 sm:px-7 py-4 border-t border-slate-100">
                <button onClick={() => setResetUser(null)} className="btn btn-outline">Cancel</button>
                <button onClick={doReset} disabled={saving} className="btn btn-primary">{saving ? "Resetting..." : "Reset Password"}</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
