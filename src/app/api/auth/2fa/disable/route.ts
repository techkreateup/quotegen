import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { verifyToken } from "@/lib/twofactor";
import { logAudit } from "@/lib/audit";

// POST /api/auth/2fa/disable { token } — turn off 2FA (requires a valid code).
async function POST_handler(request: NextRequest) {
  const userId = getTenantContext()?.userId;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { token } = await request.json().catch(() => ({}));
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }
  if (!token || !verifyToken(user.twoFactorSecret, user.email, String(token))) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  logAudit({ userId, entity: "User", entityId: userId, action: "UPDATE", after: { twoFactorEnabled: false } });

  return NextResponse.json({ ok: true });
}

export const POST = withApi(POST_handler, { allowPlatform: true });
