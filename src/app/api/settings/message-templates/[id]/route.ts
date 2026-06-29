import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  TEMPLATE_STRING_FIELDS,
  TEMPLATE_BOOL_FIELDS,
} from "@/lib/message-templates";

type Data = Record<string, unknown>;
type Ctx = { params: Promise<{ id: string }> };

function pickTemplateData(body: Data): Data {
  const data: Data = {};
  for (const f of TEMPLATE_STRING_FIELDS) {
    if (typeof body[f] === "string") data[f] = body[f];
  }
  for (const f of TEMPLATE_BOOL_FIELDS) {
    if (typeof body[f] === "boolean") data[f] = body[f];
  }
  return data;
}

async function PUT_handler(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const userId = request.headers.get("x-user-id") || "";
    const body = (await request.json().catch(() => ({}))) as Data;

    // Tenant extension scopes this to the caller's company — a foreign id 404s.
    const existing = await prisma.messageTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const data = pickTemplateData(body);
    // Bump version on every save so the editor can show revision count.
    const template = await prisma.messageTemplate.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });

    logAudit({
      userId,
      entity: "MessageTemplate",
      entityId: id,
      action: "UPDATE",
      after: { name: template.name },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const userId = request.headers.get("x-user-id") || "";

    const existing = await prisma.messageTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // System templates are part of the suite's defaults — they can be deactivated
    // (isActive=false) but not deleted, so cadences/flows can always rely on them.
    if (existing.isSystem) {
      return NextResponse.json(
        { error: "Built-in templates can't be deleted. Switch it off instead." },
        { status: 400 }
      );
    }

    await prisma.messageTemplate.delete({ where: { id } });
    logAudit({
      userId,
      entity: "MessageTemplate",
      entityId: id,
      action: "DELETE",
      before: { name: existing.name },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}

export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
