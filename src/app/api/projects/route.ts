import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, projectSchema } from "@/lib/schemas";

async function GET_handler() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { businessName: true } }, tasks: true },
    });
    const result = projects.map((p) => ({
      ...p,
      clientName: p.client?.businessName || "",
      taskCount: p.tasks.length,
      doneCount: p.tasks.filter((t) => t.status === "Done").length,
      client: undefined,
      tasks: undefined,
    }));
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("GET /api/projects error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(projectSchema, data);
    if (!v.ok) return v.response!;
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.tasks;
    delete data.activityLogs;
    delete data.clientName;
    delete data.taskCount;
    delete data.doneCount;

    if (data.deadline) data.deadline = new Date(data.deadline);
    if (data.completedAt) data.completedAt = new Date(data.completedAt);

    const project = await prisma.project.create({ data });
    return NextResponse.json(project, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/projects error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
