import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// Platform staff (SUPPORT / SUPER_ADMIN) — cross-company issue queue.
async function GET_handler(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const where: Record<string, unknown> = {};
  if (sp.get("status")) where.status = sp.get("status");
  if (sp.get("priority")) where.priority = sp.get("priority");
  if (sp.get("companyId")) where.companyId = sp.get("companyId");
  if (sp.get("assigneeId")) where.assigneeId = sp.get("assigneeId");

  const issues = await prismaUnscoped.issue.findMany({
    where,
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    include: {
      company: { select: { id: true, name: true } },
      reporter: { select: { name: true, email: true } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  });
  return NextResponse.json({ issues });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
