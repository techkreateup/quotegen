"use client";

import { useEffect, useState } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/platform/ui";
import { MessageSquare, Check, RotateCcw, Mail } from "lucide-react";

interface Ticket {
  id: string;
  name: string;
  email: string;
  subject: string;
  description: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
}

type Filter = "OPEN" | "RESOLVED" | "ALL";

export default function TicketsAdminPage() {
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [summary, setSummary] = useState<{ OPEN: number; RESOLVED: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load(f: Filter = filter) {
    setError("");
    const r = await fetch(`/api/admin/tickets?status=${f}`);
    if (!r.ok) { setError("Failed to load tickets"); return; }
    const d = await r.json();
    setTickets(d.tickets);
    setSummary(d.summary);
  }

  useEffect(() => { void load(filter); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [filter]);

  async function toggle(t: Ticket) {
    setBusyId(t.id);
    const next = t.status === "OPEN" ? "RESOLVED" : "OPEN";
    const r = await fetch(`/api/admin/tickets/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (r.ok) await load(filter);
    setBusyId(null);
  }

  const fmt = (s: string) => new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Support tickets"
          subtitle="Public-form submissions from /support/new. Open and Resolved counts include all time."
          breadcrumbs={[{ label: "Platform" }, { label: "Support tickets" }]}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {(["OPEN", "RESOLVED", "ALL"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl border p-3 text-left transition-colors ${filter === f ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{f}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">
              {f === "ALL"
                ? (summary ? summary.OPEN + summary.RESOLVED : "—")
                : (summary ? summary[f] : "—")}
            </p>
          </button>
        ))}
      </div>

      {error && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2">{error}</div>}

      <Card title={`${tickets?.length ?? 0} ticket${tickets?.length === 1 ? "" : "s"} shown`}>
        {tickets == null ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquare className="mx-auto text-slate-300 mb-2" size={28} />
            <p className="text-sm text-slate-500">No tickets in this view.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tickets.map((t) => {
              const isOpen = t.status === "OPEN";
              const isExp = expanded === t.id;
              return (
                <li key={t.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isOpen ? "bg-amber-500" : "bg-emerald-500"}`} />
                    <div className="flex-1 min-w-0">
                      <button onClick={() => setExpanded(isExp ? null : t.id)} className="text-left w-full">
                        <p className="text-sm font-semibold text-slate-800 truncate">{t.subject}</p>
                        <p className="text-[11.5px] text-slate-500 mt-0.5">
                          {t.name} · <a href={`mailto:${t.email}`} className="text-indigo-600 hover:underline">{t.email}</a> · {fmt(t.createdAt)}
                        </p>
                      </button>
                      {isExp && (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                          {t.description}
                          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
                            <a href={`mailto:${t.email}?subject=Re: ${encodeURIComponent(t.subject)}`} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-white">
                              <Mail size={12} /> Reply by email
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${isOpen ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{t.status}</span>
                      <button
                        onClick={() => toggle(t)}
                        disabled={busyId === t.id}
                        className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold disabled:opacity-50 ${isOpen ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"}`}
                      >
                        {isOpen ? <><Check size={12} /> Resolve</> : <><RotateCcw size={12} /> Reopen</>}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PlatformShell>
  );
}
