"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Badge, EmptyRow } from "@/components/platform/ui";
import { Search, KeyRound, Unlock, UserCheck, UserX, Download } from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  isActive: boolean;
  locked: boolean;
  mustResetPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  company: { id: string; name: string } | null;
  userRole: { name: string } | null;
}

export default function UsersPage() {
  return (
    <Suspense>
      <UsersInner />
    </Suspense>
  );
}

function UsersInner() {
  const initialQ = useSearchParams().get("q") ?? "";
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      params.set("sort", sort);
      params.set("dir", dir);
      params.set("page", String(page));
      const d = await fetch(`/api/admin/users?${params}`).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setUsers(d.users);
      setPages(d.pages);
      setTotal(d.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [q, status, page, sort, dir]);

  useEffect(() => { load(); }, [status, page, sort, dir]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSort(col: string) {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(col); setDir("asc"); }
    setPage(1);
  }
  const caret = (col: string) => (sort === col ? (dir === "asc" ? " ▲" : " ▼") : "");

  async function act(u: UserRow, action: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(u.id);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    const d = await res.json();
    if (!res.ok) { alert(d.error || "Failed"); return; }
    if (d.tempPassword) {
      alert(`Temporary password for ${u.email}:\n\n${d.tempPassword}\n\nShare it securely — the user must reset it on next login.`);
    }
    load();
  }

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Users"
          subtitle={`${total} user${total === 1 ? "" : "s"} across all companies`}
          breadcrumbs={[{ label: "Platform" }, { label: "Users" }]}
          action={
            <a
              href={`/api/admin/users/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) })}`}
              className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 inline-flex items-center gap-1.5 no-underline"
            >
              <Download size={14} /> Export (CSV)
            </a>
          }
        />
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
              placeholder="Search name or email…"
              aria-label="Search users"
              className="h-9 pl-8 pr-3 rounded-lg border border-slate-300 text-sm w-full"
            />
          </div>
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} aria-label="Filter by status" className="h-9 px-2 rounded-lg border border-slate-300 text-sm">
            <option value="">All users</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
            <option value="locked">Locked</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2.5 cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("name")}>User{caret("name")}</th>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5 cursor-pointer select-none hover:text-slate-600" onClick={() => toggleSort("lastLoginAt")}>Last login{caret("lastLoginAt")}</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={6} label="Loading…" />
              ) : users.length === 0 ? (
                <EmptyRow colSpan={6} label="No users found" />
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {u.company ? <Link href={`/admin/companies/${u.company.id}`} className="text-indigo-600 hover:underline">{u.company.name}</Link> : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.userRole?.name ?? u.platformRole}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "never"}</td>
                    <td className="px-4 py-3">
                      {u.locked ? <Badge tone="amber">Locked</Badge> : u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Off</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.locked && (
                          <IconBtn title="Unlock account" disabled={busy === u.id} onClick={() => act(u, "unlock")}><Unlock size={14} /></IconBtn>
                        )}
                        <IconBtn title="Reset password" disabled={busy === u.id} onClick={() => act(u, "reset_password", `Reset password for ${u.email}? A temporary password will be generated.`)}><KeyRound size={14} /></IconBtn>
                        {u.isActive ? (
                          <IconBtn title="Deactivate" tone="red" disabled={busy === u.id} onClick={() => act(u, "deactivate", `Deactivate ${u.email}? They will be unable to log in.`)}><UserX size={14} /></IconBtn>
                        ) : (
                          <IconBtn title="Activate" tone="green" disabled={busy === u.id} onClick={() => act(u, "activate")}><UserCheck size={14} /></IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="p-3 flex items-center justify-between border-t border-slate-100 text-sm">
            <span className="text-slate-400">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40">Prev</button>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </PlatformShell>
  );
}

function IconBtn({ children, title, onClick, disabled, tone }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; tone?: "red" | "green" }) {
  const color = tone === "red" ? "hover:bg-red-50 hover:text-red-600 hover:border-red-200" : tone === "green" ? "hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200" : "hover:bg-slate-100 hover:text-slate-700";
  return (
    <button title={title} aria-label={title} onClick={onClick} disabled={disabled} className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors disabled:opacity-40 ${color}`}>
      {children}
    </button>
  );
}
