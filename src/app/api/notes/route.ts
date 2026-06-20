import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const entityType = sp.get("entityType");
    const entityId = sp.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
    }

    const notes = await prisma.entityNote.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (err: unknown) {
    console.error("GET /api/notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const { entityType, entityId, content, authorName } = data;

    if (!entityType || !entityId || !content) {
      return NextResponse.json({ error: "entityType, entityId, and content are required" }, { status: 400 });
    }

    const note = await prisma.entityNote.create({
      data: {
        companyId: requireCompanyId(),
        entityType,
        entityId,
        content,
        authorName: authorName || "Admin",
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const id = sp.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.entityNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
export const DELETE = withApi(DELETE_handler);
