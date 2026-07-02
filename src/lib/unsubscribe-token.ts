import crypto from "crypto";

// ─── Unsubscribe tokens (DPDP) ─────────────────────────────────────────────
// Signed short tokens embedded in outbound emails so a recipient can flip the
// Client.doNotContact flag without logging in. HMAC-SHA256 over
// companyId|clientId, truncated to 16 hex chars — enough entropy against
// guessing but small enough to keep the URL clean. Base64-URL encodes the
// payload so the whole token is one path segment: /u/<token>.

const SECRET = process.env.UNSUBSCRIBE_SECRET
  || process.env.JWT_SECRET
  || "dev-only-unsubscribe-secret";

function sign(companyId: string, clientId: string): string {
  return crypto.createHmac("sha256", SECRET)
    .update(`${companyId}|${clientId}`)
    .digest("hex")
    .slice(0, 16);
}

export function makeUnsubscribeToken(companyId: string, clientId: string): string {
  const sig = sign(companyId, clientId);
  const payload = Buffer.from(`${companyId}.${clientId}.${sig}`, "utf8").toString("base64url");
  return payload;
}

export function verifyUnsubscribeToken(token: string): { companyId: string; clientId: string } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [companyId, clientId, sig] = raw.split(".");
    if (!companyId || !clientId || !sig) return null;
    const expected = sign(companyId, clientId);
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    return { companyId, clientId };
  } catch { return null; }
}
