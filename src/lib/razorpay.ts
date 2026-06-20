import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  // Surfaced at module load so misconfiguration fails fast in non-prod.
  console.warn(
    "[razorpay] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — payment routes will error."
  );
}

/** Server-side Razorpay client. Never expose KEY_SECRET to the browser. */
export const razorpay = new Razorpay({
  key_id: keyId ?? "",
  key_secret: keySecret ?? "",
});

/** Public key id, safe to send to the browser for the checkout widget. */
export const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? keyId ?? "";

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Razorpay checkout signature.
 * signature = HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET)
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!keySecret) return false;
  const expected = createHmac("sha256", keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, params.signature);
}

/**
 * Verify a Razorpay webhook signature (X-Razorpay-Signature header).
 * signature = HMAC_SHA256(rawBody, WEBHOOK_SECRET)
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
