import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { signJwt, type JwtPayload, TOKEN_COOKIE_NAME, TOKEN_COOKIE_MAX_AGE } from "@/lib/auth";
import type { Permissions } from "@/lib/permissions";

async function POST_handler(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await prismaUnscoped.user.update({
    where: { id: userId },
    data: { tosAcceptedAt: new Date() },
    include: { userRole: true },
  });

  const isSystemAdmin = user.userRole?.isSystem && user.userRole.name === "Admin";
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: user.companyId,
    platformRole: user.platformRole,
    role: isSystemAdmin ? "ADMIN" : "EMPLOYEE",
    roleName: user.userRole?.name || "Unknown",
    roleId: user.roleId || "",
    isSystemAdmin: !!isSystemAdmin,
    permissions: (user.userRole?.permissions as Permissions) ?? {},
    mustResetPassword: false,
    employeeId: user.employeeId,
    tosAccepted: true,
    tokenVersion: user.tokenVersion,
  };

  const token = await signJwt(payload);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_COOKIE_MAX_AGE,
  });
  return response;
}

export const POST = withApi(POST_handler, { allowPlatform: true });
