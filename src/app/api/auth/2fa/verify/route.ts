import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { verifyToken } from "@/lib/twofactor";
import { logAudit } from "@/lib/audit";

// POST /api/auth/2fa/verify { token } — confirm a token and enable 2FA.
async function POST_handler(request: NextRequest) {
  const userId = getTenantContext()?.userId;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { token } = await request.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) {
    return NextResponse.json({ error: "Start 2FA setup first" }, { status: 400 });
  }

  if (!verifyToken(user.twoFactorSecret, user.email, String(token))) {
    return NextResponse.json({ error: "Invalid code. Try again." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  logAudit({ userId, entity: "User", entityId: userId, action: "UPDATE", after: { twoFactorEnabled: true } });

  return NextResponse.json({ ok: true });
}

export const POST = withApi(POST_handler, { allowPlatform: true });
