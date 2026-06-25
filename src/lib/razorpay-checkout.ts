// Client-side helpers for the Razorpay Checkout widget.

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (resp: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}

/** Loads the Razorpay checkout script once; resolves when window.Razorpay is ready. */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface CheckoutResult {
  status: "success" | "failed" | "dismissed";
  error?: string;
}

/**
 * Runs the full checkout flow: create order → open modal → verify signature.
 * `amount` is in paise. Resolves once the user completes, cancels, or it fails.
 */
export async function startCheckout(opts: {
  amount: number;
  planName?: string;
  billingPeriod?: string;
  name?: string;
  description?: string;
  prefill?: RazorpayOptions["prefill"];
}): Promise<CheckoutResult> {
  const ok = await loadRazorpayScript();
  if (!ok || !window.Razorpay) {
    return { status: "failed", error: "Could not load payment gateway" };
  }

  const orderRes = await fetch("/api/payments/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: opts.amount,
      currency: "INR",
      planName: opts.planName,
      billingPeriod: opts.billingPeriod || "monthly",
    }),
  });
  const order = await orderRes.json();
  if (!orderRes.ok) {
    return { status: "failed", error: order.error || "Failed to create order" };
  }

  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";

  return new Promise<CheckoutResult>((resolve) => {
    const rzp = new window.Razorpay!({
      key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: opts.name || "QuoteGen",
      description: opts.description,
      prefill: opts.prefill,
      notes: opts.planName ? { planName: opts.planName } : undefined,
      theme: { color: "#4F46E5" },
      handler: async (resp) => {
        const vr = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resp),
        });
        const vd = await vr.json();
        if (vr.ok && vd.status === "CAPTURED") {
          resolve({ status: "success" });
        } else {
          resolve({ status: "failed", error: vd.error || "Verification failed" });
        }
      },
      modal: { ondismiss: () => resolve({ status: "dismissed" }) },
    });
    rzp.open();
  });
}
