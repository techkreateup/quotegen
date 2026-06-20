"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, X } from "lucide-react";

// Shows a countdown banner while the company is on a trial with a set end date.
// Dismissable, but re-appears at ≤3 days remaining (persisted per-day in localStorage).
export default function TrialBanner() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    fetch("/api/plan")
      .then((r) => r.json())
      .then((d) => {
        if (d?.subscriptionStatus !== "TRIALING" || !d.trialEndsAt) return;
        const days = Math.max(0, Math.ceil((new Date(d.trialEndsAt).getTime() - Date.now()) / 86_400_000));
        setDaysLeft(days);
        const key = `trial-banner-dismissed-${new Date().toISOString().slice(0, 10)}`;
        // Re-appear at ≤3 days regardless of prior dismissal.
        setDismissed(days > 3 && localStorage.getItem(key) === "1");
      })
      .catch(() => {});
  }, []);

  if (dismissed || daysLeft === null) return null;

  function dismiss() {
    const key = `trial-banner-dismissed-${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(key, "1");
    setDismissed(true);
  }

  const urgent = daysLeft <= 3;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-sm"
      style={{
        background: urgent ? "#FEE2E2" : "#EEF2FF",
        color: urgent ? "#991B1B" : "#3730A3",
        borderBottom: `1px solid ${urgent ? "#FECACA" : "#E0E7FF"}`,
      }}
    >
      <Clock size={16} className="shrink-0" />
      <span className="flex-1">
        {daysLeft === 0
          ? "Your free trial ends today."
          : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial.`}{" "}
        <Link href="/plans" className="font-bold underline underline-offset-2">Upgrade now</Link>
      </span>
      {!urgent && (
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
