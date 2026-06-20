"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { startCheckout } from "@/lib/razorpay-checkout";
import { formatPlanPrice } from "@/lib/features";
import { CreditCard, Loader2, CheckCircle2, XCircle } from "lucide-react";

function CheckoutInner() {
  const params = useSearchParams();
  const router = useRouter();

  const planName = params.get("plan") || "Professional";

  // Price is read from the plan definition (source of truth), NOT the query param —
  // the URL `amount` is ignored so a tampered link can't change what's charged.
  const [amountPaise, setAmountPaise] = useState<number | null>(null);
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Mid-cycle upgrade proration: chargePaise is what's actually billed now
  // (full price minus the unused credit of the current plan).
  const [chargePaise, setChargePaise] = useState<number | null>(null);
  const [creditPaise, setCreditPaise] = useState(0);

  useEffect(() => {
    fetch("/api/plans/public")
      .then((r) => r.json())
      .then((d) => {
        const def = (d.plans ?? []).find((p: { name: string }) => p.name === planName);
        if (def) { setAmountPaise(def.priceInPaise); setBillingPeriod(def.billingPeriod); }
      })
      .catch(() => {})
      .finally(() => setLoadingPlan(false));
  }, [planName]);

  useEffect(() => {
    fetch(`/api/billing/proration?plan=${encodeURIComponent(planName)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.isUpgrade) { setChargePaise(d.chargeInPaise); setCreditPaise(d.creditInPaise); }
      })
      .catch(() => {});
  }, [planName]);

  // What the user pays now: prorated charge if applicable, else the full price.
  const payablePaise = chargePaise ?? amountPaise;
  const priceLabel = amountPaise == null ? "—" : formatPlanPrice(amountPaise, billingPeriod);
  const payableLabel = payablePaise == null ? "—" : `₹${(payablePaise / 100).toLocaleString("en-IN")}`;

  const [state, setState] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function pay() {
    const charge = payablePaise;
    if (!charge || charge < 100) {
      setState("error");
      setMessage("This plan isn't available for self-serve purchase.");
      return;
    }
    setState("processing");
    setMessage("");
    const res = await startCheckout({
      amount: charge,
      planName,
      name: "QuoteGen",
      description: `${planName} plan`,
    });
    if (res.status === "success") {
      setState("success");
      setTimeout(() => router.push("/plans"), 1500);
    } else if (res.status === "dismissed") {
      setState("idle");
      setMessage("Payment cancelled.");
    } else {
      setState("error");
      setMessage(res.error || "Payment failed. Please try again.");
    }
  }

  return (
    <div className="page-wrapper">
      <PageHeader title="Checkout" subtitle="Complete your upgrade" breadcrumbs={[{ label: "Plans", href: "/plans" }, { label: "Checkout" }]} />

      <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
            <CreditCard size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{planName} plan</h2>
            <p className="text-sm text-slate-500">{billingPeriod === "one-time" ? "Billed once" : `Billed ${billingPeriod}`}</p>
          </div>
        </div>

        <div className="border-y border-slate-100 py-4 my-4 space-y-1.5">
          {creditPaise > 0 && (
            <>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-500">{planName} plan</span>
                <span className="text-slate-700">{priceLabel}</span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-emerald-600">Credit for unused time</span>
                <span className="text-emerald-600">−₹{(creditPaise / 100).toLocaleString("en-IN")}</span>
              </div>
            </>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">Amount payable{creditPaise > 0 ? " now" : ""}</span>
            <span className="text-2xl font-bold text-slate-900">{loadingPlan ? "…" : payableLabel}</span>
          </div>
        </div>

        {state === "success" ? (
          <div className="flex items-center gap-2 text-emerald-600 font-semibold" role="status">
            <CheckCircle2 size={18} /> Payment successful — redirecting…
          </div>
        ) : (
          <button
            onClick={pay}
            disabled={state === "processing" || loadingPlan || !payablePaise}
            className="w-full h-11 rounded-lg bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-60"
          >
            {state === "processing" ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Processing…
              </>
            ) : (
              <>Pay {payableLabel}</>
            )}
          </button>
        )}

        {message && (
          <p className={`mt-3 text-sm flex items-center gap-1.5 ${state === "error" ? "text-red-600" : "text-slate-500"}`} role="alert">
            {state === "error" && <XCircle size={15} />} {message}
          </p>
        )}

        <p className="mt-4 text-xs text-slate-400 text-center">Secured by Razorpay. Test mode.</p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutInner />
    </Suspense>
  );
}
