"use client";

import { useEffect, useState } from "react";
import PlatformShell from "@/components/platform/PlatformShell";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/platform/ui";
import { FEATURE_CATEGORIES, formatPlanPrice, type FeatureDef } from "@/lib/features";

interface PlanDef {
  name: string;
  description: string;
  features: string[];
  maxUsers: number | null;
  comingSoon: boolean;
  price: string;
  priceInPaise: number;
  originalPriceInPaise: number | null;
  yearlyPriceInPaise: number | null;
  yearlyOriginalPriceInPaise: number | null;
  billingPeriod: string;
  trialDurationDays: number;
}

function paiseToRupeeStr(p: number | null | undefined): string {
  if (p == null || p === 0) return "";
  return String(p / 100);
}
function rupeeStrToPaise(v: string): number | null {
  if (v === "") return null;
  const n = Math.round(Number(v) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function discountPct(now: number, was: number | null | undefined): number | null {
  if (!was || was <= now) return null;
  return Math.round(((was - now) / was) * 100);
}

const BILLING_PERIODS = ["monthly", "yearly", "one-time"] as const;

export default function PlansAdminPage() {
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [features, setFeatures] = useState<FeatureDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setPlans(d.plans);
        setFeatures(d.features);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function update(name: string, patch: Partial<PlanDef>) {
    setPlans((prev) => prev.map((p) => (p.name === name ? { ...p, ...patch } : p)));
    setMsg("");
  }

  function toggleFeature(name: string, key: string) {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.name !== name) return p;
        const has = p.features.includes(key);
        return { ...p, features: has ? p.features.filter((f) => f !== key) : [...p.features, key] };
      })
    );
    setMsg("");
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plans }),
    });
    setSaving(false);
    if (res.ok) { setMsg("Saved. Changes are now live on signup, the in-app plans page, and the landing page."); setPlans((await res.json()).plans); }
    else setError((await res.json()).error || "Failed to save");
  }

  return (
    <PlatformShell>
      <div className="mb-5">
        <PageHeader
          title="Plans"
          subtitle="Customize which features belong to each plan. Edits reflect everywhere — signup, in-app, and the landing page."
          breadcrumbs={[{ label: "Platform" }, { label: "Plans" }]}
          action={
            <button onClick={save} disabled={saving || loading} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          }
        />
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
      {msg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{msg}</div>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-4">
          {plans.map((p) => (
            <Card key={p.name} title={p.name}>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                <label className="text-sm sm:col-span-3">
                  <span className="block text-slate-500 mb-1">Description</span>
                  <input value={p.description} onChange={(e) => update(p.name, { description: e.target.value })} className="h-9 w-full px-2 rounded-lg border border-slate-300 text-sm" />
                </label>
                <label className="text-sm">
                  <span className="block text-slate-500 mb-1">Seat limit (blank = ∞)</span>
                  <input type="number" min={1} value={p.maxUsers ?? ""} onChange={(e) => update(p.name, { maxUsers: e.target.value === "" ? null : Number(e.target.value) })} className="h-9 w-full px-2 rounded-lg border border-slate-300 text-sm" />
                </label>
              </div>

              {/* Pricing block: monthly + yearly + their MRPs (strike-through on /plans) */}
              {p.name !== "Free" && (
                <div className="mb-4 rounded-lg border border-slate-200 p-3 bg-slate-50/40">
                  <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Pricing</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <label className="text-sm">
                      <span className="block text-slate-500 mb-1">Monthly (₹)</span>
                      <input type="number" min={0} step="0.01" value={paiseToRupeeStr(p.priceInPaise)}
                        onChange={(e) => update(p.name, { priceInPaise: rupeeStrToPaise(e.target.value) ?? 0 })}
                        className="h-9 w-full px-2 rounded-lg border border-slate-300 text-sm bg-white" />
                    </label>
                    <label className="text-sm">
                      <span className="block text-slate-500 mb-1">Monthly MRP <span className="text-slate-400">(strike)</span></span>
                      <input type="number" min={0} step="0.01" placeholder="e.g. 599" value={paiseToRupeeStr(p.originalPriceInPaise)}
                        onChange={(e) => update(p.name, { originalPriceInPaise: rupeeStrToPaise(e.target.value) })}
                        className="h-9 w-full px-2 rounded-lg border border-slate-300 text-sm bg-white" />
                    </label>
                    <label className="text-sm">
                      <span className="block text-slate-500 mb-1">Yearly (₹)</span>
                      <input type="number" min={0} step="0.01" placeholder="(blank = no yearly)" value={paiseToRupeeStr(p.yearlyPriceInPaise)}
                        onChange={(e) => update(p.name, { yearlyPriceInPaise: rupeeStrToPaise(e.target.value) })}
                        className="h-9 w-full px-2 rounded-lg border border-slate-300 text-sm bg-white" />
                    </label>
                    <label className="text-sm">
                      <span className="block text-slate-500 mb-1">Yearly MRP <span className="text-slate-400">(strike)</span></span>
                      <input type="number" min={0} step="0.01" placeholder="(blank = 12 × monthly MRP)" value={paiseToRupeeStr(p.yearlyOriginalPriceInPaise)}
                        onChange={(e) => update(p.name, { yearlyOriginalPriceInPaise: rupeeStrToPaise(e.target.value) })}
                        className="h-9 w-full px-2 rounded-lg border border-slate-300 text-sm bg-white" />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <label className="text-sm">
                      <span className="block text-slate-500 mb-1">Billing period (default)</span>
                      <select value={p.billingPeriod} onChange={(e) => update(p.name, { billingPeriod: e.target.value })} className="h-9 w-full px-2 rounded-lg border border-slate-300 text-sm bg-white">
                        {BILLING_PERIODS.map((bp) => <option key={bp} value={bp}>{bp}</option>)}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="block text-slate-500 mb-1">Price label (teaser)</span>
                      <input value={p.price} onChange={(e) => update(p.name, { price: e.target.value })} className="h-9 w-full px-2 rounded-lg border border-slate-300 text-sm bg-white" placeholder="e.g. ₹499/mo" />
                    </label>
                  </div>

                  {/* Live preview of the plan card pricing — matches what /plans renders */}
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Live preview</span>
                    <div className="flex items-end gap-6 flex-wrap">
                      <div>
                        <p className="text-[10px] text-slate-400 mb-0.5">Monthly</p>
                        <div className="flex items-baseline gap-2">
                          {p.originalPriceInPaise && p.originalPriceInPaise > p.priceInPaise && (
                            <span className="text-slate-400 line-through text-sm">{formatPlanPrice(p.originalPriceInPaise, "monthly")}</span>
                          )}
                          <span className="text-lg font-bold text-indigo-600">{formatPlanPrice(p.priceInPaise, "monthly")}</span>
                          {discountPct(p.priceInPaise, p.originalPriceInPaise) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Save {discountPct(p.priceInPaise, p.originalPriceInPaise)}%</span>
                          )}
                        </div>
                      </div>
                      {p.yearlyPriceInPaise && p.yearlyPriceInPaise > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-400 mb-0.5">Yearly</p>
                          <div className="flex items-baseline gap-2">
                            {(() => {
                              const mrp = p.yearlyOriginalPriceInPaise ?? (p.originalPriceInPaise ? p.originalPriceInPaise * 12 : null);
                              return mrp && mrp > p.yearlyPriceInPaise ? (
                                <span className="text-slate-400 line-through text-sm">{formatPlanPrice(mrp, "yearly")}</span>
                              ) : null;
                            })()}
                            <span className="text-lg font-bold text-indigo-600">{formatPlanPrice(p.yearlyPriceInPaise, "yearly")}</span>
                            {(() => {
                              const mrp = p.yearlyOriginalPriceInPaise ?? (p.originalPriceInPaise ? p.originalPriceInPaise * 12 : null);
                              const pct = discountPct(p.yearlyPriceInPaise, mrp);
                              return pct ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Save {pct}%</span> : null;
                            })()}
                          </div>
                          {p.yearlyPriceInPaise && p.priceInPaise > 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {(() => {
                                const monthlyTotal = p.priceInPaise * 12;
                                const yearlyDisc = discountPct(p.yearlyPriceInPaise, monthlyTotal);
                                return yearlyDisc ? `${yearlyDisc}% cheaper than paying monthly all year` : "—";
                              })()}
                            </p>
                          )}
                        </div>
                      )}
                      {p.comingSoon && <span className="self-center text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Coming soon</span>}
                    </div>
                  </div>
                </div>
              )}

              {p.name === "Free" && (
                <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-3">
                  <label className="text-sm block max-w-xs">
                    <span className="block text-slate-600 font-medium mb-1">Free-access window (days)</span>
                    <input
                      type="number"
                      min={0}
                      value={p.trialDurationDays}
                      onChange={(e) => update(p.name, { trialDurationDays: e.target.value === "" ? 0 : Math.max(0, Math.round(Number(e.target.value))) })}
                      className="h-9 w-full px-2 rounded-lg border border-slate-300 text-sm bg-white"
                    />
                    <span className="block text-xs text-slate-400 mt-1">Drives the “days of free access left” countdown on the in-app plans page. Seat limit above (blank = ∞) sets the free-tier cap.</span>
                  </label>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm mb-4">
                <input type="checkbox" checked={p.comingSoon} onChange={(e) => update(p.name, { comingSoon: e.target.checked })} />
                <span className="text-slate-600">Coming soon (not selectable yet)</span>
                <span className="text-xs text-slate-400 ml-2">{p.features.length} features enabled</span>
              </label>

              {FEATURE_CATEGORIES.map((cat) => {
                const feats = features.filter((f) => f.category === cat);
                if (!feats.length) return null;
                return (
                  <div key={cat} className="mb-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{cat}</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {feats.map((f) => {
                        const on = p.features.includes(f.key);
                        return (
                          <button
                            key={f.key}
                            onClick={() => toggleFeature(p.name, f.key)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Card>
          ))}
          <p className="text-xs text-slate-400">Tip: features <strong>not</strong> in the Starter plan show a gem marker in the app (free during launch, paid later).</p>
        </div>
      )}
    </PlatformShell>
  );
}
