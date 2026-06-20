"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, FileText, IndianRupee, ShieldCheck, Zap } from "lucide-react";

/**
 * Enterprise split-screen shell for /login, /signup, /forgot-password,
 * /reset-password. Form on the left, animated brand showcase on the right.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  badge,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  badge?: string;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left: form panel ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-6 sm:px-10 h-[72px] shrink-0">
          <Link href="/landing" className="flex items-center gap-2.5 no-underline">
            <span
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", boxShadow: "0 2px 8px rgba(99,102,241,0.4)" }}
            >
              <Zap size={17} color="white" strokeWidth={2.5} />
            </span>
            <span className="text-[16px] font-extrabold tracking-tight text-slate-900">QuoteGen</span>
          </Link>
          {badge && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11.5px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1">
              <ShieldCheck size={12} /> {badge}
            </span>
          )}
        </header>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-10">
          <div className={`w-full ${wide ? "max-w-[560px]" : "max-w-[400px]"}`}>
            <div className="mk-fade-up">
              <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-slate-900 leading-tight">{title}</h1>
              <p className="text-[14px] text-slate-500 mt-2 mb-8">{subtitle}</p>
            </div>
            <div className="mk-fade-up-1">{children}</div>
            {footer && <div className="mk-fade-up-2 mt-7 text-center text-[13.5px] text-slate-500">{footer}</div>}
          </div>
        </div>

        <p className="px-6 sm:px-10 pb-5 text-[11.5px] text-slate-400 shrink-0">
          © {new Date().getFullYear()} QuoteGen · GST-compliant billing for growing businesses
        </p>
      </div>

      {/* ── Right: brand showcase (lg+) ── */}
      <div
        className="hidden lg:flex w-[46%] max-w-[680px] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: "linear-gradient(160deg, #1E1B4B 0%, #312E81 45%, #4338CA 100%)" }}
        aria-hidden
      >
        {/* floating orbs */}
        <div className="absolute -top-24 -right-24 w-[380px] h-[380px] rounded-full mk-float-slow" style={{ background: "radial-gradient(circle, rgba(129,140,248,0.35) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-120px] left-[-80px] w-[420px] h-[420px] rounded-full mk-float" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)" }} />
        <div className="absolute top-1/3 left-1/4 w-2 h-2 rounded-full bg-indigo-300/60 mk-float" />
        <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 rounded-full bg-purple-300/60 mk-float-slow" />

        <div className="relative mk-fade-up-1">
          <p className="text-indigo-200 text-[13px] font-semibold uppercase tracking-[0.18em]">Run your business on autopilot</p>
          <h2 className="text-white text-[28px] font-extrabold leading-snug mt-3 tracking-tight">
            Quotations, GST invoices, payments &amp; payroll —<br />one workspace for your whole team.
          </h2>
        </div>

        {/* product mockup card */}
        <div className="relative my-8 mk-fade-up-2">
          <div className="rounded-2xl bg-white/[0.07] border border-white/15 backdrop-blur-xl p-5 shadow-2xl mk-float" style={{ animationDuration: "8s" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-indigo-200 text-[11px] font-semibold uppercase tracking-wider">Revenue collected</p>
                <p className="text-white text-[26px] font-extrabold tracking-tight">₹24,80,500</p>
              </div>
              <span className="text-emerald-300 text-[12px] font-bold bg-emerald-400/15 border border-emerald-300/25 rounded-full px-2.5 py-1">▲ 18.4%</span>
            </div>
            {/* animated bar chart */}
            <div className="flex items-end gap-2 h-[88px]">
              {[38, 52, 44, 65, 58, 78, 70, 92].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md origin-bottom"
                  style={{
                    height: `${h}%`,
                    background: i === 7 ? "linear-gradient(180deg,#A5B4FC,#818CF8)" : "rgba(165,180,252,0.35)",
                    animation: `mk-bar-grow 900ms cubic-bezier(0.22,1,0.36,1) ${250 + i * 90}ms both`,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-white/10">
              {[
                [FileText, "32 invoices"],
                [IndianRupee, "₹3.2L pending"],
                [BarChart3, "GSTR-1 ready"],
              ].map(([Icon, label], i) => {
                const I = Icon as LucideIcon;
                return (
                  <span key={i} className="flex items-center gap-1.5 text-indigo-100 text-[11.5px] font-medium">
                    <I size={12} className="text-indigo-300" /> {label as string}
                  </span>
                );
              })}
            </div>
          </div>
          {/* floating notification chip */}
          <div className="absolute -right-3 -bottom-5 rounded-xl bg-white shadow-xl px-4 py-3 flex items-center gap-3 mk-float-slow">
            <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm font-bold">₹</span>
            <div>
              <p className="text-[12px] font-bold text-slate-800 leading-none">Payment received</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-none">INV00042 · ₹58,000</p>
            </div>
          </div>
        </div>

        <div className="relative mk-fade-up-3">
          <div className="flex items-center gap-6 text-indigo-100/90">
            {[
              ["Bank-grade isolation", "per-company data walls"],
              ["GST-ready", "GSTR-1 & 3B reports"],
              ["100% free forever", "every feature included"],
            ].map(([t, s]) => (
              <div key={t as string}>
                <p className="text-[13px] font-bold text-white">{t}</p>
                <p className="text-[11.5px] text-indigo-200/80 mt-0.5">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputBase =
  "w-full h-11 rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export function AuthField({
  label,
  icon: Icon,
  id,
  hint,
  ...inputProps
}: {
  label: string;
  icon?: LucideIcon;
  id: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        <input id={id} className={`${inputBase} ${Icon ? "pl-10" : ""}`} {...inputProps} />
      </div>
      {hint && <p className="text-[11.5px] text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-medium text-red-600 mk-fade-in"
    >
      {message}
    </div>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-700 mk-fade-in"
    >
      {message}
    </div>
  );
}

export function AuthButton({
  loading,
  children,
  ...props
}: { loading: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-11 rounded-xl text-white text-[14px] font-bold tracking-tight transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-[0_6px_20px_rgba(99,102,241,0.45)] hover:-translate-y-px active:translate-y-0"
      style={{ background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)", boxShadow: "0 2px 10px rgba(99,102,241,0.35)" }}
      {...props}
    >
      {children}
    </button>
  );
}

/** Live password strength meter for signup/reset forms. */
export function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  if (!password) return null;
  const labels = ["Too weak", "Weak", "Almost there", "Almost there", "Strong password"];
  const colors = ["#EF4444", "#F59E0B", "#F59E0B", "#F59E0B", "#10B981"];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i < score ? colors[score] : "#E5E7EB" }}
          />
        ))}
      </div>
      <p className="text-[11px] font-medium mt-1.5" style={{ color: colors[score] }}>
        {labels[score]}
        {score < 4 && " — needs 8+ chars, uppercase, lowercase & a number"}
      </p>
    </div>
  );
}
