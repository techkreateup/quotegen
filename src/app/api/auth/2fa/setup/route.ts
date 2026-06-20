import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { generateSecret, buildOtpAuth } from "@/lib/twofactor";

// POST /api/auth/2fa/setup — generate a new secret + QR. Not enabled until the
// user confirms a token via /api/auth/2fa/verify.
async function POST_handler() {
  const userId = getTenantContext()?.userId;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const secret = generateSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });

  const { uri, qr } = await buildOtpAuth(secret, user.email);
  return NextResponse.json({ secret, uri, qr });
}

export const POST = withApi(POST_handler, { allowPlatform: true });
