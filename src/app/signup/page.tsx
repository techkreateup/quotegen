"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Calculator,
  Check,
  Lock,
  Mail,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import { AuthShell, AuthField, AuthError, AuthButton, PasswordStrength } from "@/components/auth/AuthShell";

interface PlanOption { name: string; comingSoon: boolean }

const ROLES = [
  { key: "freelancer", label: "Freelancer / Consultant", icon: Calculator, color: "#0EA5E9", bg: "#F0F9FF" },
  { key: "agency", label: "Agency / Studio", icon: Briefcase, color: "#8B5CF6", bg: "#F5F3FF" },
  { key: "trader", label: "Trader / Manufacturer", icon: Store, color: "#F59E0B", bg: "#FFFBEB" },
  { key: "smb", label: "Growing SMB", icon: Building2, color: "#10B981", bg: "#ECFDF5" },
];

const INCLUDED = [
  "Unlimited quotations & GST invoices",
  "Payments, receipts & reminders",
  "Payroll, approvals & team roles",
  "GSTR-1 & 3B ready reports",
];

export default function SignupPage() {
  const [step, setStep] = useState(1); // 1 = role, 2 = workspace, 3 = credentials
  const [role, setRole] = useState<string>("freelancer");
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [plan, setPlan] = useState("Free");
  const [plans, setPlans] = useState<PlanOption[]>([{ name: "Free", comingSoon: false }]);
  const [acceptTos, setAcceptTos] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/plans/public")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.plans)) {
          setPlans(d.plans.map((p: PlanOption) => ({ name: p.name, comingSoon: p.comingSoon })));
          const firstLive = d.plans.find((p: PlanOption) => !p.comingSoon);
          if (firstLive) setPlan(firstLive.name);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!acceptTos) {
      setError("Please accept the Terms of Service and Privacy Policy");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, name, email, password, plan, acceptTos, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }
      window.location.href = "/onboarding";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  function next() {
    setError("");
    if (step === 2 && (!companyName || !name || !email)) {
      setError("Please fill in all fields to continue");
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }
  function back() {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="100% free — every feature included, no card, no trial clock."
      badge="Free · 3 months"
      wide
      footer={
        <span className="inline-flex items-center gap-2">
          Already have an account?
          <Link href="/login"
                className="inline-flex items-center gap-1 no-underline font-bold rounded-full px-3 py-1.5 text-[12.5px] transition-transform active:scale-[0.97]"
                style={{ color: "var(--lp-brand-ink)", background: "var(--lp-brand-tint)", border: "1px solid var(--lp-brand-ink)" }}>
            Sign in <ArrowRight size={12} />
          </Link>
        </span>
      }
    >
      {/* Stepper */}
      <div className="mb-6">
        <div className="flex items-center">
          {[1, 2, 3].map((n, i) => {
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} className={`flex items-center ${i < 2 ? "flex-1" : ""}`}>
                <span
                  className="w-7 h-7 rounded-full text-white text-[12px] font-extrabold flex items-center justify-center transition-all shrink-0"
                  style={{
                    background: done ? "#059669" : active ? "var(--lp-brand-ink)" : "#CBD5E1",
                    boxShadow: active ? "0 0 0 4px var(--lp-brand-tint)" : "none",
                  }}
                >
                  {done ? <Check size={13} strokeWidth={3} /> : n}
                </span>
                {i < 2 && (
                  <div className="flex-1 h-1 mx-2 rounded-full" style={{ background: done ? "#059669" : "#E2E8F0" }} />
                )}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 text-[11px] font-bold mt-2">
          <span className="text-left"  style={{ color: step >= 1 ? "var(--lp-brand-ink)" : "#94A3B8" }}>Who you are</span>
          <span className="text-center" style={{ color: step >= 2 ? "var(--lp-brand-ink)" : "#94A3B8" }}>Your workspace</span>
          <span className="text-right"  style={{ color: step >= 3 ? "var(--lp-brand-ink)" : "#94A3B8" }}>Secure it</span>
        </div>
      </div>

      {/* Everything-included strip */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {INCLUDED.map((f) => (
            <span key={f} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800">
              <Check size={12} className="text-emerald-500 shrink-0" /> {f}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 18 }}>
        {/* Step 1 — Role */}
        {step === 1 && (
          <div className="mk-fade-in">
            <p className="text-[13px] font-bold text-slate-700 mb-3">Tell us who you are — we&apos;ll tune the workspace for you.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ROLES.map((r) => {
                const active = role === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRole(r.key)}
                    className="rounded-xl border-2 p-4 text-left transition-all flex items-center gap-3"
                    style={{
                      background: active ? r.bg : "white",
                      borderColor: active ? r.color : "#E2E8F0",
                      boxShadow: active ? `0 8px 24px ${r.color}22` : "none",
                    }}
                  >
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: active ? "white" : r.bg, color: r.color }}
                    >
                      <r.icon size={18} strokeWidth={2.3} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13.5px] font-extrabold text-slate-900">{r.label}</span>
                    </span>
                    {active && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: r.color }}>
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Plan picker (compact) */}
            {plans.length > 1 && (
              <div className="mt-5">
                <p className="text-[12px] font-semibold text-slate-500 mb-2">Choose your plan</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {plans.map((def) => {
                    const selected = plan === def.name;
                    return (
                      <button
                        key={def.name}
                        type="button"
                        disabled={def.comingSoon}
                        onClick={() => !def.comingSoon && setPlan(def.name)}
                        className={`relative rounded-xl border px-3 py-2 text-left transition-all ${
                          selected
                            ? ""
                            : def.comingSoon
                            ? "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
                            : "border-slate-200"
                        }`}
                        style={selected ? { borderColor: "var(--lp-brand-ink)", background: "var(--lp-brand-tint)", boxShadow: "0 0 0 1px var(--lp-brand-ink)" } : undefined}
                      >
                        <span className="block text-[12.5px] font-bold text-slate-800">{def.name}</span>
                        <span className="block text-[10.5px] text-slate-400 mt-0.5">{def.comingSoon ? "Coming soon" : "Free · 3 months"}</span>
                        {selected && <Check size={12} className="absolute top-1.5 right-1.5" style={{ color: "var(--lp-brand-ink)" }} />}
                      </button>
                    );
                  })}
                </div>
                <p className="flex items-center gap-1.5 text-[11px] font-medium mt-2" style={{ color: "var(--lp-brand-ink)" }}>
                  <Sparkles size={12} /> Featherlight pricing — cheaper than you think.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Workspace */}
        {step === 2 && (
          <div className="mk-fade-in flex flex-col gap-4">
            <AuthField
              label="Company / Workspace name"
              icon={Building2}
              id="companyName"
              type="text"
              required
              minLength={2}
              autoFocus
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Pvt Ltd"
              hint="This appears on your quotes, invoices and receipts."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AuthField
                label="Your name"
                icon={User}
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
              <AuthField
                label="Work email"
                icon={Mail}
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
          </div>
        )}

        {/* Step 3 — Credentials */}
        {step === 3 && (
          <div className="mk-fade-in flex flex-col gap-4">
            <div>
              <AuthField
                label="Password"
                icon={Lock}
                id="password"
                type="password"
                required
                minLength={8}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
              />
              <PasswordStrength password={password} />
            </div>
            <AuthField
              label="Confirm password"
              icon={Lock}
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
            />
            <label className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-snug">
              <input
                type="checkbox"
                checked={acceptTos}
                onChange={(e) => setAcceptTos(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="font-semibold" style={{ color: "var(--lp-brand-ink)" }}>Terms of Service</Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="font-semibold" style={{ color: "var(--lp-brand-ink)" }}>Privacy Policy</Link>.
              </span>
            </label>
          </div>
        )}

        <AuthError message={error} />

        {/* Nav buttons */}
        <div className="flex items-center gap-3 mt-1">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl border-[1.5px] border-slate-200 bg-white text-slate-700 text-[13.5px] font-bold hover:border-slate-300 transition-all"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl text-white text-[14px] font-bold transition-all hover:-translate-y-px"
              style={{ background: "var(--lp-ink)", boxShadow: "0 4px 14px oklch(0.25 0.02 240 / 0.35)" }}
            >
              Continue <ArrowRight size={15} />
            </button>
          ) : (
            <div className="flex-1">
              <AuthButton loading={loading}>{loading ? "Creating workspace…" : "Create my free workspace"}</AuthButton>
            </div>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
