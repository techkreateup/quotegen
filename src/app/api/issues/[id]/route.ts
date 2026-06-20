import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Tenant view of a single issue. Internal (support-only) comments are hidden.
async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      reporter: { select: { name: true, email: true } },
      assignee: { select: { name: true } },
      comments: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, platformRole: true } } },
      },
    },
  });
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  return NextResponse.json({ issue });
}

async function POST_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authorId = request.headers.get("x-user-id") || "";
  const { body } = await request.json();

  if (!body || !String(body).trim()) {
    return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
  }

  // Scoped lookup proves the issue belongs to this company before commenting
  const issue = await prisma.issue.findUnique({ where: { id } });
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const comment = await prisma.issueComment.create({
    data: { issueId: id, authorId, body: String(body).trim(), isInternal: false },
    include: { author: { select: { name: true, platformRole: true } } },
  });
  return NextResponse.json({ comment }, { status: 201 });
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
