"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, X } from "lucide-react";

// Shows a countdown banner in two scenarios:
//   1. TRIALING with a future trialEndsAt → "X days left in your free trial"
//   2. ACTIVE paid plan with currentPeriodEnd ≤ 7 days away → "X days until renewal"
// Dismissable per-day; re-appears at ≤3 days (urgent) regardless of dismissal.
interface Mode {
  kind: "trial" | "renewal" | "expired";
  daysLeft: number;
  planName?: string | null;
  isYearly?: boolean;
}

export default function TrialBanner() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    fetch("/api/plan")
      .then((r) => r.json())
      .then((d) => {
        if (!d) return;
        const today = new Date().toISOString().slice(0, 10);
        const key = `qg-banner-dismissed-${today}`;

        // Already-expired ACTIVE row (cron hasn't moved it yet, or PAST_DUE).
        if ((d.subscriptionStatus === "ACTIVE" || d.subscriptionStatus === "PAST_DUE") && d.currentPeriodEnd) {
          const ms = new Date(d.currentPeriodEnd).getTime() - Date.now();
          const days = Math.ceil(ms / 86_400_000);
          // Infer cadence from window length so the renew link preserves it.
          const windowMs = d.currentPeriodStart
            ? new Date(d.currentPeriodEnd).getTime() - new Date(d.currentPeriodStart).getTime()
            : 0;
          const isYearly = windowMs >= 350 * 86_400_000;
          if (days <= 0) {
            setMode({ kind: "expired", daysLeft: 0, planName: d.currentPlanId, isYearly });
            setDismissed(false); // expired is always shown
            return;
          }
          if (days <= 7) {
            setMode({ kind: "renewal", daysLeft: days, planName: d.currentPlanId, isYearly });
            setDismissed(days > 3 && localStorage.getItem(key) === "1");
            return;
          }
        }

        // Trial countdown (only when no renewal banner was shown).
        if (d.subscriptionStatus === "TRIALING" && d.trialEndsAt) {
          const days = Math.max(0, Math.ceil((new Date(d.trialEndsAt).getTime() - Date.now()) / 86_400_000));
          setMode({ kind: "trial", daysLeft: days });
          setDismissed(days > 3 && localStorage.getItem(key) === "1");
        }
      })
      .catch(() => {});
  }, []);

  if (dismissed || mode === null) return null;

  function dismiss() {
    const key = `qg-banner-dismissed-${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(key, "1");
    setDismissed(true);
  }

  const urgent = mode.kind === "expired" || mode.daysLeft <= 3;
  const colors = urgent
    ? { bg: "#FEE2E2", fg: "#991B1B", border: "#FECACA" }
    : { bg: "#EEF2FF", fg: "#3730A3", border: "#E0E7FF" };

  const message = (() => {
    if (mode.kind === "expired") {
      const renewHref = mode.planName
        ? `/checkout?plan=${encodeURIComponent(mode.planName)}${mode.isYearly ? "&period=yearly" : ""}`
        : "/billing";
      return (
        <>
          Your <strong>{mode.planName || "subscription"}</strong> has expired. Renew to restore full access.{" "}
          <Link href={renewHref} className="font-bold underline underline-offset-2">Renew now</Link>
        </>
      );
    }
    if (mode.kind === "renewal") {
      const planLabel = mode.planName ? <strong>{mode.planName}</strong> : "subscription";
      const when = mode.daysLeft === 0
        ? "today"
        : mode.daysLeft === 1
          ? "tomorrow"
          : `in ${mode.daysLeft} days`;
      const renewHref = mode.planName
        ? `/checkout?plan=${encodeURIComponent(mode.planName)}${mode.isYearly ? "&period=yearly" : ""}`
        : "/billing";
      return (
        <>
          Your {planLabel} plan renews {when}.{" "}
          <Link href={renewHref} className="font-bold underline underline-offset-2">Renew now</Link>
        </>
      );
    }
    return (
      <>
        {mode.daysLeft === 0
          ? "Your free trial ends today."
          : `${mode.daysLeft} day${mode.daysLeft === 1 ? "" : "s"} left in your free trial.`}{" "}
        <Link href="/plans" className="font-bold underline underline-offset-2">Upgrade now</Link>
      </>
    );
  })();

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-sm"
      style={{
        background: colors.bg,
        color: colors.fg,
        borderBottom: `1px solid ${colors.border}`,
      }}
      role="status"
    >
      <Clock size={16} className="shrink-0" />
      <span className="flex-1">{message}</span>
      {!urgent && (
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
