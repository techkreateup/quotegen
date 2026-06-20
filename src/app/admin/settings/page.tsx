"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/platform/ui";
import { Building2, Users, ShieldCheck, Bell, Database } from "lucide-react";

interface Me { name: string; email: string; platformRole: string }

export default function AdminSettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [retention, setRetention] = useState("15");
  const [savingRetention, setSavingRetention] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user ?? d)).catch(() => {});
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => { if (d.settings?.audit_retention_days) setRetention(String(d.settings.audit_retention_days)); })
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
