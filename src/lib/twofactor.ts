import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "QuoteGen";

/** Creates a new TOTP secret (base32) for a user. */
export function generateSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function totp(secret: string, email: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/** Builds the otpauth:// URI and a QR-code data URL for an authenticator app. */
export async function buildOtpAuth(secret: string, email: string): Promise<{ uri: string; qr: string }> {
  const uri = totp(secret, email).toString();
  const qr = await QRCode.toDataURL(uri);
  return { uri, qr };
}

/** Verifies a 6-digit TOTP token, allowing ±1 time-step of clock drift. */
export function verifyToken(secret: string, email: string, token: string): boolean {
  const delta = totp(secret, email).validate({ token: token.replace(/\s/g, ""), window: 1 });
  return delta !== null;
}
