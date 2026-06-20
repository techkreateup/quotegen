import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  verifyJwt,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  signJwt,
  JwtPayload,
  TOKEN_COOKIE_NAME,
  TOKEN_COOKIE_MAX_AGE,
} from "@/lib/auth";
import { type Permissions } from "@/lib/permissions";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { invalidateUserTokenCache } from "@/lib/with-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Public flow: reset via emailed token (forgot password) ──────────
    if (body.token) {
      if (!(await rateLimit(`reset:${clientIp(request)}`, 3, 60 * 60 * 1000))) {
        return NextResponse.json(
          { error: "Too many password reset attempts. Try again later." },
          { status: 429 }
        );
      }
      const { createHash } = await import("node:crypto");
      const hashed = createHash("sha256").update(String(body.token)).digest("hex");
      const newPassword = String(body.newPassword ?? "");

      const strengthError = validatePasswordStrength(newPassword);
      if (strengthError) {
        return NextResponse.json({ error: strengthError }, { status: 400 });
      }

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: hashed,
          passwordResetExpiresAt: { gt: new Date() },
          isActive: true,
        },
      });
      if (!user) {
        return NextResponse.json(
          { error: "This reset link is invalid or has expired. Request a new one." },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashPassword(newPassword),
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          mustResetPassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
          // Invalidate any other outstanding sessions after a password reset.
          tokenVersion: { increment: 1 },
        },
      });
      invalidateUserTokenCache(user.id);

      return NextResponse.json({ success: true, message: "Password updated. You can now log in." });
    }

    // ── Logged-in flow: change/force-reset password ──────────────────────
    const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await verifyJwt(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { currentPassword, newPassword } = body;

    if (!newPassword) {
      return NextResponse.json({ error: "New password is required" }, { status: 400 });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { userRole: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If not a forced reset, require current password
    if (!user.mustResetPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }
      const valid = user.password
        ? verifyPassword(currentPassword, user.password)
        : false;
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
      }
    }

    // Prevent reuse of same password
    if (user.password && verifyPassword(newPassword, user.password)) {
      return NextResponse.json(
        { error: "New password must be different from the current one" },
        { status: 400 }
      );
    }

    // Bump the version (revokes other sessions) and re-issue this session's token
    // with the new version so the current device stays signed in.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashPassword(newPassword),
        mustResetPassword: false,
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    });
    invalidateUserTokenCache(user.id);

    const isSystemAdmin = user.userRole?.isSystem === true && user.userRole.name === "Admin";
    const permissions: Permissions = user.userRole
      ? (user.userRole.permissions as Permissions)
      : ({} as Permissions);

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      companyId: user.companyId,
      platformRole: user.platformRole,
      role: isSystemAdmin ? "ADMIN" : "EMPLOYEE",
      roleName: user.userRole?.name || "Unknown",
      roleId: user.roleId || "",
      isSystemAdmin,
      permissions,
      mustResetPassword: false,
      employeeId: user.employeeId,
      tosAccepted: !!user.tosAcceptedAt,
      tokenVersion: updated.tokenVersion,
    };

    const newToken = await signJwt(payload);
    const response = NextResponse.json({ success: true, user: payload });
    response.cookies.set(TOKEN_COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TOKEN_COOKIE_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
