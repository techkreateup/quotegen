import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await prismaUnscoped.issue.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, isActive: true } },
      reporter: { select: { name: true, email: true } },
      assignee: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, platformRole: true } } },
      },
    },
  });
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  return NextResponse.json({ issue });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staffId = request.headers.get("x-user-id") || "system";
  const body = await request.json();

  const issue = await prismaUnscoped.issue.findUnique({ where: { id } });
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.status && STATUSES.includes(body.status)) {
    data.status = body.status;
    data.resolvedAt = body.status === "RESOLVED" || body.status === "CLOSED" ? new Date() : null;
  }
  if (body.priority && PRIORITIES.includes(body.priority)) data.priority = body.priority;
  if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId || null;

  const updated = await prismaUnscoped.issue.update({ where: { id }, data });

  logAudit({
    userId: staffId,
    entity: "Issue",
    entityId: id,
    action: "SUPPORT_UPDATE",
    before: { status: issue.status, priority: issue.priority, assigneeId: issue.assigneeId },
    after: { status: updated.status, priority: updated.priority, assigneeId: updated.assigneeId },
  });
  return NextResponse.json({ issue: updated });
}

async function POST_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authorId = request.headers.get("x-user-id") || "";
  const { body, isInternal } = await request.json();

  if (!body || !String(body).trim()) {
    return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
  }
  const issue = await prismaUnscoped.issue.findUnique({ where: { id } });
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const comment = await prismaUnscoped.issueComment.create({
    data: { issueId: id, authorId, body: String(body).trim(), isInternal: !!isInternal },
    include: { author: { select: { name: true, platformRole: true } } },
  });
  return NextResponse.json({ comment }, { status: 201 });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const PUT = withApi(PUT_handler, { allowPlatform: true });
export const POST = withApi(POST_handler, { allowPlatform: true });
