import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";

async function PATCH_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = request.headers.get("x-user-id") || "system";
  const body = await request.json();

  const existing = await prismaUnscoped.platformAnnouncement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.body === "string") data.body = body.body;
  if (["INFO", "WARNING", "CRITICAL"].includes(body.severity)) data.severity = body.severity;
  if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;

  const a = await prismaUnscoped.platformAnnouncement.update({ where: { id }, data });
  logAudit({ userId: adminId, entity: "PlatformAnnouncement", entityId: id, action: "UPDATE", after: { isActive: a.isActive } });
  return NextResponse.json({ announcement: a });
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = request.headers.get("x-user-id") || "system";
  await prismaUnscoped.platformAnnouncement.delete({ where: { id } });
  logAudit({ userId: adminId, entity: "PlatformAnnouncement", entityId: id, action: "DELETE" });
  return NextResponse.json({ ok: true });
}

export const PATCH = withApi(PATCH_handler, { allowPlatform: true });
export const DELETE = withApi(DELETE_handler, { allowPlatform: true });
