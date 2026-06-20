import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { logAudit } from "@/lib/audit";

async function GET_handler() {
  try {
    const workflows = await prisma.workflow.findMany({
      include: {
        steps: { orderBy: { stepOrder: "asc" }, include: { approverRole: { select: { id: true, name: true } } } },
        _count: { select: { instances: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ workflows });
  } catch {
    return NextResponse.json({ error: "Failed to fetch workflows" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const body = await request.json();
    const { name, description, module, trigger, triggerRoleIds, isActive, allowSelfApproval, steps } = body;

    if (!name || !module || !trigger) {
      return NextResponse.json({ error: "Name, module, and trigger are required" }, { status: 400 });
    }

    const existing = await prisma.workflow.findFirst({
      where: { module, trigger },
    });
    if (existing) {
      return NextResponse.json({ error: `A workflow already exists for ${module} â†’ ${trigger}` }, { status: 409 });
    }

    if (!steps || steps.length === 0) {
      return NextResponse.json({ error: "At least one approval step is required" }, { status: 400 });
    }

    const workflow = await prisma.workflow.create({
      data: {
        companyId: requireCompanyId(),
        name,
        description: description || "",
        module,
        trigger,
        triggerRoleIds: triggerRoleIds || [],
        isActive: isActive !== false,
        allowSelfApproval: allowSelfApproval || false,
        steps: {
          create: steps.map((s: { name: string; approverType: string; approverRoleId?: string; approverUserId?: string }, i: number) => ({
            stepOrder: i + 1,
            name: s.name,
            approverType: s.approverType,
            approverRoleId: s.approverRoleId || null,
            approverUserId: s.approverUserId || null,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    logAudit({
      userId,
      entity: "Workflow",
      entityId: workflow.id,
      action: "CREATE",
      after: { name, module, trigger },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create workflow" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
