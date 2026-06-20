import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 30;

// Global audit-log viewer across all companies + platform actions.
async function GET_handler(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const entity = sp.get("entity")?.trim();
  const action = sp.get("action")?.trim();
  const companyId = sp.get("companyId")?.trim();
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (entity) where.entity = entity;
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (companyId) where.companyId = companyId === "platform" ? null : companyId;

  const [total, logs] = await Promise.all([
    prismaUnscoped.auditLog.count({ where }),
    prismaUnscoped.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { name: true, email: true, platformRole: true } },
        company: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      entity: l.entity,
      entityId: l.entityId,
      action: l.action,
      actor: l.user ? { name: l.user.name, email: l.user.email, role: l.user.platformRole } : null,
      company: l.company,
      before: l.before,
      after: l.after,
      ip: l.ip,
      createdAt: l.createdAt,
    })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
