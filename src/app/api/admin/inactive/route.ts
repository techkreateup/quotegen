import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { nudgeInactive } from "@/lib/nudge";

const DAY = 24 * 60 * 60 * 1000;

// GET: active companies with no usage event in the last `days` (default 30).
async function GET_handler(request: NextRequest) {
  const days = Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 30);
  const cutoff = new Date(Date.now() - days * DAY);

  const companies = await prismaUnscoped.company.findMany({
    where: { isActive: true, usageEvents: { none: { createdAt: { gte: cutoff } } } },
    select: {
      id: true,
      name: true,
      createdAt: true,
      onboardingCompletedAt: true,
      users: { select: { email: true, lastLoginAt: true }, orderBy: { lastLoginAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  // Most recent usage event per dormant company (their "last seen").
  const ids = companies.map((c) => c.id);
  const lastEvents = ids.length
    ? await prismaUnscoped.usageEvent.groupBy({
        by: ["companyId"],
        where: { companyId: { in: ids } },
        _max: { createdAt: true },
      })
    : [];
  const lastMap = Object.fromEntries(lastEvents.map((e) => [e.companyId, e._max.createdAt]));

  return NextResponse.json({
    days,
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      onboarded: !!c.onboardingCompletedAt,
      adminEmail: c.users[0]?.email ?? null,
      lastSeen: lastMap[c.id] ?? c.users[0]?.lastLoginAt ?? null,
    })),
  });
}

// POST: re-engage dormant companies across in-app + email + WhatsApp.
// Body: { days?: number, companyIds?: string[] }. Skips companies that already
// have an active nudge so we don't spam. Shared with the scheduled cron job.
async function POST_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const body = await request.json().catch(() => ({}));
  const result = await nudgeInactive({
    days: Number(body.days) || 30,
    adminId,
    companyIds: Array.isArray(body.companyIds) ? body.companyIds : undefined,
  });
  return NextResponse.json(result);
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const POST = withApi(POST_handler, { allowPlatform: true });
