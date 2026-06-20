import { withApi, invalidateUserTokenCache } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// Generate a readable, strong temp password (meets typical strength rules).
function tempPassword(): string {
  const part = () => Math.random().toString(36).slice(2, 6);
  return `Qg-${part()}${part()}!${Math.floor(10 + Math.random() * 89)}`;
}

// Per-user platform actions on COMPANY users:
//   { action: "activate" | "deactivate" | "unlock" | "reset_password" }
async function PATCH_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = request.headers.get("x-user-id") || "system";
  const { action } = await request.json();

  // Only company users (not platform staff — manage those at /admin/support-users).
  const user = await prismaUnscoped.user.findFirst({ where: { id, companyId: { not: null } } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let result: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};
  let auditAction = action;

  switch (action) {
    case "activate":
      data.isActive = true;
      break;
    case "deactivate":
      data.isActive = false;
      data.tokenVersion = { increment: 1 }; // end the user's active sessions
      break;
    case "unlock":
      data.lockedUntil = null;
      data.failedLoginAttempts = 0;
      auditAction = "UNLOCK_USER";
      break;
    case "reset_password": {
      const temp = tempPassword();
      data.password = hashPassword(temp);
      data.mustResetPassword = true;
      data.failedLoginAttempts = 0;
      data.lockedUntil = null;
      data.tokenVersion = { increment: 1 }; // invalidate sessions on a forced reset
      auditAction = "RESET_PASSWORD";
      result = { tempPassword: temp };
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await prismaUnscoped.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, isActive: true, lockedUntil: true, mustResetPassword: true },
  });

  if (action === "deactivate" || action === "reset_password") {
    invalidateUserTokenCache(id);
  }

  logAudit({
    userId: adminId,
    entity: "User",
    entityId: id,
    action: auditAction,
    before: { isActive: user.isActive },
    after: { isActive: updated.isActive },
  });

  return NextResponse.json({ user: { ...updated, locked: !!updated.lockedUntil && updated.lockedUntil > new Date() }, ...result });
}

export const PATCH = withApi(PATCH_handler, { allowPlatform: true });
