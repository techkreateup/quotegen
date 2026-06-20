import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { Permissions } from "./permissions";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-dev-secret");
const TOKEN_NAME = "qg_token";
// Session length. Capped at 24h for security (no remember-me flow yet). If a
// remember-me option is added later, that path may extend to 7 days.
const TOKEN_MAX_AGE = 60 * 60 * 24; // 24 hours
const TOKEN_EXPIRY = "24h";

export type PlatformRole = "SUPER_ADMIN" | "SUPPORT" | "COMPANY_ADMIN" | "COMPANY_USER";

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  companyId: string | null;
  platformRole: PlatformRole;
  role: "ADMIN" | "EMPLOYEE";
  roleName: string;
  roleId: string;
  isSystemAdmin: boolean;
  permissions: Permissions;
  mustResetPassword: boolean;
  employeeId: string | null;
  tosAccepted: boolean;
  /** Session-revocation counter; must match the user's current DB tokenVersion. */
  tokenVersion: number;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!PASSWORD_REGEX.test(password))
    return "Password must contain at least 1 uppercase, 1 lowercase, and 1 number";
  return null;
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_NAME)?.value;
  if (!token) return null;
  return verifyJwt(token);
}

export const TOKEN_COOKIE_NAME = TOKEN_NAME;
export const TOKEN_COOKIE_MAX_AGE = TOKEN_MAX_AGE;
