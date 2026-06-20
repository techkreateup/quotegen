"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, Lock, Mail, User, Sparkles } from "lucide-react";
import { AuthShell, AuthField, AuthError, AuthButton, PasswordStrength } from "@/components/auth/AuthShell";

interface PlanOption { name: string; comingSoon: boolean }

const INCLUDED = [
  "Unlimited quotations & GST invoices",
  "Payments, receipts & reminders",
  "Payroll, approvals & team roles",
  "GSTR-1 & 3B ready reports",
];

export default function SignupPage() {
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
        body: JSON.stringify({ companyName, name, email, password, plan, acceptTos }),
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

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="100% free — every feature included, no card, no trial clock."
      badge="Free forever"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 no-underline">
            Sign in
          </Link>
        </>
      }
    >
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

      {/* Plan picker — only Free is live; paid tiers are coming soon */}
      <div className="mb-6">
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
                className={`relative rounded-xl border px-3 py-2.5 text-left transition-all ${
                  selected
                    ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200"
                    : def.comingSoon
                    ? "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
                    : "border-slate-200 hover:border-indigo-300"
                }`}
              >
                <span className="block text-[13px] font-bold text-slate-800">{def.name}</span>
                <span className="block text-[10.5px] text-slate-400 mt-0.5">{def.comingSoon ? "Coming soon" : "Free · 3 months"}</span>
                {selected && <Check size={13} className="absolute top-2 right-2 text-indigo-600" />}
              </button>
            );
          })}
        </div>
        <p className="flex items-center gap-1.5 text-[11.5px] text-purple-600 font-medium mt-2">
          <Sparkles size={12} /> Featherlight pricing for paid tiers — coming soon, cheaper than you think.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 18 }}>
        <AuthField
          label="Company name"
          icon={Building2}
          id="companyName"
          type="text"
          required
          minLength={2}
          autoFocus
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Acme Pvt Ltd"
          hint="This becomes your workspace and appears on your documents."
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
        <div>
          <AuthField
            label="Password"
            icon={Lock}
            id="password"
            type="password"
            required
            minLength={8}
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
            <Link href="/terms" target="_blank" className="text-indigo-600 font-semibold hover:text-indigo-700">Terms of Service</Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-indigo-600 font-semibold hover:text-indigo-700">Privacy Policy</Link>.
          </span>
        </label>
        <AuthError message={error} />
        <AuthButton loading={loading}>{loading ? "Creating workspace…" : "Create my free workspace"}</AuthButton>
      </form>
    </AuthShell>
  );
}
