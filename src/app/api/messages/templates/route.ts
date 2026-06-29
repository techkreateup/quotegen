import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Read-only list of ACTIVE templates for the Send/Share dialog. Lives under
// /api/messages (not /api/settings) so any authenticated user who can send a
// document can pick a template, without needing the "settings" permission that
// gates template management.
async function GET_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const templates = await prisma.messageTemplate.findMany({
      where: {
        isActive: true,
        ...(entityType ? { OR: [{ entityType }, { entityType: "" }] } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, channel: true, attachKind: true, attachPdf: true, entityType: true },
    });
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
