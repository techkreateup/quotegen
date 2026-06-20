import { jwtVerify, SignJWT } from "jose";
import type { Permissions } from "./permissions";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-dev-secret");

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

export async function verifyJwtEdge(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// Session length must match auth.ts (signJwt) so all issued tokens expire
// consistently. 24h, capped for security (no remember-me flow).
export async function signJwtEdge(payload: JwtPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}
