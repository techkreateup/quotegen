import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function PUT_handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const data = await request.json();
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.projectId;

    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    else if (data.dueDate === "") data.dueDate = null;

    const task = await prisma.projectTask.update({ where: { id: taskId }, data });
    return NextResponse.json(task);
  } catch (err: unknown) {
    console.error("PUT /api/projects/[id]/tasks/[taskId] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { taskId } = await params;
    await prisma.projectTask.delete({ where: { id: taskId } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/projects/[id]/tasks/[taskId] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
