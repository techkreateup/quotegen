import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { sendEmail, verificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { randomUUID } from "crypto";

// Re-sends the email-verification link for the current user.
async function POST_handler(request: NextRequest) {
  const userId = getTenantContext()?.userId;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await rateLimit(`resend-verify:${userId}`, 3, 10 * 60_000))) {
    return NextResponse.json({ error: "Please wait before requesting another email." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

  const token = randomUUID();
  await prisma.user.update({ where: { id: userId }, data: { verificationToken: token } });

  const appUrl = process.env.APP_URL || request.nextUrl.origin;
  await sendEmail({
    to: user.email,
    subject: "Verify your email — QuoteGen",
    html: verificationEmail(user.name, `${appUrl}/api/auth/verify-email?token=${token}`),
  });

  return NextResponse.json({ ok: true });
}

export const POST = withApi(POST_handler);
