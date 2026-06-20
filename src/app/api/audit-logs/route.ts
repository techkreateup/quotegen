import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuditRetentionDays } from "@/lib/retention";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const entity = sp.get("entity");
    const action = sp.get("action");
    const from = sp.get("from");
    const to = sp.get("to");
    const page = parseInt(sp.get("page") || "1", 10);
    const limit = 50;

    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + "T23:59:59.999Z");
    }

    const [logs, total, retentionDays] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
      getAuditRetentionDays(),
    ]);

    return NextResponse.json({
      retentionDays,
      logs: logs.map((l) => ({
        id: l.id,
        userId: l.userId,
        userName: l.user.name,
        userEmail: l.user.email,
        entity: l.entity,
        entityId: l.entityId,
        action: l.action,
        before: l.before,
        after: l.after,
        ip: l.ip,
        createdAt: l.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error("Audit logs GET error:", e);
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
