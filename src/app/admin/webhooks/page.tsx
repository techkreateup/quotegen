"use client";

import { useEffect, useState } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/platform/ui";
import { CheckCircle2, XCircle, AlertTriangle, Webhook } from "lucide-react";

interface EventRow {
  id: string;
  provider: string;
  event: string;
  signatureOk: boolean;
  responseCode: number;
  orderId: string | null;
  paymentId: string | null;
  companyId: string | null;
  error: string;
  createdAt: string;
}

export default function WebhooksAdminPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [failedOnly, setFailedOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const qs = new URLSearchParams({ provider: "razorpay", limit: "200" });
    if (failedOnly) qs.set("failed", "1");
    const r = await fetch(`/api/admin/webhooks?${qs}`);
    if (!r.ok) { setError("Failed to load events"); return; }
    setEvents((await r.json()).events);
  }
  useEffect(() => { void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [failedOnly]);

  async function expand(id: string) {
    if (expandedId === id) { setExpandedId(null); setExpandedData(null); return; }
    setExpandedId(id);
    setExpandedData(null);
    const r = await fetch(`/api/admin/webhooks/${id}`);
    if (r.ok) {
      const d = await r.json();
      setExpandedData(d.event);
    }
  }

  const fmt = (s: string) => new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const total = events?.length ?? 0;
  const failed = events?.filter((e) => !e.signatureOk || e.error).length ?? 0;
  const captured = events?.filter((e) => e.event === "payment.captured" || e.event === "subscription.charged").length ?? 0;

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Webhook events"
          subtitle="Inbound Razorpay events — signature check, response, payload. Useful for diagnosing missed payments or failed dunning."
          breadcrumbs={[{ label: "Platform" }, { label: "Webhooks" }]}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recent</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Captured / charged</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{captured}</p>
        </div>
        <button
          onClick={() => setFailedOnly((f) => !f)}
          className={`rounded-xl border p-3 text-left transition-colors ${failedOnly ? "border-rose-300 bg-rose-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600">Failed / handler errors</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{failed}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{failedOnly ? "Showing only failed" : "Click to filter"}</p>
        </button>
      </div>

      {error && <div role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2">{error}</div>}

      <Card title="Recent events">
        {events == null ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : events.length === 0 ? (
          <div className="py-10 text-center">
            <Webhook className="mx-auto text-slate-300 mb-2" size={28} />
            <p className="text-sm text-slate-500">No webhook events yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((e) => {
              const bad = !e.signatureOk;
              const warn = !bad && !!e.error;
              const Icon = bad ? XCircle : warn ? AlertTriangle : CheckCircle2;
              const iconColor = bad ? "text-rose-500" : warn ? "text-amber-500" : "text-emerald-500";
              return (
                <li key={e.id} className="py-2.5">
                  <button onClick={() => expand(e.id)} className="w-full flex items-start gap-3 text-left">
                    <Icon className={`shrink-0 mt-0.5 ${iconColor}`} size={16} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {e.event} <span className="text-slate-400 font-normal">· {e.responseCode}</span>
                        {!e.signatureOk && <span className="ml-2 text-[10px] uppercase font-bold text-rose-600">bad sig</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {fmt(e.createdAt)}
                        {e.orderId ? ` · order ${e.orderId.slice(-12)}` : ""}
                        {e.paymentId ? ` · pay ${e.paymentId.slice(-12)}` : ""}
                        {e.error ? ` · ${e.error}` : ""}
                      </p>
                    </div>
                  </button>
                  {expandedId === e.id && (
                    <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
                      {expandedData ? JSON.stringify(expandedData, null, 2) : "Loading…"}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PlatformShell>
  );
}
