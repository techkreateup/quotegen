"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Loader2 } from "lucide-react";

export default function AcceptTermsPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/accept-tos", { method: "POST" });
      if (res.ok) {
        // Hard redirect so the JWT cookie (just re-signed with tosAccepted=true)
        // is picked up on the very next request. router.push kept an older
        // cached auth state and looped some users back here.
        window.location.href = "/";
        return;
      }
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Something went wrong. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Shield size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Accept our Terms</h1>
            <p className="text-sm text-slate-500">One-time step to continue using QuoteGen</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          We&apos;ve updated our Terms of Service and Privacy Policy. Please review and accept them to continue.
        </p>

        <div className="flex flex-col gap-2 mb-6 text-sm">
          <Link href="/terms" target="_blank" className="text-indigo-600 hover:underline font-medium">
            Terms of Service →
          </Link>
          <Link href="/privacy" target="_blank" className="text-indigo-600 hover:underline font-medium">
            Privacy Policy →
          </Link>
        </div>

        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          <span className="text-sm text-slate-700">
            I have read and agree to the Terms of Service and Privacy Policy.
          </span>
        </label>

        {error && (
          <p className="mb-4 text-sm text-red-600" role="alert">{error}</p>
        )}

        <button
          onClick={accept}
          disabled={!checked || submitting}
          className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Accepting…</>
          ) : (
            "I Accept"
          )}
        </button>
      </div>
    </div>
  );
}
