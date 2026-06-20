"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthShell, AuthField, AuthError, AuthSuccess, AuthButton } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
      } else {
        setMessage(data.message);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your work email and we'll send you a secure reset link — valid for one hour."
      badge="Single-use secure link"
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 no-underline">
            Back to sign in
          </Link>
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
        <AuthError message={error} />
        <AuthSuccess message={message} />
        <AuthButton loading={loading}>{loading ? "Sending…" : "Send reset link"}</AuthButton>
      </form>
    </AuthShell>
  );
}
