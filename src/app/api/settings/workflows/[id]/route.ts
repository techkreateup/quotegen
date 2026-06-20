import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepOrder: "asc" }, include: { approverRole: { select: { id: true, name: true } } } },
        _count: { select: { instances: true } },
      },
    });
    if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    return NextResponse.json({ workflow });
  } catch {
    return NextResponse.json({ error: "Failed to fetch workflow" }, { status: 500 });
  }
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "";
    const body = await request.json();
    const { name, description, triggerRoleIds, isActive, allowSelfApproval, steps } = body;

    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

    if (steps) {
      await prisma.workflowStep.deleteMany({ where: { workflowId: id } });
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(triggerRoleIds !== undefined && { triggerRoleIds }),
        ...(isActive !== undefined && { isActive }),
        ...(allowSelfApproval !== undefined && { allowSelfApproval }),
        ...(steps && {
          steps: {
            create: steps.map((s: { name: string; approverType: string; approverRoleId?: string; approverUserId?: string }, i: number) => ({
              stepOrder: i + 1,
              name: s.name,
              approverType: s.approverType,
              approverRoleId: s.approverRoleId || null,
              approverUserId: s.approverUserId || null,
            })),
          },
        }),
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    logAudit({
      userId,
      entity: "Workflow",
      entityId: id,
      action: "UPDATE",
      before: { name: workflow.name },
      after: { name: updated.name },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ workflow: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update workflow" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = request.headers.get("x-user-id") || "";

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: { _count: { select: { instances: { where: { status: "pending" } } } } },
    });
    if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

    if (workflow._count.instances > 0) {
      return NextResponse.json(
        { error: `Cannot delete workflow with ${workflow._count.instances} pending instance(s). Complete or cancel them first.` },
        { status: 400 }
      );
    }

    await prisma.workflow.delete({ where: { id } });

    logAudit({
      userId,
      entity: "Workflow",
      entityId: id,
      action: "DELETE",
      before: { name: workflow.name },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete workflow" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
