import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const SEVERITIES = ["INFO", "WARNING", "CRITICAL"];

async function GET_handler() {
  const announcements = await prismaUnscoped.platformAnnouncement.findMany({
    orderBy: { createdAt: "desc" },
  });
  // Attach company names for single-company notices.
  const companyIds = announcements.filter((a) => a.audience !== "ALL").map((a) => a.audience);
  const companies = companyIds.length
    ? await prismaUnscoped.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } })
    : [];
  const nameMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  return NextResponse.json({
    announcements: announcements.map((a) => ({
      ...a,
      audienceName: a.audience === "ALL" ? "All companies" : nameMap[a.audience] ?? a.audience,
    })),
  });
}

async function POST_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const severity = SEVERITIES.includes(body.severity) ? body.severity : "INFO";

  const a = await prismaUnscoped.platformAnnouncement.create({
    data: {
      title,
      body: String(body.body ?? ""),
      severity,
      audience: body.audience ? String(body.audience) : "ALL",
      isActive: body.isActive !== false,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      createdById: adminId,
    },
  });
  logAudit({ userId: adminId, entity: "PlatformAnnouncement", entityId: a.id, action: "CREATE", after: { title, severity } });
  return NextResponse.json({ announcement: a }, { status: 201 });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const POST = withApi(POST_handler, { allowPlatform: true });
