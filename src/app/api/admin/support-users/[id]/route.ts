import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = request.headers.get("x-user-id") || "system";
  const body = await request.json();

  const user = await prismaUnscoped.user.findFirst({
    where: { id, platformRole: "SUPPORT" },
  });
  if (!user) return NextResponse.json({ error: "Support user not found" }, { status: 404 });

  const updated = await prismaUnscoped.user.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
    },
    select: { id: true, name: true, email: true, platformRole: true, isActive: true },
  });

  logAudit({
    userId: adminId,
    entity: "User",
    entityId: id,
    action: "UPDATE_SUPPORT_USER",
    before: { name: user.name, isActive: user.isActive },
    after: { name: updated.name, isActive: updated.isActive },
  });
  return NextResponse.json({ user: updated });
}

export const PUT = withApi(PUT_handler, { allowPlatform: true });
