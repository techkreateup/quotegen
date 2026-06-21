import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, TOKEN_COOKIE_NAME } from "@/lib/auth";
import { prismaUnscoped } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await verifyJwt(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  // Verification status isn't in the JWT — read it fresh so the dashboard banner
  // reflects the current state.
  const dbUser = await prismaUnscoped.user.findUnique({
    where: { id: user.userId },
    select: { emailVerified: true, twoFactorEnabled: true, avatarUrl: true },
  });
  return NextResponse.json({
    user: {
      ...user,
      emailVerified: dbUser?.emailVerified ?? true,
      twoFactorEnabled: dbUser?.twoFactorEnabled ?? false,
      avatarUrl: dbUser?.avatarUrl ?? "",
    },
  });
}
