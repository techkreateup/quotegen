import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

type Data = Record<string, unknown>;
type Ctx = { params: Promise<{ id: string }> };

async function PUT_handler(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as Data;

    const existing = await prisma.followUp.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });

    const data: Data = {};
    if (typeof body.title === "string") data.title = body.title;
    if (typeof body.note === "string") data.note = body.note;
    if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(String(body.dueAt)) : null;

    // Status transitions: open ↔ snoozed ↔ done. Completing stamps completedAt;
    // reopening clears it.
    if (body.status === "done" || body.status === "open" || body.status === "snoozed") {
      data.status = body.status;
      data.completedAt = body.status === "done" ? new Date() : null;
    }

    const followUp = await prisma.followUp.update({ where: { id }, data });
    return NextResponse.json({ followUp });
  } catch {
    return NextResponse.json({ error: "Failed to update follow-up" }, { status: 500 });
  }
}

async function DELETE_handler(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.followUp.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
    await prisma.followUp.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete follow-up" }, { status: 500 });
  }
}

export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
