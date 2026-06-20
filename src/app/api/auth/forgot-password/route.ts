import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prismaUnscoped } from "@/lib/db";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    if (!(await rateLimit(`forgot:${clientIp(request)}`, 3, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const { email } = await request.json();
    const normalized = String(email ?? "").trim().toLowerCase();

    // Always return the same response so emails can't be enumerated.
    const genericResponse = NextResponse.json({
      message: "If an account exists for this email, a reset link has been sent.",
    });

    if (!normalized) return genericResponse;

    const user = await prismaUnscoped.user.findUnique({ where: { email: normalized } });
    if (!user || !user.isActive) return genericResponse;

    const rawToken = randomBytes(32).toString("hex");
    const hashed = createHash("sha256").update(rawToken).digest("hex");

    await prismaUnscoped.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashed,
        passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const appUrl = process.env.APP_URL || request.nextUrl.origin;
    const link = `${appUrl}/reset-password?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your QuoteGen password",
      html: passwordResetEmail(user.name, link),
    });

    return genericResponse;
  } catch (err) {
    console.error("POST /api/auth/forgot-password error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
