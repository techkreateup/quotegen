import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaUnscoped } from "@/lib/db";

// Org-wide saved (customized) document templates, with version history.

async function GET_handler() {
  const templates = await prisma.savedTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, baseId: true, version: true, createdByName: true, updatedAt: true },
  });
  return NextResponse.json({ templates });
}

// Create a new saved template, or save a new version of an existing one.
async function POST_handler(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || null;
  const userName = request.headers.get("x-user-name") || "";
  const body = await request.json().catch(() => ({}));
  const baseId = String(body.baseId || "").trim();
  const html = String(body.html || "");
  const name = String(body.name || "").trim().slice(0, 120) || "Untitled template";
  if (!baseId || !html) return NextResponse.json({ error: "baseId and html are required" }, { status: 400 });

  // Update existing (new version) — scoped findFirst ensures it belongs to this company.
  if (body.id) {
    const existing = await prisma.savedTemplate.findFirst({ where: { id: String(body.id) } });
    if (existing) {
      // Snapshot the current content as a version before overwriting.
      await prismaUnscoped.savedTemplateVersion.create({
        data: { savedTemplateId: existing.id, version: existing.version, html: existing.html, createdByName: existing.createdByName },
      });
      const updated = await prisma.savedTemplate.update({
        where: { id: existing.id },
        data: { name, html, version: existing.version + 1 },
        select: { id: true, version: true },
      });
      return NextResponse.json({ savedTemplate: updated, updated: true });
    }
  }

  const created = await prisma.savedTemplate.create({
    // companyId is also enforced by the tenant extension; passed for the types.
    data: { companyId: request.headers.get("x-company-id") || "", name, baseId, html, createdById: userId, createdByName: userName },
    select: { id: true, version: true },
  });
  return NextResponse.json({ savedTemplate: created, updated: false });
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
