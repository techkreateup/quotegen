import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tasks = await prisma.projectTask.findMany({
      where: { projectId: id },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(tasks);
  } catch (err: unknown) {
    console.error("GET /api/projects/[id]/tasks error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    if (data.dueDate) data.dueDate = new Date(data.dueDate);

    // Get next sort order
    const last = await prisma.projectTask.findFirst({
      where: { projectId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    data.sortOrder = (last?.sortOrder ?? -1) + 1;
    data.projectId = id;

    const task = await prisma.projectTask.create({ data });
    return NextResponse.json(task, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/projects/[id]/tasks error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
