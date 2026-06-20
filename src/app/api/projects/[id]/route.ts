import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, projectUpdateSchema } from "@/lib/schemas";

async function GET_handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { businessName: true } },
        tasks: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ...project,
      clientName: project.client?.businessName || "",
      client: undefined,
    });
  } catch (err: unknown) {
    console.error("GET /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function PUT_handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(projectUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.tasks;
    delete data.activityLogs;
    delete data.clientName;
    delete data.client;
    delete data.taskCount;
    delete data.doneCount;

    if (data.deadline) data.deadline = new Date(data.deadline);
    else if (data.deadline === "") data.deadline = null;
    if (data.completedAt) data.completedAt = new Date(data.completedAt);
    else if (data.completedAt === "") data.completedAt = null;

    // Auto-set completedAt when status changes to Completed
    if (data.status === "Completed" && !data.completedAt) {
      data.completedAt = new Date();
    }
    if (data.status && data.status !== "Completed") {
      data.completedAt = null;
    }

    const project = await prisma.project.update({ where: { id }, data });
    return NextResponse.json(project);
  } catch (err: unknown) {
    console.error("PUT /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Cascade: remove any transactions referencing this project
    await prisma.transaction.deleteMany({ where: { referenceType: "Project", referenceId: id } });
    // ActivityLog and tasks cascade via onDelete: Cascade in schema
    // Delete entity notes
    await prisma.entityNote.deleteMany({ where: { entityType: "Project", entityId: id } }).catch(() => {});
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
