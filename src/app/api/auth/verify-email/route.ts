import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { invalidateUserVerifiedCache } from "@/lib/with-api";

// GET /api/auth/verify-email?token=xxx
// Public route: marks the user verified and redirects to login.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const appUrl = process.env.APP_URL || request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?verified=invalid`);
  }

  const user = await prismaUnscoped.user.findUnique({ where: { verificationToken: token } });
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?verified=invalid`);
  }

  if (!user.emailVerified) {
    await prismaUnscoped.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null },
    });
    invalidateUserVerifiedCache(user.id);
  }

  return NextResponse.redirect(`${appUrl}/login?verified=success`);
}
