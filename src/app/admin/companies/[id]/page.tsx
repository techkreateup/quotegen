"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PlatformShell from "@/components/platform/PlatformShell";
import { Card, Badge } from "@/components/platform/ui";
import { FEATURES, FEATURE_CATEGORIES, PLANS, PLAN_DEFS } from "@/lib/features";
import { ArrowLeft, Check, X, Download, Copy } from "lucide-react";
import { confirmDialog, alertDialog } from "@/components/Dialog";

interface Detail {
  company: {
    id: string;
    code: string | null;
    name: string;
    slug: string;
    plan: string;
    isActive: boolean;
    maxUsers: number | null;
    adminNotes: string;
    suspendedReason: string | null;
    createdAt: string;
    onboardingCompletedAt: string | null;
    features: Record<string, boolean>;
    settings: { businessName: string; email: string; phones: string[]; city: string; state: string; country: string } | null;
    users: { id: string; name: string; email: string; platformRole: string; isActive: boolean; lastLoginAt: string | null; userRole: { name: string } | null }[];
    _count: { clients: number; quotations: number; invoices: number; receipts: number; employees: number; issues: number };
  };
  recentEvents: { id: string; event: string; createdAt: string }[];
  payments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    planName: string | null;
    razorpayPaymentId: string | null;
    createdAt: string;
  }[];
}

type Tab = "overview" | "features" | "users" | "activity" | "billing" | "danger";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/admin/companies/${id}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Failed to load company"));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function patch(body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !(await confirmDialog({ title: "Please confirm", tone: "danger", message: confirmMsg }))) return;
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) load();
    else (await alertDialog({ title: "Notice", message: (await res.json()).error || "Failed" }));
  }

  const c = data?.company;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "features", label: "Features & Plan" },
    { key: "users", label: `Users (${c?.users.length ?? 0})` },
    { key: "activity", label: "Activity" },
    { key: "billing", label: `Billing (${data?.payments?.length ?? 0})` },
    { key: "danger", label: "Danger Zone" },
  ];

  return (
    <PlatformShell>
      <Link href="/admin/companies" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
        <ArrowLeft size={13} /> All companies
      </Link>
      {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
      {!c && !error && <p className="mt-6 text-slate-400">Loading…</p>}

      {c && (
        <>
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{c.name}</h1>
            {c.code && (
              <button onClick={() => navigator.clipboard?.writeText(c.code!)} title="Copy company ID"
                className="font-mono text-[11.5px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 inline-flex items-center gap-1">
                {c.code}<Copy size={11} />
              </button>
            )}
            <Badge tone={c.isActive ? "green" : "red"}>{c.isActive ? "Active" : "Disabled"}</Badge>
            <Badge tone="indigo">{c.plan}</Badge>
            <span className="text-xs text-slate-400">created {new Date(c.createdAt).toLocaleDateString()}</span>
            <a
              href={`/api/admin/companies/${c.id}/export`}
              className="ml-auto h-8 px-3 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 no-underline"
            >
              <Download size={13} /> Download details (JSON)
            </a>
          </div>

          {!c.isActive && c.suspendedReason && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              <strong>Disabled:</strong> {c.suspendedReason}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
            {tabs.map((tt) => (
              <button
                key={tt.key}
                onClick={() => setTab(tt.key)}
                className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  tab === tt.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {tt.label}
              </button>
            ))}
          </div>

          {tab === "overview" && <OverviewTab c={c} settings={c.settings} />}
          {tab === "features" && <FeaturesTab c={c} patch={patch} saving={saving} />}
          {tab === "users" && <UsersTab users={c.users} />}
          {tab === "activity" && <ActivityTab events={data!.recentEvents} />}
          {tab === "billing" && <BillingTab payments={data!.payments ?? []} reload={load} />}
          {tab === "danger" && <DangerTab c={c} patch={patch} saving={saving} />}
        </>
      )}
    </PlatformShell>
  );
}

function OverviewTab({ c, settings }: { c: Detail["company"]; settings: Detail["company"]["settings"] }) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {Object.entries({
          Clients: c._count.clients,
          Quotations: c._count.quotations,
          Invoices: c._count.invoices,
          Receipts: c._count.receipts,
          Employees: c._count.employees,
          Issues: c._count.issues,
        }).map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          </div>
        ))}
      </div>
      <Card title="Business profile">
        {settings ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <Row k="Business name" v={settings.businessName || "—"} />
            <Row k="Email" v={settings.email || "—"} />
            <Row k="Phone" v={settings.phones?.join(", ") || "—"} />
            <Row k="Location" v={[settings.city, settings.state, settings.country].filter(Boolean).join(", ") || "—"} />
            <Row k="Onboarding" v={c.onboardingCompletedAt ? `Completed ${new Date(c.onboardingCompletedAt).toLocaleDateString()}` : "Not completed"} />
            <Row k="Slug" v={c.slug} />
          </dl>
        ) : (
          <p className="text-sm text-slate-400">No business profile yet.</p>
        )}
      </Card>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-50 py-1">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-medium text-slate-700 text-right truncate">{v}</dd>
    </div>
  );
}

function FeaturesTab({ c, patch, saving }: { c: Detail["company"]; patch: (b: Record<string, unknown>, m?: string) => void; saving: boolean }) {
  return (
    <>
      {/* Plan + limits */}
      <Card title="Plan & limits" className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">Plan</span>
            <select
              value={c.plan}
              onChange={(e) => patch({ plan: e.target.value }, `Change plan to ${e.target.value}? (features unchanged)`)}
              className="h-9 px-2 rounded-lg border border-slate-300 text-sm"
            >
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <button
            onClick={() => patch({ plan: c.plan, applyPlanFeatures: true }, `Reset this company's features and seat limit to the ${c.plan} plan defaults? This overrides current per-company toggles.`)}
            disabled={saving}
            className="h-9 px-3 rounded-lg border border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-50"
          >
            Apply {c.plan} defaults
          </button>
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">Seat limit (blank = unlimited)</span>
            <input
              type="number"
              min={1}
              defaultValue={c.maxUsers ?? ""}
              onBlur={(e) => {
                const val = e.target.value.trim();
                const next = val === "" ? null : Number(val);
                if (next !== c.maxUsers) patch({ maxUsers: next });
              }}
              className="h-9 px-2 rounded-lg border border-slate-300 text-sm w-32"
            />
          </label>
        </div>
        <p className="text-xs text-slate-400 mt-3">{PLAN_DEFS[c.plan as keyof typeof PLAN_DEFS]?.description}</p>
      </Card>

      {/* Per-feature toggles */}
      <Card title="Feature access">
        <p className="text-sm text-slate-500 mb-4">Toggle individual features for this company. Changes apply within ~1 minute.</p>
        {FEATURE_CATEGORIES.map((cat) => {
          const feats = FEATURES.filter((f) => f.category === cat);
          if (feats.length === 0) return null;
          return (
            <div key={cat} className="mb-5">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{cat}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {feats.map((f) => {
                  const on = c.features[f.key] !== false;
                  return (
                    <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{f.label}</p>
                        <p className="text-xs text-slate-400 truncate">{f.description}</p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={on}
                        aria-label={`${on ? "Disable" : "Enable"} ${f.label}`}
                        disabled={saving}
                        onClick={() => patch({ featureOverrides: { [f.key]: !on } })}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}

function UsersTab({ users }: { users: Detail["company"]["users"] }) {
  return (
    <Card title={`Users (${users.length})`}>
      <ul className="divide-y divide-slate-100">
        {users.map((u) => (
          <li key={u.id} className="py-2.5 flex justify-between items-center gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{u.name} {!u.isActive && <span className="text-xs text-red-500">(inactive)</span>}</p>
              <Link href={`/admin/users?q=${encodeURIComponent(u.email)}`} className="text-xs text-indigo-500 hover:underline truncate">{u.email}</Link>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-slate-600">{u.userRole?.name ?? u.platformRole}</p>
              <p className="text-[11px] text-slate-400">{u.lastLoginAt ? `last login ${new Date(u.lastLoginAt).toLocaleDateString()}` : "never logged in"}</p>
            </div>
          </li>
        ))}
        {users.length === 0 && <p className="text-sm text-slate-400 py-2">No users.</p>}
      </ul>
    </Card>
  );
}

function ActivityTab({ events }: { events: Detail["recentEvents"] }) {
  return (
    <Card title="Recent activity">
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">No usage events yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {events.map((e) => (
            <li key={e.id} className="py-1.5 flex justify-between text-sm">
              <span className="text-slate-600">{e.event}</span>
              <span className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BillingTab({ payments, reload }: { payments: Detail["payments"]; reload: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const fmt = (paise: number, currency: string) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR" }).format(paise / 100);

  const toneFor = (s: string): "green" | "red" | "indigo" | "amber" =>
    s === "CAPTURED" ? "green" : s === "REFUNDED" ? "amber" : s === "FAILED" ? "red" : "indigo";

  async function refund(p: Detail["payments"][number]) {
    const ok = (await confirmDialog({ title: "Please confirm", tone: "danger", message: 
      `Refund ${fmt(p.amount, p.currency)} for ${p.planName ?? "this payment"}?\n\nThis issues a full Razorpay refund and cannot be undone.`
     }));
    if (!ok) return;
    setBusyId(p.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingPaymentId: p.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ tone: "ok", text: `Refund issued (${data.refundId ?? "ok"}).` });
        reload();
      } else {
        setMsg({ tone: "err", text: data.error || "Refund failed." });
      }
    } catch {
      setMsg({ tone: "err", text: "Refund request failed." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card title={`Payments (${payments.length})`}>
      {msg && (
        <div
          role="alert"
          className={`mb-3 rounded-lg border px-4 py-2.5 text-sm ${
            msg.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </div>
      )}
      {payments.length === 0 ? (
        <p className="text-sm text-slate-400">No billing payments yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {payments.map((p) => (
            <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {fmt(p.amount, p.currency)} <span className="font-normal text-slate-400">· {p.planName ?? "—"}</span>
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {new Date(p.createdAt).toLocaleString()}
                  {p.razorpayPaymentId ? ` · ${p.razorpayPaymentId}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={toneFor(p.status)}>{p.status}</Badge>
                {p.status === "CAPTURED" && (
                  <button
                    onClick={() => refund(p)}
                    disabled={busyId === p.id}
                    className="h-8 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                  >
                    {busyId === p.id ? "Refunding…" : "Refund"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DangerTab({ c, patch, saving }: { c: Detail["company"]; patch: (b: Record<string, unknown>, m?: string) => void; saving: boolean }) {
  const [notes, setNotes] = useState(c.adminNotes ?? "");
  const [reason, setReason] = useState("");
  return (
    <>
      <Card title="Internal notes" className="mb-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Platform-only notes about this company…"
          className="w-full rounded-lg border border-slate-300 text-sm p-2.5"
        />
        <button
          onClick={() => patch({ adminNotes: notes })}
          disabled={saving || notes === c.adminNotes}
          className="mt-2 h-9 px-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          Save notes
        </button>
      </Card>

      <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
        <h2 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
          {c.isActive ? <X size={15} /> : <Check size={15} />} {c.isActive ? "Disable company" : "Enable company"}
        </h2>
        <p className="text-sm text-slate-600 mb-3">
          {c.isActive
            ? "Disabling locks every user out at login and on every API call. Their data is preserved."
            : "Enabling restores access for all users in this company."}
        </p>
        {c.isActive && (
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (shown to admins)"
            className="h-9 px-3 rounded-lg border border-red-200 text-sm w-full max-w-md mb-2"
          />
        )}
        <button
          onClick={() => patch(
            { isActive: !c.isActive, suspendedReason: reason || undefined },
            `Are you sure you want to ${c.isActive ? "disable" : "enable"} "${c.name}"?`
          )}
          disabled={saving}
          className={`h-9 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${c.isActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
        >
          {c.isActive ? "Disable company" : "Enable company"}
        </button>
      </div>
    </>
  );
}
