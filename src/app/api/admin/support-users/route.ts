import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function GET_handler() {
  const users = await prismaUnscoped.user.findMany({
    where: { platformRole: { in: ["SUPPORT", "SUPER_ADMIN"] } },
    select: { id: true, name: true, email: true, platformRole: true, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

async function POST_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const { name, email, password } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const normalized = String(email).toLowerCase().trim();
  const existing = await prismaUnscoped.user.findUnique({ where: { email: normalized } });
  if (existing) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

  const user = await prismaUnscoped.user.create({
    data: {
      name,
      email: normalized,
      password: hashPassword(password),
      platformRole: "SUPPORT",
      companyId: null,
      isActive: true,
      mustResetPassword: true,
    },
    select: { id: true, name: true, email: true, platformRole: true, isActive: true },
  });

  logAudit({ userId: adminId, entity: "User", entityId: user.id, action: "CREATE_SUPPORT_USER", after: { name, email: normalized } });
  return NextResponse.json({ user }, { status: 201 });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const POST = withApi(POST_handler, { allowPlatform: true });
