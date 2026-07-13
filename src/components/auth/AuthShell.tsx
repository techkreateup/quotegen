"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

/**
 * Centered-card shell for /login, /signup, /forgot-password, /reset-password.
 * Auth pages exist to reduce friction, not to re-sell the product — so no
 * side marketing panel. Just the form, a soft brand-gradient backdrop, and
 * one small trust line. Marketing weight lives on /landing and /pricing.
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
    <div className="min-h-screen flex flex-col relative overflow-hidden"
         style={{ background: "oklch(0.985 0.004 275)" }}>
      {/* soft ambient brand wash, subtle */}
      <div aria-hidden className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[480px] rounded-full pointer-events-none"
           style={{ background: "radial-gradient(closest-side, oklch(0.85 0.13 275 / 0.20), transparent 70%)" }} />

      <header className="relative flex items-center justify-between px-6 h-[72px] shrink-0">
        <Link href="/landing" className="flex items-center gap-2 no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/quotegen/QGF_wordmark_SVG.svg" alt="QuoteGen"
               className="block" style={{ height: 32, width: "auto" }} />
        </Link>
        <Link href="/landing"
              className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-semibold no-underline transition-colors"
              style={{ color: "var(--lp-brand-ink)", background: "var(--lp-brand-tint)", border: "1px solid var(--lp-brand-ink)" }}>
          Visit website ↗
        </Link>
      </header>

      <div className="relative flex-1 flex items-center justify-center px-5 sm:px-6 py-8">
        <div className={`w-full ${wide ? "max-w-[560px]" : "max-w-[420px]"}`}>
          <div className="rounded-2xl bg-white px-6 sm:px-8 py-8 sm:py-9"
               style={{ border: "1px solid var(--lp-line, #E2E4EA)", boxShadow: "0 30px 70px -30px oklch(0.25 0.02 240 / 0.22)" }}>
            <div className="mk-fade-up">
              {badge && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 mb-4"
                      style={{ color: "var(--lp-brand-ink)", background: "var(--lp-brand-tint)", border: "1px solid var(--lp-brand-ink)33" }}>
                  <ShieldCheck size={11} /> {badge}
                </span>
              )}
              <h1 className="text-[24px] sm:text-[27px] font-extrabold tracking-tight text-slate-900 leading-tight">{title}</h1>
              <p className="text-[13.5px] text-slate-500 mt-2 mb-7">{subtitle}</p>
            </div>
            <div className="mk-fade-up-1">{children}</div>
            {footer && <div className="mk-fade-up-2 mt-6 text-center text-[13.5px] text-slate-500">{footer}</div>}
          </div>
          <p className="mt-5 text-center text-[11.5px] text-slate-400">
            500+ Indian SMBs · Free for 3 months · No card
          </p>
        </div>
      </div>

      <p className="relative px-6 pb-5 text-center text-[11.5px] text-slate-400 shrink-0">
        © {new Date().getFullYear()} QuoteGen ·{" "}
        <a href="https://kreateup.in" target="_blank" rel="noopener noreferrer"
           className="no-underline hover:text-slate-600">
          Made by <span className="font-semibold" style={{ color: "var(--lp-brand-ink)" }}>KreateUp</span> ↗
        </a>
      </p>
    </div>
  );
}

const inputBase =
  "w-full h-11 rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[var(--lp-brand-ink)] focus:ring-4 focus:ring-[var(--lp-brand-tint)]";

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
  const [reveal, setReveal] = useState(false);
  const isPassword = inputProps.type === "password";
  // When the user reveals a password field, swap type to "text". Leave all other
  // field types untouched.
  const effectiveType = isPassword && reveal ? "text" : inputProps.type;
  return (
    <div>
      <label htmlFor={id} className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        )}
        <input
          id={id}
          {...inputProps}
          type={effectiveType}
          className={`${inputBase} ${Icon ? "pl-10" : ""} ${isPassword ? "pr-10" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            tabIndex={-1}
            aria-label={reveal ? "Hide password" : "Show password"}
            aria-pressed={reveal}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
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
      style={{ background: "oklch(0.19 0.012 240)" }}
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
