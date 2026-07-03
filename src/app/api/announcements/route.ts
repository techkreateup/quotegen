import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// Tenant-facing: active platform announcements targeted at this company
// (audience "ALL" or this company id), within their active window.
async function GET_handler(request: NextRequest) {
  const companyId = request.headers.get("x-company-id");
  if (!companyId) return NextResponse.json({ announcements: [] });

  const now = new Date();
  const announcements = await prismaUnscoped.platformAnnouncement.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        { OR: [{ audience: "ALL" }, { audience: companyId }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, severity: true, createdAt: true },
    take: 20,
  });

  return NextResponse.json({ announcements });
}

export const GET = withApi(GET_handler);
