import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// GET /api/admin/tickets?status=OPEN|RESOLVED|ALL → list public support tickets.
// Super-admin only (proxy enforces; we still re-check below for defense in depth).
async function GET_handler(request: NextRequest) {
  const platformRole = request.headers.get("x-platform-role");
  if (platformRole !== "SUPER_ADMIN" && platformRole !== "SUPPORT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const where = statusParam && statusParam !== "ALL" ? { status: statusParam } : {};
  const tickets = await prismaUnscoped.supportTicket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const counts = await prismaUnscoped.supportTicket.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const summary = { OPEN: 0, RESOLVED: 0 } as Record<string, number>;
  for (const c of counts) summary[c.status] = c._count._all;
  return NextResponse.json({ tickets, summary });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
