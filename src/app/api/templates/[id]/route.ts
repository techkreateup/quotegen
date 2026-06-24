import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// Fetch one saved template + its version history (latest first). ?v=N returns
// that specific version's html as `selectedHtml`.
async function GET_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await prisma.savedTemplate.findFirst({ where: { id } }); // scoped
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await prismaUnscoped.savedTemplateVersion.findMany({
    where: { savedTemplateId: id },
    orderBy: { version: "desc" },
    select: { version: true, createdByName: true, createdAt: true, html: true },
  });

  const vParam = request.nextUrl.searchParams.get("v");
  let selectedHtml = template.html;
  if (vParam) {
    const v = versions.find((x) => x.version === Number(vParam));
    if (v) selectedHtml = v.html;
  }

  return NextResponse.json({
    template: { id: template.id, name: template.name, baseId: template.baseId, version: template.version, html: template.html, category: template.category, createdByName: template.createdByName, createdByRole: template.createdByRole, signatories: template.signatories },
    selectedHtml,
    versions: versions.map((v) => ({ version: v.version, createdByName: v.createdByName, createdAt: v.createdAt })),
  });
}

async function DELETE_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.savedTemplate.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.savedTemplate.delete({ where: { id } });
  logAudit({ userId: request.headers.get("x-user-id") || "system", entity: "SavedTemplate", entityId: id, action: "DELETE", before: { name: existing.name } });
  return NextResponse.json({ ok: true });
}

export const GET = withApi(GET_handler);
export const DELETE = withApi(DELETE_handler);
