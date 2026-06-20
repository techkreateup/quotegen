import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { toCSV, csvDownloadHeaders } from "@/lib/csv";

// Company-scoped audit log export (CSV). Uses the scoped client so a company
// can only ever export its OWN logs. Honours the same filters as the list view.
// Capped to keep the response bounded.
const MAX_ROWS = 5000;

async function GET_handler(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const entity = sp.get("entity");
  const action = sp.get("action");
  const from = sp.get("from");
  const to = sp.get("to");

  const where: Record<string, unknown> = {};
  if (entity && entity !== "All") where.entity = entity;
  if (action && action !== "All") where.action = action;
  if (from || to) {
    const range: Record<string, unknown> = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to + "T23:59:59.999Z");
    where.createdAt = range;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  const headers = ["Date", "Actor", "Email", "Action", "Entity", "Entity ID", "IP"];
  const rows = logs.map((l) => [
    l.createdAt.toISOString(),
    l.user?.name ?? "System",
    l.user?.email ?? "",
    l.action,
    l.entity,
    l.entityId,
    l.ip ?? "",
  ]);

  const csv = toCSV(headers, rows);
  return new NextResponse(csv, {
    headers: csvDownloadHeaders(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`),
  });
}

export const GET = withApi(GET_handler);
