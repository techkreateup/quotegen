"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import MarketingShell, { PageHero } from "@/components/landing/MarketingShell";
import { formatPlanPrice } from "@/lib/features";

interface LandingPlan {
  name: string; description: string; features: string[]; maxUsers: number | null;
  comingSoon: boolean; price: string; priceInPaise: number;
  originalPriceInPaise?: number | null; billingPeriod: string;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<LandingPlan[]>([]);
  const [launch, setLaunch] = useState<{ tagline: string; teaser: string; freeNote: string } | null>(null);
  const [featLabels, setFeatLabels] = useState<Record<string, string>>({});
  const [count, setCount] = useState(24);

  useEffect(() => {
    fetch("/api/plans/public")
      .then((r) => r.json())
      .then((d) => {
        setPlans(d.plans ?? []);
        setLaunch(d.launch ?? null);
        setFeatLabels(Object.fromEntries((d.features ?? []).map((f: { key: string; label: string }) => [f.key, f.label])));
      })
      .catch(() => {});
  }, []);

  const hoursPerMonth = Math.round((count * 42) / 60);

  return (
    <MarketingShell active="/pricing">
      <PageHero kicker={launch?.tagline ?? "Pricing"}
        title={<>Free for 3 months.<br /><span style={{ color: "var(--lp-brand-ink)" }}>Then simple.</span></>}
        sub={`${launch?.freeNote ?? "No card. No trial clock. No locked features."} ${launch?.teaser ?? "Every module in every plan — you only pay for seats and scale."}`} />

      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pb-16">
        {/* value math */}
        <div className="rounded-2xl p-6 sm:p-8"
             style={{ background: "linear-gradient(160deg, oklch(0.985 0.005 275), oklch(0.94 0.03 275))", border: "1px solid var(--lp-line)" }}>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-8 items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em]" style={{ color: "var(--lp-mute)" }}>The math</p>
              <h2 className="mt-2 text-[22px] sm:text-[26px] font-semibold leading-[1.1]" style={{ letterSpacing: "-0.02em" }}>
                What is your time<br />actually worth?
              </h2>
              <p className="mt-3 text-[13.5px] leading-relaxed max-w-[36ch]" style={{ color: "var(--lp-ink-soft)" }}>
                Drag the slider. 42 minutes saved per invoice is the real average once quotes, follow-ups and GST work stop being manual.
              </p>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--lp-mute)" }}>Invoices per month</span>
                <span className="lp-num text-[28px] font-semibold">{count}</span>
              </div>
              <input type="range" min={4} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))}
                     aria-label="Invoices per month" className="w-full mt-3" style={{ accentColor: "oklch(0.55 0.14 275)" }} />
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { l: "Hours / month", v: `${hoursPerMonth}h` },
                  { l: "Workdays / yr", v: `${Math.round((hoursPerMonth * 12) / 8)}d` },
                  { l: "Hours / year", v: `${hoursPerMonth * 12}h` },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl px-3 py-3" style={{ background: "var(--lp-paper)", border: "1px solid var(--lp-line)" }}>
                    <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--lp-mute)" }}>{s.l}</div>
                    <div className="lp-num text-[22px] font-semibold mt-0.5 tabular-nums" style={{ color: "var(--lp-brand-ink)" }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* plans */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p, idx) => {
            const live = !p.comingSoon;
            const popular = idx === 1;
            return (
              <motion.div key={p.name}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.23, 1, 0.32, 1] }}
                whileHover={{ y: -4 }}
                className="relative rounded-2xl p-6 flex flex-col"
                style={{
                  background: popular ? "var(--lp-ink)" : "var(--lp-paper)",
                  color: popular ? "white" : "var(--lp-ink)",
                  border: `1px solid ${popular ? "var(--lp-ink)" : "var(--lp-line)"}`,
                  boxShadow: popular ? "0 30px 60px -20px oklch(0.25 0.02 240 / 0.4)" : "none",
                }}>
                {popular && (
                  <span className="absolute -top-2.5 left-6 text-[10px] font-semibold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full lp-num"
                        style={{ background: "oklch(0.85 0.13 275)", color: "oklch(0.25 0.10 275)" }}>Most popular</span>
                )}
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[16px] font-semibold">{p.name}</h3>
                  <span className="text-[10px] uppercase tracking-[0.2em] lp-num"
                        style={{ color: popular ? "oklch(0.85 0.13 275)" : (live ? "var(--lp-brand-ink)" : "var(--lp-mute)") }}>
                    {live ? "Live" : "Soon"}
                  </span>
                </div>
                <p className="text-[12.5px] mt-1 min-h-[36px]" style={{ color: popular ? "oklch(0.75 0.02 240)" : "var(--lp-ink-soft)" }}>{p.description}</p>
                <div className="mt-3">
                  {p.originalPriceInPaise && p.originalPriceInPaise > p.priceInPaise && (
                    <div className="text-[11px] line-through lp-num" style={{ color: popular ? "oklch(0.65 0.02 240)" : "var(--lp-mute)" }}>
                      {formatPlanPrice(p.originalPriceInPaise, p.billingPeriod)}
                    </div>
                  )}
                  <div className="lp-num text-[28px] font-semibold">{formatPlanPrice(p.priceInPaise, p.billingPeriod)}</div>
                  <div className="text-[11.5px] mt-1" style={{ color: popular ? "oklch(0.7 0.02 240)" : "var(--lp-mute)" }}>
                    {p.maxUsers == null ? "Unlimited seats" : `${p.maxUsers} seats`}
                  </div>
                </div>
                <ul className="mt-5 space-y-2 flex-1">
                  {p.features.map((k) => (
                    <li key={k} className="grid grid-cols-[14px_1fr] items-start gap-2 text-[13px]">
                      <Check size={12} strokeWidth={2.4} className="mt-1" style={{ color: popular ? "oklch(0.85 0.13 275)" : "var(--lp-brand-ink)" }} />
                      <span>{featLabels[k] ?? k}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" aria-disabled={!live}
                      className={`mt-6 inline-flex items-center justify-center gap-2 h-10 rounded-full text-[13px] font-semibold no-underline transition-transform active:scale-[0.97] ${live ? "" : "pointer-events-none"}`}
                      style={{
                        background: popular ? "white" : (live ? "var(--lp-ink)" : "transparent"),
                        color: popular ? "var(--lp-ink)" : (live ? "white" : "var(--lp-mute)"),
                        border: `1px solid ${popular ? "white" : (live ? "var(--lp-ink)" : "var(--lp-line)")}`,
                      }}>
                  {live ? <>Try free <ArrowRight size={14} /></> : "Notify me"}
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* pricing FAQ */}
        <div className="mt-12 max-w-[760px]">
          <h2 className="text-[20px] font-semibold" style={{ letterSpacing: "-0.02em" }}>Fair questions</h2>
          <div className="mt-4 divide-y" style={{ borderColor: "var(--lp-line)" }}>
            {[
              { q: "What happens after the free 3 months?", a: "You pick a plan — or you don't, and your data stays exportable. No auto-charge, because we never took a card." },
              { q: "Are modules extra?", a: "No. Sales, purchases, GST, payroll, approvals, audit — every module is in every plan. Plans differ only by seats and scale." },
              { q: "Can I cancel anytime?", a: "Yes, in one click from Billing. Refunds are prorated on upgrades and honoured on genuine errors." },
              { q: "Is GST charged on the subscription?", a: "Yes — the checkout shows the full GST breakdown, and you get a proper GST invoice for your own books." },
            ].map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none flex items-start justify-between gap-6 text-[15px] font-medium">{f.q}</summary>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--lp-ink-soft)" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
