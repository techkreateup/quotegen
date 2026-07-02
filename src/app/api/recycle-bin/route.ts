import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { listDeleted, restoreRow, RECYCLABLE, type RecyclableModel } from "@/lib/recycle-bin";
import { logAudit } from "@/lib/audit";
import prisma from "@/lib/db";

// GET  /api/recycle-bin           → list every soft-deleted row across the
//                                    recyclable models for the current tenant.
// POST /api/recycle-bin { action, model, id }
//   action=restore  → clear deletedAt, stamp restoredAt/By, write audit.
//   action=purge    → permanently hard-delete (admin only).
async function GET_handler(_r: NextRequest) {
  const rows = await listDeleted();
  return NextResponse.json({ rows });
}

async function POST_handler(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "";
  const userName = request.headers.get("x-user-name") || "";
  const isSystemAdmin = request.headers.get("x-user-system-admin") === "true";
  const body = await request.json().catch(() => ({})) as { action?: string; model?: string; id?: string };
  const model = String(body.model || "") as RecyclableModel;
  const id = String(body.id || "");
  const action = String(body.action || "restore");

  if (!RECYCLABLE.includes(model)) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (action === "purge") {
    if (!isSystemAdmin) return NextResponse.json({ error: "Only admins can permanently delete" }, { status: 403 });
    // Hard delete via the scoped Prisma client so tenant scoping still applies.
    const delegate = (prisma as unknown as Record<string, { delete: (a: unknown) => Promise<unknown> }>)[model.charAt(0).toLowerCase() + model.slice(1)];
    await delegate.delete({ where: { id } });
    logAudit({ userId, entity: model, entityId: id, action: "PURGE", before: { source: "recycle-bin" } });
    return NextResponse.json({ ok: true, action: "purged" });
  }

  const row = await restoreRow(model, id, userId, userName);
  logAudit({ userId, entity: model, entityId: id, action: "RESTORE", after: { restoredByName: userName } });
  return NextResponse.json({ ok: true, action: "restored", row });
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
