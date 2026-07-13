"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { AuthShell, AuthField, AuthError, AuthButton } from "@/components/auth/AuthShell";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, token: twoFactorToken || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      if (data.twoFactorRequired) {
        setTwoFactorRequired(true);
        setError("");
        setLoading(false);
        return;
      }

      if (data.requiresPasswordReset) {
        window.location.href = "/reset-password";
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your workspace to pick up where you left off."
      badge="256-bit encrypted"
      footer={
        <>
          <span className="inline-flex items-center gap-2 flex-wrap justify-center">
            New to QuoteGen?
            <Link href="/signup"
                  className="inline-flex items-center gap-1 no-underline font-bold rounded-full px-3 py-1.5 text-[12.5px] transition-transform active:scale-[0.97]"
                  style={{ color: "var(--lp-brand-ink)", background: "var(--lp-brand-tint)", border: "1px solid var(--lp-brand-ink)" }}>
              Create workspace →
            </Link>
          </span>
          <span className="block mt-3 text-[12.5px] text-slate-400">
            Need help?{" "}
            <Link href="/support/new" className="font-semibold no-underline" style={{ color: "var(--lp-brand-ink)" }}>Contact Support</Link>
          </span>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AuthField
          label="Work email"
          icon={Mail}
          id="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
        <div>
          <AuthField
            label="Password"
            icon={Lock}
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
          <div className="text-right mt-2">
            <Link href="/forgot-password" className="text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700 no-underline">
              Forgot password?
            </Link>
          </div>
        </div>
        {twoFactorRequired && (
          <AuthField
            label="Authentication code"
            icon={Lock}
            id="twoFactorToken"
            type="text"
            inputMode="numeric"
            autoFocus
            value={twoFactorToken}
            onChange={(e) => setTwoFactorToken(e.target.value)}
            placeholder="6-digit code from your authenticator app"
          />
        )}
        <AuthError message={error} />
        <AuthButton loading={loading}>{loading ? "Signing in…" : twoFactorRequired ? "Verify & sign in" : "Sign in"}</AuthButton>
      </form>
    </AuthShell>
  );
}
