import { withApi, revokeUserSessions } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireCompanyId } from "@/lib/tenant-context";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await prisma.user.findFirst({
      where: { id, companyId: requireCompanyId() },
      include: { userRole: { select: { id: true, name: true } } },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const { password, ...sanitized } = user;
    return NextResponse.json({ user: sanitized });
  } catch {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUserId = request.headers.get("x-user-id") || "";
    const body = await request.json();
    const { name, email, roleId, isActive } = body;

    const user = await prisma.user.findFirst({
      where: { id, companyId: requireCompanyId() },
      include: { userRole: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Self-lockout prevention
    if (id === currentUserId) {
      if (isActive === false) {
        return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
      }
      if (roleId && roleId !== user.roleId) {
        return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
      }
    }

    // Last admin protection
    if (isActive === false && user.userRole?.isSystem && user.userRole.name === "Admin") {
      const adminCount = await prisma.user.count({
        where: {
          companyId: requireCompanyId(),
          isActive: true,
          userRole: { isSystem: true, name: "Admin" },
        },
      });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot deactivate the last admin user" }, { status: 400 });
      }
    }

    if (roleId) {
      const role = await prisma.userRole.findUnique({ where: { id: roleId } });
      if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const before = { name: user.name, email: user.email, roleId: user.roleId, isActive: user.isActive };

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email: email.toLowerCase().trim() }),
        ...(roleId !== undefined && { roleId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { userRole: { select: { id: true, name: true } } },
    });

    const { password, ...sanitized } = updated;

    // A role change alters baked-in JWT permissions; deactivation must end access.
    // Revoke the target's sessions so the change is enforced on their next request.
    if ((roleId !== undefined && roleId !== before.roleId) || isActive === false) {
      await revokeUserSessions(id);
    }

    logAudit({
      userId: currentUserId,
      entity: "User",
      entityId: id,
      action: "UPDATE",
      before,
      after: { name: updated.name, email: updated.email, roleId: updated.roleId, isActive: updated.isActive },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ user: sanitized });
  } catch {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const currentUserId = request.headers.get("x-user-id") || "";

    if (id === currentUserId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { id, companyId: requireCompanyId() } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Soft delete — deactivate instead, and revoke the user's sessions.
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    await revokeUserSessions(id);

    logAudit({
      userId: currentUserId,
      entity: "User",
      entityId: id,
      action: "DELETE",
      before: { name: user.name, email: user.email, isActive: true },
      after: { isActive: false },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
