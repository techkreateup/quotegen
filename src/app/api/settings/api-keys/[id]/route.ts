import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";

// DELETE /api/settings/api-keys/:id — revoke (deactivate) a key.
async function DELETE_handler(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // findFirst is tenant-scoped, so a foreign key id resolves to null.
  const existing = await prisma.apiKey.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.apiKey.update({ where: { id }, data: { isActive: false } });

  const userId = request.headers.get("x-user-id") || "system";
  logAudit({ userId, entity: "ApiKey", entityId: id, action: "DELETE", after: { isActive: false } });

  return NextResponse.json({ ok: true });
}

export const DELETE = withApi(DELETE_handler);
