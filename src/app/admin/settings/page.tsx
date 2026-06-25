"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/platform/ui";
import { Building2, Users, ShieldCheck, Bell, Database, Receipt } from "lucide-react";

interface Me { name: string; email: string; platformRole: string }

export default function AdminSettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [retention, setRetention] = useState("15");
  const [savingRetention, setSavingRetention] = useState(false);
  const [gstRate, setGstRate] = useState("18");
  const [gstState, setGstState] = useState("Tamil Nadu");
  const [gstin, setGstin] = useState("");
  const [savingGst, setSavingGst] = useState(false);
  const [gstError, setGstError] = useState("");
  const [gstSaved, setGstSaved] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user ?? d)).catch(() => {});
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.audit_retention_days) setRetention(String(d.settings.audit_retention_days));
        if (d.settings?.platform_gst_rate) setGstRate(String(Math.round(Number(d.settings.platform_gst_rate) * 100)));
        if (d.settings?.platform_gst_state) setGstState(String(d.settings.platform_gst_state));
        if (d.settings?.platform_gstin) setGstin(String(d.settings.platform_gstin));
      })
      .catch(() => {});
  }, []);

  async function changeRetention(value: string) {
    setRetention(value);
    setSavingRetention(true);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "audit_retention_days", value }),
    }).catch(() => {});
    setSavingRetention(false);
  }

  async function saveGst() {
    setSavingGst(true); setGstError(""); setGstSaved(false);
    const rateNum = Number(gstRate) / 100;
    const items: Array<{ key: string; value: string }> = [
      { key: "platform_gst_rate", value: String(rateNum) },
      { key: "platform_gst_state", value: gstState.trim() },
      { key: "platform_gstin", value: gstin.trim().toUpperCase() },
    ];
    for (const item of items) {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setGstError(e.error || "Failed to save GST settings");
        setSavingGst(false);
        return;
      }
    }
    setGstSaved(true);
    setSavingGst(false);
    setTimeout(() => setGstSaved(false), 2500);
  }

  const links = [
    { href: "/admin/support-users", label: "Support Team", desc: "Add or manage support staff", icon: ShieldCheck },
    { href: "/admin/companies", label: "Companies", desc: "Manage every tenant", icon: Building2 },
    { href: "/admin/users", label: "Users", desc: "Global user directory", icon: Users },
    { href: "/admin/announcements", label: "Announcements", desc: "Broadcast to companies", icon: Bell },
  ];

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Settings"
          subtitle="Your platform admin account and configuration"
          breadcrumbs={[{ label: "Platform" }, { label: "Settings" }]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Your account">
          <dl className="text-sm space-y-2">
            <div className="flex justify-between border-b border-slate-50 py-1"><dt className="text-slate-400">Name</dt><dd className="font-medium text-slate-700">{me?.name ?? "…"}</dd></div>
            <div className="flex justify-between border-b border-slate-50 py-1"><dt className="text-slate-400">Email</dt><dd className="font-medium text-slate-700">{me?.email ?? "…"}</dd></div>
            <div className="flex justify-between border-b border-slate-50 py-1"><dt className="text-slate-400">Role</dt><dd className="font-medium text-slate-700">{me?.platformRole ?? "…"}</dd></div>
          </dl>
          <Link href="/forgot-password" className="inline-block mt-3 text-xs font-semibold text-indigo-600 hover:underline">
            Reset password →
          </Link>
        </Card>

        <Card title="Platform configuration">
          <p className="text-sm text-slate-500 mb-3">
            Email delivery, JWT secret, and the database connection are configured via environment variables on the server
            (see <code className="text-xs bg-slate-100 px-1 rounded">SAAS_GUIDE.md</code>). Feature bundles are defined in code at
            <code className="text-xs bg-slate-100 px-1 rounded ml-1">src/lib/features.ts</code>.
          </p>
          <Link href="/admin/plans" className="text-xs font-semibold text-indigo-600 hover:underline">View plan definitions →</Link>
        </Card>

        <Card title="GST on subscription invoices">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Receipt size={16} /></span>
            <div className="flex-1 space-y-3">
              <p className="text-xs text-slate-500">
                Applied to every Razorpay capture. Customer's company state matches provider state → CGST+SGST (split 50/50); otherwise → IGST.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-500">GST rate (%)</span>
                  <input
                    type="number" min={0} max={50} step={0.5}
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                    className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-300 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Provider state</span>
                  <input
                    type="text"
                    value={gstState}
                    onChange={(e) => setGstState(e.target.value)}
                    className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-300 text-sm"
                    placeholder="Tamil Nadu"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Provider GSTIN</span>
                  <input
                    type="text" maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-300 text-sm font-mono"
                    placeholder="33ABCDE1234F1Z5"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={saveGst}
                  disabled={savingGst}
                  className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingGst ? "Saving…" : "Save GST settings"}
                </button>
                {gstSaved && <span className="text-xs text-emerald-600 font-semibold">Saved ✓</span>}
                {gstError && <span className="text-xs text-rose-600">{gstError}</span>}
              </div>
              <p className="text-[11px] text-slate-400">
                Rate is applied as GST-inclusive: the amount Razorpay charges = taxable + GST. Set 0 to disable GST entirely.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Audit & data retention">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Database size={16} /></span>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">Audit log retention</span>
                <select
                  value={retention}
                  onChange={(e) => changeRetention(e.target.value)}
                  disabled={savingRetention}
                  aria-label="Audit log retention period"
                  className="h-9 px-2 rounded-lg border border-slate-300 text-sm disabled:opacity-50"
                >
                  <option value="15">15 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Currently <strong>{retention} days</strong>. Logs older than this are permanently deleted daily at 3:00 AM UTC.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Quick links">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Icon size={16} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{l.label}</span>
                  <span className="block text-xs text-slate-400">{l.desc}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </Card>
    </PlatformShell>
  );
}
