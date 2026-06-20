"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { MailWarning } from "lucide-react";

export default function EmailVerificationBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [sending, setSending] = useState(false);

  // Only show for logged-in users whose email is explicitly unverified.
  if (!user || user.emailVerified !== false) return null;

  async function resend() {
    setSending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      if (res.ok) toast.success("Verification email sent — check your inbox.");
      else toast.error((await res.json()).error || "Could not send email.");
    } catch {
      toast.error("Could not send email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex items-center gap-3 px-4 py-2.5 text-sm"
      style={{ background: "#FEF3C7", color: "#92400E", borderBottom: "1px solid #FDE68A" }}
    >
      <MailWarning size={16} className="shrink-0" />
      <span className="flex-1">
        Please verify your email address to unlock creating clients, quotations, and invoices.
      </span>
      <button
        onClick={resend}
        disabled={sending}
        className="font-semibold underline underline-offset-2 disabled:opacity-60 whitespace-nowrap"
      >
        {sending ? "Sending…" : "Resend email"}
      </button>
    </div>
  );
}
