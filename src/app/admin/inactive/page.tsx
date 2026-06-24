"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card, EmptyRow } from "@/components/platform/ui";
import { Send, Clock } from "lucide-react";
import { confirmDialog, alertDialog } from "@/components/Dialog";

interface Row {
  id: string;
  name: string;
  createdAt: string;
  onboarded: boolean;
  adminEmail: string | null;
  lastSeen: string | null;
}

export default function InactiveCompaniesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch(`/api/admin/inactive?days=${days}`).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setRows(d.companies);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  async function nudge(companyIds?: string[]) {
    const label = companyIds ? "this company" : `all ${rows.length} inactive companies`;
    if (!(await confirmDialog({ title: "Please confirm", tone: "danger", message: `Re-engage ${label} across in-app banner + email + WhatsApp (where we have their details)? Auto-expires in 14 days, and companies already nudged are skipped.` }))) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/inactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days, companyIds }),
    });
    const d = await res.json();
    setBusy(false);
    if (res.ok)
      setMsg(
        `Nudged ${d.nudged} compan${d.nudged === 1 ? "y" : "ies"} (in-app) · ${d.emailed ?? 0} emailed · ${d.whatsapped ?? 0} on WhatsApp${d.skipped ? ` · skipped ${d.skipped} already nudged` : ""}.`
      );
    else setMsg(d.error || "Failed");
  }

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Re-engagement"
          subtitle="Track inactive companies and win them back across in-app, email & WhatsApp"
          breadcrumbs={[{ label: "Platform" }, { label: "Re-engagement" }]}
          action={
            <button onClick={() => nudge()} disabled={busy || rows.length === 0} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5">
              <Send size={14} /> Nudge all
            </button>
          }
        />
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
      {msg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{msg}</div>}

      <Card className="mb-4">
        <div className="flex items-center gap-3 text-sm">
          <Clock size={15} className="text-slate-400" />
          <span className="text-slate-500">Inactive means no activity for</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Inactivity window" className="h-9 px-2 rounded-lg border border-slate-300 text-sm">
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <span className="text-slate-400">· {rows.length} found</span>
        </div>
      </Card>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Admin</th>
                <th className="px-4 py-2.5">Onboarded</th>
                <th className="px-4 py-2.5">Last seen</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={5} label="Loading…" />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={5} label="No inactive companies 🎉" />
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/companies/${c.id}`} className="font-semibold text-indigo-600 hover:underline">{c.name}</Link>
                      <p className="text-xs text-slate-400">since {new Date(c.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.adminEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{c.onboarded ? <span className="text-emerald-600 font-semibold">Yes</span> : <span className="text-amber-600 font-semibold">No</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.lastSeen ? new Date(c.lastSeen).toLocaleDateString() : "never"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => nudge([c.id])} disabled={busy} className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                        <Send size={12} /> Nudge
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PlatformShell>
  );
}
