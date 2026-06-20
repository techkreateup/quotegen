"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Sparkles, Check, Gem, Clock } from "lucide-react";
import { formatPlanPrice } from "@/lib/features";

interface PlanDef {
  name: string;
  description: string;
  features: string[];
  maxUsers: number | null;
  comingSoon: boolean;
  price: string;
  priceInPaise: number;
  billingPeriod: string;
  trialDurationDays: number;
}
interface PublicPlans {
  plans: PlanDef[];
  premium: string[];
  launch: { freeMonths: number; tagline: string; teaser: string; freeNote: string };
  features: { key: string; label: string }[];
}
interface PlanInfo { plan: string; maxUsers: number | null; seatsUsed: number; createdAt: string }

export default function TenantPlansPage() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [pub, setPub] = useState<PublicPlans | null>(null);

  useEffect(() => {
    fetch("/api/plan").then((r) => r.json()).then((d) => (d.error ? null : setInfo(d))).catch(() => {});
    fetch("/api/plans/public").then((r) => r.json()).then(setPub).catch(() => {});
  }, []);

  const launch = pub?.launch;
  const labelOf = (k: string) => pub?.features.find((f) => f.key === k)?.label ?? k;

  // Free-access window is admin-configured on the Free plan (days). Fall back to
  // the launch's freeMonths only if the DB value isn't available yet.
  const freeTrialDays = pub?.plans.find((p) => p.name === "Free")?.trialDurationDays;
  let daysLeft: number | null = null;
  if (info?.createdAt && (freeTrialDays != null || launch)) {
    const end = new Date(info.createdAt);
    if (freeTrialDays != null) end.setDate(end.getDate() + freeTrialDays);
    else if (launch) end.setMonth(end.getMonth() + launch.freeMonths);
    daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
  }

  // During launch everyone reads as on the live (non-coming-soon) plan.
  const liveNames = new Set((pub?.plans ?? []).filter((p) => !p.comingSoon).map((p) => p.name));
  const effective = info && liveNames.has(info.plan) ? info.plan : "Free";

  return (
    <div className="page-wrapper">
      <PageHeader title="Plans & Pricing" subtitle="You're on the house — every feature, free during launch." breadcrumbs={[{ label: "Plans" }]} />

      {launch && (
        <div className="rounded-2xl p-5 mb-6 text-white" style={{ background: "linear-gradient(135deg,#6D28D9 0%,#4F46E5 100%)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} />
            <h2 className="text-lg font-bold">{launch.tagline}</h2>
          </div>
          <p className="text-white/90 text-sm">{launch.freeNote}</p>
          <p className="text-white/80 text-sm mt-1">{launch.teaser}</p>
          {daysLeft != null && (
            <div className="inline-flex items-center gap-1.5 mt-3 bg-white/15 rounded-full px-3 py-1 text-sm font-semibold">
              <Clock size={14} /> {daysLeft} days of free access left
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(pub?.plans ?? []).map((def) => {
          const isCurrent = effective === def.name;
          return (
            <div key={def.name} className={`relative rounded-2xl border p-5 bg-white ${isCurrent ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}>
              {isCurrent && <span className="absolute -top-2.5 left-5 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">Current</span>}
              {def.comingSoon && <span className="absolute -top-2.5 right-5 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">Coming soon</span>}
              <h3 className="text-base font-bold text-slate-900">{def.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5 h-8">{def.description}</p>
              <p className="text-lg font-bold text-indigo-600 mt-2">{formatPlanPrice(def.priceInPaise, def.billingPeriod)}</p>
              <p className="text-xs text-slate-400 mb-3">{def.maxUsers == null ? "Unlimited seats" : `${def.maxUsers} seats`}</p>
              {isCurrent || def.comingSoon ? (
                <button disabled className={`w-full h-9 rounded-lg text-sm font-semibold ${isCurrent ? "bg-indigo-50 text-indigo-600 cursor-default" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  {isCurrent ? "Your plan" : "Notify me"}
                </button>
              ) : (
                <a href={`/checkout?plan=${encodeURIComponent(def.name)}`} className="block text-center w-full h-9 leading-9 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700">
                  Upgrade
                </a>
              )}
              <ul className="mt-4 space-y-1.5">
                {def.features.slice(0, 6).map((k) => (
                  <li key={k} className="flex items-center gap-2 text-xs text-slate-600">
                    <Check size={13} className="text-emerald-500 shrink-0" /> {labelOf(k)}
                  </li>
                ))}
                {def.features.length > 6 && <li className="text-xs text-slate-400">+{def.features.length - 6} more</li>}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Gem size={15} className="text-purple-500" />
          <h2 className="text-sm font-bold text-slate-700">Features marked with a gem</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          These move to paid plans once pricing launches — but they&apos;re <strong>free for you right now</strong>. Use them while you can.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {(pub?.premium ?? []).map((k) => (
            <div key={k} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <Gem size={12} className="text-purple-400 shrink-0" />
              <span className="text-xs font-medium text-slate-700 truncate">{labelOf(k)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
