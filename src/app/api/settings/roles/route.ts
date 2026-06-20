import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { logAudit } from "@/lib/audit";
import { getAdminPermissions, getEmptyPermissions } from "@/lib/permissions";

async function GET_handler() {
  try {
    const roles = await prisma.userRole.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json({ roles });
  } catch {
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const body = await request.json();
    const { name, description, permissions } = body;

    if (!name) return NextResponse.json({ error: "Role name is required" }, { status: 400 });

    const existing = await prisma.userRole.findFirst({ where: { name } });
    if (existing) return NextResponse.json({ error: "Role name already exists" }, { status: 409 });

    const role = await prisma.userRole.create({
      data: {
        companyId: requireCompanyId(),
        name,
        description: description || "",
        permissions: permissions || getEmptyPermissions(),
        isSystem: false,
      },
    });

    logAudit({
      userId,
      entity: "UserRole",
      entityId: role.id,
      action: "CREATE",
      after: { name, description },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
