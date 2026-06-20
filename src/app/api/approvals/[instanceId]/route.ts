import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { processApproval } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";

async function POST_handler(request: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  try {
    const { instanceId } = await params;
    const userId = request.headers.get("x-user-id") || "";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { decision, comments } = body;

    if (!decision || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "Decision must be 'approved' or 'rejected'" }, { status: 400 });
    }

    if (decision === "rejected" && !comments) {
      return NextResponse.json({ error: "Comments are required when rejecting" }, { status: 400 });
    }

    const result = await processApproval({
      instanceId,
      approverId: userId,
      decision,
      comments,
    });

    logAudit({
      userId,
      entity: "WorkflowInstance",
      entityId: instanceId,
      action: "UPDATE",
      after: { decision, comments, resultStatus: result.status },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) || "Failed to process approval" }, { status: 400 });
  }
}

export const POST = withApi(POST_handler);
