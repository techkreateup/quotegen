import crypto from "crypto";

const SECRET = process.env.SHARE_SECRET
  || process.env.JWT_SECRET
  || "dev-only-share-secret";

function sign(type: string, id: string): string {
  return crypto.createHmac("sha256", SECRET)
    .update(`${type}|${id}`)
    .digest("hex")
    .slice(0, 20);
}

export function makeShareToken(type: string, id: string): string {
  return sign(type, id);
}

export function verifyShareToken(type: string, id: string, token: string): boolean {
  try {
    const expected = sign(type, id);
    return crypto.timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
}
