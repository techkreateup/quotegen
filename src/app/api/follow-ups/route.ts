import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

type Data = Record<string, unknown>;

// List follow-ups: all open/snoozed, plus recently-completed for context.
async function GET_handler() {
  try {
    const [active, recentDone] = await Promise.all([
      prisma.followUp.findMany({
        where: { status: { in: ["open", "snoozed"] } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      }),
      prisma.followUp.findMany({
        where: { status: "done" },
        orderBy: { completedAt: "desc" },
        take: 30,
      }),
    ]);
    return NextResponse.json({ followUps: [...active, ...recentDone] });
  } catch {
    return NextResponse.json({ error: "Failed to load follow-ups" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const userName = request.headers.get("x-user-name") || "";
    const body = (await request.json().catch(() => ({}))) as Data;

    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });

    const followUp = await prisma.followUp.create({
      data: {
        companyId: requireCompanyId(),
        entityType: String(body.entityType ?? ""),
        entityId: String(body.entityId ?? ""),
        title,
        note: String(body.note ?? ""),
        status: "open",
        dueAt: body.dueAt ? new Date(String(body.dueAt)) : null,
        channel: String(body.channel ?? ""),
        assignedToId: body.assignedToId ? String(body.assignedToId) : null,
        assignedToName: String(body.assignedToName ?? ""),
        createdById: userId || null,
        createdByName: userName,
      },
    });
    return NextResponse.json({ followUp }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create follow-up" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
