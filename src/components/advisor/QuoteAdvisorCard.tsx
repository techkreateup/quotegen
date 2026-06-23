"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, TrendingUp, Info } from "lucide-react";

// Inline Decision Advisor card for the quotation editor. Posts the draft's
// (de-identified server-side) figures to /api/advisor/quote and renders the
// cross-company win-probability + an optional discount suggestion. Debounced so
// it doesn't fire on every keystroke. Renders nothing when the feature is off.
interface Advice {
  status: "ok" | "learning" | "off";
  currentBand?: string;
  winProbability?: number | null;
  confidenceLow?: number | null;
  confidenceHigh?: number | null;
  basedOn?: { deals: number; tenants: number; level: number; levelLabel: string } | null;
  suggestion?: { band: string; winProbability: number; winProbDeltaPts: number } | null;
  evidence?: string;
}

interface Props {
  clientId: string;
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  currency?: string;
  quotationId?: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function QuoteAdvisorCard({
  clientId,
  subtotal,
  totalDiscount,
  totalAmount,
  currency = "INR",
  quotationId,
}: Props) {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    // Need a client and a non-trivial amount before there's anything to advise.
    const ready = Boolean(clientId) && totalAmount > 0;
    timer.current = setTimeout(async () => {
      if (!ready) {
        setAdvice(null);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/advisor/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, subtotal, totalDiscount, totalAmount, currency, quotationId }),
        });
        if (res.ok) setAdvice(await res.json());
      } catch {
        /* advisor is non-essential; stay silent on failure */
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [clientId, subtotal, totalDiscount, totalAmount, currency, quotationId]);

  // Feature disabled, or nothing to show yet.
  if (!advice || advice.status === "off") return null;

  const win = advice.winProbability ?? null;
  const winColor = win == null ? "#7C3AED" : win >= 0.6 ? "#059669" : win >= 0.35 ? "#D97706" : "#DC2626";

  return (
    <div
      className="card"
      style={{ padding: 18, borderColor: "#E9D5FF", background: "linear-gradient(180deg,#FBFAFF,#FFFFFF)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="av av-sm av-grad" style={{ background: "linear-gradient(135deg,#7C3AED,#A78BFA)" }}>
          <Sparkles size={13} color="#fff" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Decision Advisor</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#7C3AED", background: "#F3E8FF", padding: "1px 6px", borderRadius: 6 }}>
          BETA
        </span>
        {loading && <span style={{ fontSize: 11, color: "var(--text-3)" }}>analyzing…</span>}
      </div>

      {advice.status === "learning" ? (
        <p style={{ fontSize: 12.5, color: "var(--text-3)", display: "flex", gap: 6, alignItems: "center" }}>
          <Info size={13} /> {advice.evidence || "Still learning — not enough comparable deals yet."}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: 28, fontWeight: 800, color: winColor }}>{win != null ? pct(win) : "—"}</span>
            <span style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>likely to win</span>
            {advice.confidenceLow != null && advice.confidenceHigh != null && (
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                ({pct(advice.confidenceLow)}–{pct(advice.confidenceHigh)})
              </span>
            )}
          </div>

          {advice.suggestion && (
            <div
              className="flex items-center gap-2 mt-2.5"
              style={{ fontSize: 12.5, color: "#065F46", background: "#ECFDF5", borderRadius: 8, padding: "8px 10px" }}
            >
              <TrendingUp size={14} />
              <span>
                Peers win more at a <strong>{advice.suggestion.band}</strong> discount —{" "}
                {advice.suggestion.winProbDeltaPts > 0 ? `about +${advice.suggestion.winProbDeltaPts} pts` : "a better balance of"}{" "}
                win probability.
              </span>
            </div>
          )}

          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10 }}>{advice.evidence}</p>
        </>
      )}
    </div>
  );
}
