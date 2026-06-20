import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;

// Global user directory across every tenant. Search-first, paginated for 1000+ users.
async function GET_handler(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const companyId = sp.get("companyId")?.trim();
  const status = sp.get("status"); // active | inactive | locked
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const SORTABLE = ["createdAt", "name", "email", "lastLoginAt"] as const;
  const sort = (SORTABLE as readonly string[]).includes(sp.get("sort") || "") ? (sp.get("sort") as string) : "createdAt";
  const dir = sp.get("dir") === "asc" ? "asc" : "desc";

  const where: Prisma.UserWhereInput = { companyId: { not: null } };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (companyId) where.companyId = companyId;
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (status === "locked") where.lockedUntil = { gt: new Date() };

  const [total, users] = await Promise.all([
    prismaUnscoped.user.count({ where }),
    prismaUnscoped.user.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        isActive: true,
        lastLoginAt: true,
        lockedUntil: true,
        mustResetPassword: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
        userRole: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      locked: !!u.lockedUntil && u.lockedUntil > new Date(),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
