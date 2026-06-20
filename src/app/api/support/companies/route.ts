import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// Support view of companies — onboarding status + admin contact only.
// Deliberately excludes financial data (invoices, revenue, etc.).
async function GET_handler(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const where: Record<string, unknown> = {};
  if (q) where.name = { contains: q, mode: "insensitive" };

  const companies = await prismaUnscoped.company.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      onboarding: { select: { currentStep: true, completedAt: true, skippedAt: true } },
      users: {
        where: { platformRole: "COMPANY_ADMIN" },
        select: { name: true, email: true },
        take: 1,
      },
      _count: {
        select: {
          users: true,
          issues: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
        },
      },
    },
  });

  return NextResponse.json({
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      createdAt: c.createdAt,
      onboarding: c.onboarding?.completedAt
        ? "completed"
        : c.onboarding?.skippedAt
          ? "skipped"
          : `step ${(c.onboarding?.currentStep ?? 0) + 1} of 4`,
      adminContact: c.users[0] ?? null,
      users: c._count.users,
      openIssues: c._count.issues,
    })),
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
