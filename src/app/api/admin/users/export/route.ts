import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toCSV, csvDownloadHeaders } from "@/lib/csv";
import type { Prisma } from "@/generated/prisma/client";

// Export the global user directory (CSV), honouring the same filters as the
// Users page. SUPER_ADMIN only.
async function GET_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const companyId = sp.get("companyId")?.trim();
  const status = sp.get("status");

  const where: Prisma.UserWhereInput = { companyId: { not: null } };
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }];
  if (companyId) where.companyId = companyId;
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (status === "locked") where.lockedUntil = { gt: new Date() };

  const users = await prismaUnscoped.user.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, email: true, platformRole: true, isActive: true,
      lastLoginAt: true, lockedUntil: true, mustResetPassword: true, createdAt: true,
      company: { select: { name: true } },
      userRole: { select: { name: true } },
    },
  });

  const headers = ["User ID", "Name", "Email", "Company", "Role", "Platform role", "Status", "Locked", "Must reset", "Last login", "Created"];
  const now = new Date();
  const rows = users.map((u) => [
    u.id, u.name, u.email, u.company?.name ?? "", u.userRole?.name ?? "", u.platformRole,
    u.isActive ? "Active" : "Inactive",
    u.lockedUntil && u.lockedUntil > now ? "Yes" : "No",
    u.mustResetPassword ? "Yes" : "No",
    u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : "never",
    u.createdAt.toISOString().slice(0, 10),
  ]);

  logAudit({ userId: adminId, entity: "User", entityId: "export", action: "EXPORT_USERS", after: { count: users.length } });

  const csv = toCSV(headers, rows);
  return new NextResponse(csv, { headers: csvDownloadHeaders(`quotegen-users-${new Date().toISOString().slice(0, 10)}.csv`) });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
