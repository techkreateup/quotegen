import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { requireCompanyId } from "@/lib/tenant-context";
import { sendEmail, inviteEmail } from "@/lib/email";
import { checkSeatLimit } from "@/lib/plan-limits";

async function GET_handler(request: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: requireCompanyId() },
      include: { userRole: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const sanitized = users.map(({ password, ...u }) => u);
    return NextResponse.json({ users: sanitized });
  } catch {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const body = await request.json();
    const { name, email, password, roleId } = body;

    if (!name || !email || !password || !roleId) {
      return NextResponse.json({ error: "Name, email, password, and role are required" }, { status: 400 });
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    // Enforce the plan's seat limit before adding another login user.
    const seat = await checkSeatLimit(requireCompanyId());
    if (!seat.allowed) {
      return NextResponse.json(
        { error: `Your plan allows ${seat.limit} user${seat.limit === 1 ? "" : "s"} (${seat.used} in use). Upgrade to add more.` },
        { status: 403 }
      );
    }

    const role = await prisma.userRole.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Role lookup above is tenant-scoped, so a foreign roleId 404s before this.
    const user = await prisma.user.create({
      data: {
        companyId: requireCompanyId(),
        platformRole: role.name === "Admin" ? "COMPANY_ADMIN" : "COMPANY_USER",
        name,
        email: email.toLowerCase().trim(),
        password: hashPassword(password),
        roleId,
        isActive: true,
        mustResetPassword: true,
      },
      include: { userRole: { select: { id: true, name: true } } },
    });

    const { password: _pw, ...sanitized } = user;

    // Email the invite (fire-and-forget); the temp password also shows on screen
    // as a fallback for workspaces without email configured.
    const settings = await prisma.companySettings.findFirst({ select: { businessName: true } });
    const appUrl = process.env.APP_URL || request.nextUrl.origin;
    sendEmail({
      to: user.email,
      subject: `You've been invited to ${settings?.businessName || "QuoteGen"}`,
      html: inviteEmail(name, settings?.businessName || "your company", user.email, password, `${appUrl}/login`),
    }).catch(() => {});

    logAudit({
      userId,
      entity: "User",
      entityId: user.id,
      action: "CREATE",
      after: { name, email: user.email, roleId, roleName: role.name },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ user: sanitized }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
