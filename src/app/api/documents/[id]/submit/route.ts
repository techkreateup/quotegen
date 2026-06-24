import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { checkAndTriggerWorkflow } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";

// Submit a document into the approval workflow (module "documents", trigger
// "create"). Opt-in: only documents sent here move to pending_approval, so plain
// uploads stay visible/approved. If no matching active workflow exists, the
// document is marked approved straight away.
async function POST_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.document.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const userId = request.headers.get("x-user-id") || "system";
  const userRoleId = request.headers.get("x-user-role-id") || "";
  const isSystemAdmin = request.headers.get("x-user-system-admin") === "true";

  let triggered = false;
  if (!isSystemAdmin && userRoleId) {
    const wf = await checkAndTriggerWorkflow({
      module: "documents", trigger: "create",
      entityId: id, entityType: "documents",
      userId, userRoleId,
    });
    triggered = wf.triggered;
  }

  const status = triggered ? "pending_approval" : "approved";
  const updated = await prisma.document.update({ where: { id }, data: { status } });

  logAudit({ userId, entity: "Document", entityId: id, action: "SUBMIT_DOCUMENT", after: { status } });
  return NextResponse.json({ document: updated, triggered });
}

export const POST = withApi(POST_handler);
