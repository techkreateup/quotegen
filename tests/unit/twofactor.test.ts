import { describe, it, expect } from "vitest";
import * as OTPAuth from "otpauth";
import { generateSecret, verifyToken } from "@/lib/twofactor";

describe("twofactor", () => {
  it("generates a base32 secret", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThan(10);
  });

  it("verifies a freshly generated token", () => {
    const secret = generateSecret();
    const totp = new OTPAuth.TOTP({
      issuer: "QuoteGen",
      label: "user@example.com",
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const token = totp.generate();
    expect(verifyToken(secret, "user@example.com", token)).toBe(true);
  });

  it("rejects an incorrect token", () => {
    const secret = generateSecret();
    expect(verifyToken(secret, "user@example.com", "000000")).toBe(false);
  });
});
