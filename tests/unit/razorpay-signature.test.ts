import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "crypto";

/**
 * Mock-Razorpay payment-flow test at the security-critical layer: the HMAC
 * signature checks that gate whether a payment is trusted. We never hit the
 * Razorpay network — we forge the exact signature Razorpay would send and
 * assert the verifier accepts it, then prove any tamper is rejected.
 */

// The checkout verifier reads RAZORPAY_KEY_SECRET at module load, so make sure
// a deterministic secret is present before the dynamic import below.
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "test_secret_for_unit";
const WEBHOOK_SECRET = "test_webhook_secret";

let verifyPaymentSignature: typeof import("@/lib/razorpay").verifyPaymentSignature;
let verifyWebhookSignature: typeof import("@/lib/razorpay").verifyWebhookSignature;

beforeAll(async () => {
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_dummy";
  const mod = await import("@/lib/razorpay");
  verifyPaymentSignature = mod.verifyPaymentSignature;
  verifyWebhookSignature = mod.verifyWebhookSignature;
});

function checkoutSignature(orderId: string, paymentId: string) {
  return createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

describe("Razorpay checkout signature verification", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";

  it("accepts a correctly signed payment (captured → would mark paid)", () => {
    const signature = checkoutSignature(orderId, paymentId);
    expect(verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it("rejects a tampered payment id (attacker swaps the payment)", () => {
    const signature = checkoutSignature(orderId, paymentId);
    expect(verifyPaymentSignature({ orderId, paymentId: "pay_FORGED", signature })).toBe(false);
  });

  it("rejects a tampered order id", () => {
    const signature = checkoutSignature(orderId, paymentId);
    expect(verifyPaymentSignature({ orderId: "order_FORGED", paymentId, signature })).toBe(false);
  });

  it("rejects a garbage / empty signature", () => {
    expect(verifyPaymentSignature({ orderId, paymentId, signature: "" })).toBe(false);
    expect(verifyPaymentSignature({ orderId, paymentId, signature: "deadbeef" })).toBe(false);
  });
});

describe("Razorpay webhook signature verification", () => {
  it("accepts a body signed with the webhook secret", () => {
    const rawBody = JSON.stringify({ event: "payment.captured", payload: {} });
    const sig = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    expect(verifyWebhookSignature(rawBody, sig)).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const rawBody = JSON.stringify({ event: "payment.captured", payload: {} });
    const sig = createHmac("sha256", "wrong_secret").update(rawBody).digest("hex");
    expect(verifyWebhookSignature(rawBody, sig)).toBe(false);
  });

  it("rejects a replayed body that was altered after signing", () => {
    const original = JSON.stringify({ event: "payment.captured", amount: 100 });
    const sig = createHmac("sha256", WEBHOOK_SECRET).update(original).digest("hex");
    const altered = JSON.stringify({ event: "payment.captured", amount: 999999 });
    expect(verifyWebhookSignature(altered, sig)).toBe(false);
  });
});
