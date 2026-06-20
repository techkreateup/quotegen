import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";

    const where: Record<string, unknown> = { userId };
    if (unreadOnly) where.isRead = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        isRead: n.isRead,
        link: n.link,
        createdAt: n.createdAt.toISOString(),
      }))
    );
  } catch (e) {
    console.error("Notifications GET error:", e);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

// Mark one or all as read
async function PUT_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const body = await request.json();

    if (body.markAllRead) {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      await prisma.notification.update({
        where: { id: body.id },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Missing id or markAllRead" }, { status: 400 });
  } catch (e) {
    console.error("Notifications PUT error:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// Delete a notification
async function DELETE_handler(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.notification.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Notifications DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
