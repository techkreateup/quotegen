"use client";

import { useEffect, useState } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export default function SupportUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const d = await fetch("/api/admin/support-users").then((r) => r.json());
    setUsers(d.users ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/support-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess(`${form.email} added — they'll set a new password on first login.`);
      setForm({ name: "", email: "", password: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    }
    setSaving(false);
  }

  async function toggle(u: StaffUser) {
    if (u.platformRole === "SUPER_ADMIN") return;
    await fetch(`/api/admin/support-users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    load();
  }

  const inputCls = "h-10 px-3 rounded-lg border border-slate-300 text-sm w-full";

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Support Team"
          subtitle="People who handle customer issues and onboarding"
          breadcrumbs={[{ label: "Platform", href: "/admin" }, { label: "Support Team" }]}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-3">Add support member</h2>
        {error && <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        {success && <div role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}
        <form onSubmit={addUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="su-name" className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
            <input id="su-name" required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="su-email" className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
            <input id="su-email" type="email" required className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="su-pass" className="block text-xs font-semibold text-slate-500 mb-1">Temp password</label>
            <input id="su-pass" required className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8+ chars, 1 upper, 1 num" />
          </div>
          <div className="flex items-end">
            <button disabled={saving} className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 w-full sm:w-auto">
              {saving ? "Adding…" : "Add member"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Last login</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{u.platformRole.replace("_", " ")}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "never"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {u.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.platformRole !== "SUPER_ADMIN" && (
                    <button onClick={() => toggle(u)} className="text-xs font-semibold text-indigo-600 hover:underline">
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}
