import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  verifyPassword,
  signJwt,
  JwtPayload,
  TOKEN_COOKIE_NAME,
  TOKEN_COOKIE_MAX_AGE,
} from "@/lib/auth";
import { getAdminPermissions, type Permissions } from "@/lib/permissions";
import { track } from "@/lib/usage";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyToken } from "@/lib/twofactor";

export async function POST(request: NextRequest) {
  try {
    // Per-IP throttle (15-min window) — blunts broad bot sweeps from one host.
    if (!(await rateLimit(`login:${clientIp(request)}`, 5, 15 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 }
      );
    }
    // Short 1-minute burst guard per IP — stops rapid automated hammering even
    // before the wider window trips.
    if (!(await rateLimit(`login-burst:${clientIp(request)}`, 5, 60_000))) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const { email, password, token: twoFactorToken } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Per-account throttle (1-minute window) — defends a single account against
    // credential stuffing from rotating IPs, which the per-IP limits miss.
    if (!(await rateLimit(`login-acct:${email.toLowerCase().trim()}`, 5, 60_000))) {
      return NextResponse.json(
        { error: "Too many attempts for this account. Please wait a minute." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { userRole: true, company: true },
    });

    // Generic message for a missing account — do not reveal whether the email
    // exists. Account-state messages (deactivated / company disabled) are only
    // surfaced AFTER a correct password, so they can't be used to enumerate.
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json(
        { error: "Account is locked due to too many failed attempts. Try again later." },
        { status: 423 }
      );
    }

    const authenticated = user.password ? verifyPassword(password, user.password) : false;

    if (!authenticated) {
      const attempts = user.failedLoginAttempts + 1;
      const updateData: Record<string, unknown> = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await prisma.user.update({ where: { id: user.id }, data: updateData });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Password is correct from here on — now it's safe to reveal account state.
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated. Contact admin." },
        { status: 401 }
      );
    }

    if (user.company && !user.company.isActive) {
      return NextResponse.json(
        { error: "This company account has been disabled. Contact support." },
        { status: 403 }
      );
    }

    // Two-factor gate: password is correct, but if 2FA is enabled we require a
    // valid TOTP code before issuing the session cookie.
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!twoFactorToken) {
        return NextResponse.json({ twoFactorRequired: true });
      }
      if (!verifyToken(user.twoFactorSecret, user.email, String(twoFactorToken))) {
        return NextResponse.json({ error: "Invalid authentication code." }, { status: 401 });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const isSystemAdmin = user.userRole?.isSystem === true && user.userRole.name === "Admin";
    const permissions: Permissions = user.userRole
      ? (user.userRole.permissions as Permissions)
      : isSystemAdmin ? getAdminPermissions() : ({} as Permissions);

    const roleName = user.userRole?.name || "Unknown";

    track("login", undefined, { companyId: user.companyId, userId: user.id });

    const buildPayload = (mustReset: boolean): JwtPayload => ({
      userId: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      platformRole: user.platformRole,
      role: isSystemAdmin ? "ADMIN" : "EMPLOYEE",
      roleName,
      roleId: user.roleId || "",
      isSystemAdmin,
      permissions,
      mustResetPassword: mustReset,
      employeeId: user.employeeId,
      tosAccepted: !!user.tosAcceptedAt,
      tokenVersion: user.tokenVersion,
    });

    if (user.mustResetPassword) {
      const token = await signJwt(buildPayload(true));
      const response = NextResponse.json({
        requiresPasswordReset: true,
        user: { name: user.name, email: user.email },
      });
      response.cookies.set(TOKEN_COOKIE_NAME, token, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", path: "/", maxAge: TOKEN_COOKIE_MAX_AGE,
      });
      return response;
    }

    const payload = buildPayload(false);
    const token = await signJwt(payload);
    const response = NextResponse.json({ user: payload });
    response.cookies.set(TOKEN_COOKIE_NAME, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: TOKEN_COOKIE_MAX_AGE,
    });
    return response;
  } catch (err) {
    console.error("[login] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
