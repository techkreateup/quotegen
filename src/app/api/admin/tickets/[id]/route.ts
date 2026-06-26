import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// PATCH /api/admin/tickets/:id { status }  — toggle OPEN ⇄ RESOLVED.
async function PATCH_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const platformRole = request.headers.get("x-platform-role");
  // Proxy already restricts /api/admin/* to SUPER_ADMIN; defense in depth.
  if (platformRole !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status || "");
  if (!["OPEN", "RESOLVED"].includes(status)) {
    return NextResponse.json({ error: "status must be OPEN or RESOLVED" }, { status: 400 });
  }
  const existing = await prismaUnscoped.supportTicket.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const updated = await prismaUnscoped.supportTicket.update({ where: { id }, data: { status } });
  logAudit({
    userId: request.headers.get("x-user-id") || "system",
    entity: "SupportTicket", entityId: id, action: "STATUS_CHANGE",
    before: { status: existing.status }, after: { status: updated.status },
  });
  return NextResponse.json({ ticket: updated });
}

export const PATCH = withApi(PATCH_handler, { allowPlatform: true });
