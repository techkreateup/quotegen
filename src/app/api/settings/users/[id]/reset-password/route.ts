import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { requireCompanyId } from "@/lib/tenant-context";

async function POST_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUserId = request.headers.get("x-user-id") || "";
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { id, companyId: requireCompanyId() } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await prisma.user.update({
      where: { id },
      data: {
        password: hashPassword(password),
        mustResetPassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    logAudit({
      userId: currentUserId,
      entity: "User",
      entityId: id,
      action: "UPDATE",
      before: { mustResetPassword: user.mustResetPassword },
      after: { mustResetPassword: true, passwordReset: true },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler);
