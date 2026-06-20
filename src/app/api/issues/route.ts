import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { track } from "@/lib/usage";

// Tenant-side issue reporting. Scoped client guarantees company isolation.
async function GET_handler(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const where: Record<string, unknown> = {};
  if (sp.get("status")) where.status = sp.get("status");
  if (sp.get("priority")) where.priority = sp.get("priority");

  const issues = await prisma.issue.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { name: true } },
      assignee: { select: { name: true } },
      _count: { select: { comments: { where: { isInternal: false } } } },
    },
  });
  return NextResponse.json({ issues });
}

async function POST_handler(request: NextRequest) {
  const body = await request.json();
  const reporterId = request.headers.get("x-user-id") || "";
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const priority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(body.priority) ? body.priority : "MEDIUM";

  if (!title || title.length < 5) {
    return NextResponse.json({ error: "Title is required (min 5 characters)" }, { status: 400 });
  }

  const issue = await prisma.issue.create({
    data: {
      companyId: requireCompanyId(),
      reporterId,
      title,
      description,
      priority,
    },
  });
  track("issue_reported", { priority });
  return NextResponse.json({ issue }, { status: 201 });
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
