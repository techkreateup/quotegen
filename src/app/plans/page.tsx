"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { Sparkles, Check, Gem, Clock, Receipt } from "lucide-react";
import { formatPlanPrice } from "@/lib/features";

interface PlanDef {
  name: string;
  description: string;
  features: string[];
  maxUsers: number | null;
  comingSoon: boolean;
  price: string;
  priceInPaise: number;
  originalPriceInPaise?: number | null;
  yearlyPriceInPaise?: number | null;
  yearlyOriginalPriceInPaise?: number | null;
  billingPeriod: string;
  trialDurationDays: number;
}
interface PublicPlans {
  plans: PlanDef[];
  premium: string[];
  launch: { freeMonths: number; tagline: string; teaser: string; freeNote: string };
  features: { key: string; label: string }[];
  gst?: { rate: number };
}
interface PlanInfo { plan: string; maxUsers: number | null; seatsUsed: number; createdAt: string; subscriptionStatus?: string; currentBillingInterval?: string | null; currentPlanId?: string | null }

export default function TenantPlansPage() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [pub, setPub] = useState<PublicPlans | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    fetch("/api/plan").then((r) => r.json()).then((d) => (d.error ? null : setInfo(d))).catch(() => {});
    fetch("/api/plans/public").then((r) => r.json()).then(setPub).catch(() => {});
  }, []);

  const launch = pub?.launch;
  const labelOf = (k: string) => pub?.features.find((f) => f.key === k)?.label ?? k;

  // Free-access window only applies while the company is still on the trial.
  // Once they activate a paid plan (ACTIVE/PAST_DUE/CANCELED), the launch
  // countdown stops — they're on a real plan with its own renewal date.
  const onPaidPlan = info?.subscriptionStatus === "ACTIVE" ||
    info?.subscriptionStatus === "PAST_DUE" ||
    info?.subscriptionStatus === "CANCELED";
  const freeTrialDays = pub?.plans.find((p) => p.name === "Free")?.trialDurationDays;
  let daysLeft: number | null = null;
  if (!onPaidPlan && info?.createdAt && (freeTrialDays != null || launch)) {
    const end = new Date(info.createdAt);
    if (freeTrialDays != null) end.setDate(end.getDate() + freeTrialDays);
    else if (launch) end.setMonth(end.getMonth() + launch.freeMonths);
    daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
  }

  // During launch everyone reads as on the live (non-coming-soon) plan.
  const liveNames = new Set((pub?.plans ?? []).filter((p) => !p.comingSoon).map((p) => p.name));
  const effective = info && liveNames.has(info.plan) ? info.plan : "Free";
  const currentPaise = (pub?.plans ?? []).find((p) => p.name === effective)?.priceInPaise ?? 0;
  const hasAnyYearly = (pub?.plans ?? []).some((p) => p.yearlyPriceInPaise && p.yearlyPriceInPaise > 0);

  const displayPriceFor = (def: PlanDef): { paise: number; period: string; savingsPct: number | null; originalPaise: number | null } => {
    if (interval === "yearly" && def.yearlyPriceInPaise && def.yearlyPriceInPaise > 0) {
      const yearlyEquivOfMonthly = def.priceInPaise * 12;
      const savingsPct = yearlyEquivOfMonthly > 0
        ? Math.round(((yearlyEquivOfMonthly - def.yearlyPriceInPaise) / yearlyEquivOfMonthly) * 100)
        : null;
      // Strike-through MRP: explicit yearly MRP, else 12 × monthly MRP.
      const original = def.yearlyOriginalPriceInPaise
        ?? (def.originalPriceInPaise ? def.originalPriceInPaise * 12 : null);
      return {
        paise: def.yearlyPriceInPaise, period: "yearly", savingsPct,
        originalPaise: original && original > def.yearlyPriceInPaise ? original : null,
      };
    }
    return {
      paise: def.priceInPaise, period: def.billingPeriod, savingsPct: null,
      originalPaise: def.originalPriceInPaise && def.originalPriceInPaise > def.priceInPaise ? def.originalPriceInPaise : null,
    };
  };

  // Max yearly savings across all paid plans, used as the headline on the
  // Monthly/Yearly toggle. Admin sets the actual numbers in /admin/plans
  // (yearlyPriceInPaise per plan); this just surfaces the best discount.
  const maxYearlySavingsPct = (pub?.plans ?? []).reduce((max, p) => {
    if (!p.yearlyPriceInPaise || !p.priceInPaise) return max;
    const monthlyTotal = p.priceInPaise * 12;
    if (monthlyTotal <= p.yearlyPriceInPaise) return max;
    const pct = Math.round(((monthlyTotal - p.yearlyPriceInPaise) / monthlyTotal) * 100);
    return Math.max(max, pct);
  }, 0);

  return (
    <div className="page-wrapper">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader title="Plans & Pricing" subtitle="You're on the house — every feature, free during launch." breadcrumbs={[{ label: "Plans" }]} />
        <Link href="/billing" className="btn btn-outline btn-sm inline-flex items-center gap-1.5 shrink-0 mt-1">
          <Receipt size={13} /> Billing & invoices
        </Link>
      </div>

      {launch && !onPaidPlan && (
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

      {hasAnyYearly && (
        <div className="flex items-center justify-center mb-5">
          <div role="tablist" aria-label="Billing interval" className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            <button
              role="tab"
              aria-selected={interval === "monthly"}
              onClick={() => setInterval("monthly")}
              className={`px-4 h-8 rounded-full text-xs font-semibold ${interval === "monthly" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`}
            >
              Monthly
            </button>
            <button
              role="tab"
              aria-selected={interval === "yearly"}
              onClick={() => setInterval("yearly")}
              className={`px-4 h-8 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${interval === "yearly" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-800"}`}
            >
              Yearly
              {maxYearlySavingsPct > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${interval === "yearly" ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"}`}>
                  Save up to {maxYearlySavingsPct}%
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(pub?.plans ?? []).map((def) => {
          // "Current" only if the plan AND the billing interval both match. On the
          // free tier there's no interval to match, so plan-name is enough.
          const paidInterval = info?.currentBillingInterval;
          const nameMatches = effective === def.name;
          const isCurrent = nameMatches && (
            !onPaidPlan || !paidInterval || paidInterval === interval || def.priceInPaise === 0
          );
          const display = displayPriceFor(def);
          // Downgrade = a cheaper paid plan than the current one. Proration only
          // covers upgrades; clicking checkout on a cheaper plan would charge
          // the full price instead of waiting for renewal. Disable the CTA and
          // explain the renewal-time switch.
          const isDowngrade = !isCurrent && currentPaise > 0 && def.priceInPaise > 0 && def.priceInPaise < currentPaise;
          const yearlyUnavailable = interval === "yearly" && !def.yearlyPriceInPaise && def.priceInPaise > 0;
          const checkoutHref = `/checkout?plan=${encodeURIComponent(def.name)}${interval === "yearly" && def.yearlyPriceInPaise ? "&period=yearly" : ""}`;
          return (
            <div key={def.name} className={`relative rounded-2xl border p-5 bg-white ${isCurrent ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}>
              {isCurrent && <span className="absolute -top-2.5 left-5 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">Current</span>}
              {def.comingSoon && <span className="absolute -top-2.5 right-5 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">Coming soon</span>}
              <h3 className="text-base font-bold text-slate-900">{def.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5 h-8">{def.description}</p>
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                {display.originalPaise && (
                  <span className="text-sm text-slate-400 line-through">{formatPlanPrice(display.originalPaise, display.period)}</span>
                )}
                <span className="text-lg font-bold text-indigo-600">{formatPlanPrice(display.paise, display.period)}</span>
                {display.originalPaise && (() => {
                  const pct = Math.round(((display.originalPaise - display.paise) / display.originalPaise) * 100);
                  return pct > 0 ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Save {pct}%</span> : null;
                })()}
              </div>
              {def.priceInPaise > 0 && pub?.gst?.rate ? (
                <p className="text-[10px] text-slate-400">
                  incl. {Math.round(pub.gst.rate * 1000) / 10}% GST
                  {display.savingsPct && display.savingsPct > 0 ? ` · save ${display.savingsPct}% vs monthly` : ""}
                </p>
              ) : null}
              <p className="text-xs text-slate-400 mb-3">{def.maxUsers == null ? "Unlimited seats" : `${def.maxUsers} seats`}</p>
              {isCurrent || def.comingSoon ? (
                <button disabled className={`w-full h-9 rounded-lg text-sm font-semibold ${isCurrent ? "bg-indigo-50 text-indigo-600 cursor-default" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  {isCurrent ? "Your plan" : "Notify me"}
                </button>
              ) : yearlyUnavailable ? (
                <button disabled title="Yearly billing is not available for this plan yet." className="w-full h-9 rounded-lg text-sm font-semibold bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed">
                  Yearly not available
                </button>
              ) : isDowngrade ? (
                <button
                  disabled
                  title="Downgrades take effect at the end of your current billing period. Cancel the current plan to switch."
                  className="w-full h-9 rounded-lg text-sm font-semibold bg-slate-50 text-slate-500 border border-slate-200 cursor-not-allowed"
                >
                  Downgrade at renewal
                </button>
              ) : (
                <a href={checkoutHref} className="block text-center w-full h-9 leading-9 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700">
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
