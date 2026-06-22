import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import {
  hashPassword,
  validatePasswordStrength,
  signJwt,
  type JwtPayload,
  TOKEN_COOKIE_NAME,
  TOKEN_COOKIE_MAX_AGE,
} from "@/lib/auth";
import { getAdminPermissions, getEmployeePermissions, type Permissions } from "@/lib/permissions";
import { PLAN_DEFS, type Plan } from "@/lib/features";
import { track } from "@/lib/usage";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendEmail, verificationEmail } from "@/lib/email";
import { randomUUID } from "crypto";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "company";
}

export async function POST(request: NextRequest) {
  try {
    if (!(await rateLimit(`signup:${clientIp(request)}`, 5, 15 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many signup attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const companyName = String(body.companyName ?? "").trim();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    // Only live (non-coming-soon) plans are selectable; anything else falls back
    // to the Free launch plan (everything included for 3 months).
    const requested = String(body.plan ?? "Free") as Plan;
    const plan = PLAN_DEFS[requested] && !PLAN_DEFS[requested].comingSoon ? requested : "Free";
    const acceptTos = body.acceptTos === true;

    if (!companyName || companyName.length < 2) {
      return NextResponse.json({ error: "Company name is required (min 2 characters)" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Your name is required" }, { status: 400 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    const pwError = validatePasswordStrength(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }
    if (!acceptTos) {
      return NextResponse.json(
        { error: "You must accept the Terms of Service and Privacy Policy to sign up." },
        { status: 400 }
      );
    }

    const existing = await prismaUnscoped.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try logging in." },
        { status: 409 }
      );
    }

    // Unique slug: base, base-2, base-3, ...
    const baseSlug = slugify(companyName);
    let slug = baseSlug;
    for (let i = 2; await prismaUnscoped.company.findUnique({ where: { slug } }); i++) {
      slug = `${baseSlug}-${i}`;
    }

    const verificationToken = randomUUID();

    const { user, company } = await prismaUnscoped.$transaction(async (tx) => {
      // Sequential human-readable code (CMP-0001, …), unique even with gaps.
      let seq = (await tx.company.count()) + 1;
      let code = `CMP-${String(seq).padStart(4, "0")}`;
      while (await tx.company.findUnique({ where: { code } })) {
        seq++;
        code = `CMP-${String(seq).padStart(4, "0")}`;
      }

      const company = await tx.company.create({
        data: {
          code,
          name: companyName,
          slug,
          plan,
          settings: { create: { businessName: companyName, email } },
          onboarding: { create: {} },
        },
      });

      const adminRole = await tx.userRole.create({
        data: {
          companyId: company.id,
          name: "Admin",
          description: "Full access to this company",
          permissions: getAdminPermissions() as never,
          isSystem: true,
        },
      });
      await tx.userRole.create({
        data: {
          companyId: company.id,
          name: "Employee",
          description: "Sales access",
          permissions: getEmployeePermissions() as never,
          isSystem: true,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashPassword(password),
          companyId: company.id,
          platformRole: "COMPANY_ADMIN",
          roleId: adminRole.id,
          isActive: true,
          mustResetPassword: false,
          emailVerified: false,
          verificationToken,
          tosAcceptedAt: new Date(),
        },
        include: { userRole: true },
      });

      return { user, company };
    });

    track("company_created", { companyName, plan }, { companyId: company.id, userId: user.id });

    // Send the email-verification link (fire-and-forget; dev logs to console).
    const appUrl = process.env.APP_URL || request.nextUrl.origin;
    sendEmail({
      to: user.email,
      subject: "Verify your email — QuoteGen",
      html: verificationEmail(user.name, `${appUrl}/api/auth/verify-email?token=${verificationToken}`),
    }).catch(() => {});

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      companyId: company.id,
      platformRole: "COMPANY_ADMIN",
      role: "ADMIN",
      roleName: "Admin",
      roleId: user.roleId || "",
      isSystemAdmin: true,
      permissions: (user.userRole?.permissions as Permissions) ?? getAdminPermissions(),
      mustResetPassword: false,
      employeeId: null,
      tosAccepted: true,
      tokenVersion: user.tokenVersion,
    };
    const token = await signJwt(payload);
    const response = NextResponse.json({ user: payload, company: { id: company.id, name: company.name } }, { status: 201 });
    response.cookies.set(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TOKEN_COOKIE_MAX_AGE,
    });
    return response;
  } catch (err) {
    console.error("POST /api/auth/signup error:", err);
    return NextResponse.json({ error: "Signup failed. Please try again." }, { status: 500 });
  }
}
