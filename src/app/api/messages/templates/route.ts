import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { ensureSystemTemplates } from "@/lib/cadence";

// Read-only list of ACTIVE templates for the Send/Share dialog. Lives under
// /api/messages (not /api/settings) so any authenticated user who can send a
// document can pick a template, without needing the "settings" permission that
// gates template management.
async function GET_handler(request: NextRequest) {
  try {
    // Seed the built-in templates on first use so a non-admin sender always has
    // templates to pick (the settings page — admin only — also seeds, but this
    // path may run first). Idempotent.
    await ensureSystemTemplates(requireCompanyId());
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
