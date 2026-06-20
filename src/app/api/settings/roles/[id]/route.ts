import { withApi, revokeRoleSessions } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { logAudit } from "@/lib/audit";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const role = await prisma.userRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } }, users: { select: { id: true, name: true, email: true, isActive: true } } },
    });
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json({ role });
  } catch {
    return NextResponse.json({ error: "Failed to fetch role" }, { status: 500 });
  }
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "";
    const body = await request.json();
    const { name, description, permissions } = body;

    const role = await prisma.userRole.findUnique({ where: { id } });
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

    if (role.isSystem && name && name !== role.name) {
      return NextResponse.json({ error: "Cannot rename system roles" }, { status: 400 });
    }

    if (name && name !== role.name) {
      const dup = await prisma.userRole.findFirst({ where: { name } });
      if (dup) return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }

    const before = { name: role.name, description: role.description };
    const updated = await prisma.userRole.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(permissions !== undefined && { permissions }),
      },
    });

    // Permissions are baked into each user's JWT — when they change, revoke the
    // sessions of everyone holding this role so the new permissions take effect
    // on their next request (forces a re-login with a fresh token).
    if (permissions !== undefined) {
      await revokeRoleSessions(id);
    }

    logAudit({
      userId,
      entity: "UserRole",
      entityId: id,
      action: "UPDATE",
      before,
      after: { name: updated.name, description: updated.description },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ role: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "";

    const role = await prisma.userRole.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (role.isSystem) return NextResponse.json({ error: "Cannot delete system roles" }, { status: 400 });
    if (role._count.users > 0) {
      return NextResponse.json({ error: `Cannot delete role with ${role._count.users} active user(s). Reassign them first.` }, { status: 400 });
    }

    await prisma.userRole.delete({ where: { id } });

    logAudit({
      userId,
      entity: "UserRole",
      entityId: id,
      action: "DELETE",
      before: { name: role.name },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
