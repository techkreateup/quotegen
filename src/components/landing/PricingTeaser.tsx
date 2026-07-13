"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { formatPlanPrice } from "@/lib/features";

/**
 * Chapter 07 — Pricing teaser on the landing page (Trio: Starter/Growth/
 * Enterprise). Pulls the same real, DB-backed /api/plans/public data as the
 * full /pricing page — no invented numbers. Growth (idx 1) is highlighted.
 * Links out to /pricing for the full comparison + FAQ.
 */
const EASE = [0.23, 1, 0.32, 1] as const;

interface LandingPlan {
  name: string; description: string; features: string[]; maxUsers: number | null;
  comingSoon: boolean; price: string; priceInPaise: number; billingPeriod: string;
}

export default function PricingTeaser() {
  const [plans, setPlans] = useState<LandingPlan[]>([]);
  const [featLabels, setFeatLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/plans/public")
      .then((r) => r.json())
      .then((d) => {
        // Landing shows real ongoing plans (Basic + first 2 paid tiers), not
        // the launch-only "Free" trial slot which lives in the hero copy.
        const list: LandingPlan[] = (d.plans ?? []).filter((p: LandingPlan) => p.name !== "Free").slice(0, 3);
        setPlans(list);
        setFeatLabels(Object.fromEntries((d.features ?? []).map((f: { key: string; label: string }) => [f.key, f.label])));
      })
      .catch(() => {});
  }, []);

  if (!plans.length) return null;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p, idx) => {
          const live = !p.comingSoon;
          const popular = idx === 1;
          return (
            <motion.div key={p.name}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: idx * 0.08, ease: EASE }}
              className="relative rounded-2xl p-5 sm:p-6 flex flex-col"
              style={{
                background: popular ? "var(--lp-ink)" : "var(--lp-paper)",
                color: popular ? "white" : "var(--lp-ink)",
                border: `1px solid ${popular ? "var(--lp-ink)" : "var(--lp-line)"}`,
                boxShadow: popular ? "0 30px 60px -20px oklch(0.25 0.02 240 / 0.4)" : "none",
              }}>
              {popular && (
                <span className="absolute -top-2.5 left-6 text-[10px] font-semibold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full lp-num"
                      style={{ background: "oklch(0.85 0.13 275)", color: "oklch(0.25 0.10 275)" }}>
                  Most SMBs pick this
                </span>
              )}
              <h3 className="text-[15px] font-semibold">{p.name}</h3>
              <p className="text-[12px] mt-1 min-h-[32px]" style={{ color: popular ? "oklch(0.75 0.02 240)" : "var(--lp-ink-soft)" }}>
                {p.description}
              </p>
              <div className="mt-2">
                <span className="lp-num text-[24px] font-semibold">{formatPlanPrice(p.priceInPaise, p.billingPeriod)}</span>
              </div>
              <ul className="mt-4 space-y-1.5 flex-1">
                {p.features.slice(0, 4).map((k) => (
                  <li key={k} className="grid grid-cols-[13px_1fr] items-start gap-2 text-[12.5px]">
                    <Check size={11} strokeWidth={2.4} className="mt-1"
                           style={{ color: popular ? "oklch(0.85 0.13 275)" : "var(--lp-brand-ink)" }} />
                    <span>{featLabels[k] ?? k}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup"
                    className="mt-5 inline-flex items-center justify-center gap-2 h-9 rounded-full text-[12.5px] font-semibold no-underline transition-transform active:scale-[0.97]"
                    style={{
                      background: popular ? "white" : "var(--lp-ink)",
                      color: popular ? "var(--lp-ink)" : "white",
                      border: `1px solid ${popular ? "white" : "var(--lp-ink)"}`,
                    }}>
                {live ? <>Try free <ArrowRight size={13} /></> : "Notify me"}
              </Link>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-[12.5px]" style={{ color: "var(--lp-mute)" }}>
        Free for 3 months on every plan · no card ·{" "}
        <Link href="/pricing" className="font-semibold" style={{ color: "var(--lp-brand-ink)" }}>
          see full comparison ↗
        </Link>
      </p>
    </div>
  );
}
