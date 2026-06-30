"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { alertDialog } from "@/components/Dialog";
import { Check, Sparkles } from "lucide-react";
import {
  defaultCycleConfig, CYCLE_STAGES, type BusinessProfile, type Cycle,
} from "@/lib/cycle-config";

const CYCLE_LABELS: Record<Cycle, string> = { sell: "Selling", buy: "Buying / Vendors", hr: "Team / HR" };

export default function BusinessSetupPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<BusinessProfile>({
    businessType: "service", sellsGoods: false, buysStock: false, hasEmployees: false, teamSize: "solo", separateGstInvoices: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { profile } = await apiGet<{ profile: BusinessProfile }>("/api/settings/business-setup");
        setProfile(profile);
      } catch { /* defaults are fine */ } finally { setLoading(false); }
    })();
  }, []);

  // Live preview of which stages this profile turns on.
  const preview = useMemo(() => defaultCycleConfig(profile), [profile]);

  async function save() {
    setSaving(true);
    try {
      await apiPost("/api/settings/business-setup", profile);
      router.push("/");
    } catch (e) {
      await alertDialog({ title: e instanceof Error ? e.message : "Failed to save" });
    } finally { setSaving(false); }
  }

  if (loading) return <p className="px-6 py-10 text-sm text-slate-500">Loading…</p>;

  return (
    <div>
      <PageHeader
        title="Business Setup"
        subtitle="Tell us how you work and we'll tailor QuoteGen — show only what you need. Change this anytime."
      />
      <div className="grid gap-6 px-6 pb-12 lg:grid-cols-[1fr_360px]">
        {/* ── Questions ── */}
        <div className="space-y-6">
          <Card title="What does your business mainly do?">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["service", "trading", "manufacturing", "mixed"] as const).map((t) => (
                <Choice key={t} active={profile.businessType === t} onClick={() => setProfile({ ...profile, businessType: t })}
                  label={t === "service" ? "Services" : t.charAt(0).toUpperCase() + t.slice(1)} />
              ))}
            </div>
          </Card>

          <Card title="A few quick questions">
            <Toggle label="Do you sell physical goods?" hint="Adds Sales Orders & Delivery Challans" checked={profile.sellsGoods} onChange={(v) => setProfile({ ...profile, sellsGoods: v })} />
            <Toggle label="Do you buy or stock inventory?" hint="Adds Purchase Orders, GRN & Debit Notes" checked={profile.buysStock} onChange={(v) => setProfile({ ...profile, buysStock: v })} />
            <Toggle label="Do you have employees?" hint="Adds Employees, Salary, ID Cards & F&F" checked={profile.hasEmployees} onChange={(v) => setProfile({ ...profile, hasEmployees: v })} />
            <Toggle label="Bill GST & non-GST invoices separately?" hint="Two invoice number series — auto-picked from each client's GSTIN" checked={!!profile.separateGstInvoices} onChange={(v) => setProfile({ ...profile, separateGstInvoices: v })} />
          </Card>

          <Card title="How big is your team?">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["solo", "small", "medium", "large"] as const).map((t) => (
                <Choice key={t} active={profile.teamSize === t} onClick={() => setProfile({ ...profile, teamSize: t })}
                  label={t === "solo" ? "Just me" : t === "small" ? "2–10" : t === "medium" ? "11–50" : "50+"} />
              ))}
            </div>
            <p className="mt-2 text-[12px] text-slate-400">Medium & large teams get approval workflows enabled.</p>
          </Card>

          <div className="flex justify-end">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              <Check size={16} /> {saving ? "Saving…" : "Save & apply"}
            </button>
          </div>
        </div>

        {/* ── Live preview ── */}
        <div className="lg:sticky lg:top-6 self-start rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-indigo-700"><Sparkles size={15} /> Your tailored workspace</p>
          {(Object.keys(CYCLE_STAGES) as Cycle[]).map((cycle) => {
            const on = new Set(preview[cycle].stages);
            const stages = CYCLE_STAGES[cycle].filter((s) => on.has(s.key));
            if (stages.length === 0) return null;
            return (
              <div key={cycle} className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{CYCLE_LABELS[cycle]}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {stages.map((s) => (
                    <span key={s.key} className="rounded-md bg-white px-2 py-1 text-[11.5px] font-medium text-slate-600 ring-1 ring-slate-200">{s.label}</span>
                  ))}
                </div>
              </div>
            );
          })}
          {(preview.sell.approvals || preview.buy.approvals) && (
            <p className="mt-2 text-[11.5px] font-semibold text-indigo-600">+ Approval workflows enabled</p>
          )}
          <p className="mt-3 text-[11px] text-slate-400">Turning something off later only hides it — your data is never deleted.</p>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="mb-3 text-[14px] font-bold text-slate-800">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Choice({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition ${active ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
      {label}
    </button>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-left">
      <span>
        <span className="block text-[13.5px] font-medium text-slate-700">{label}</span>
        <span className="block text-[12px] text-slate-400">{hint}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
