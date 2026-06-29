import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { logAudit } from "@/lib/audit";
import {
  SYSTEM_TEMPLATES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CHANNELS,
  TEMPLATE_ATTACH_KINDS,
  TEMPLATE_STRING_FIELDS,
  TEMPLATE_BOOL_FIELDS,
} from "@/lib/message-templates";

type Data = Record<string, unknown>;

/** Whitelist-pick editable columns from a request body (never spread raw — §11.1). */
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

/** Validate the constrained enum-ish fields when present. Returns an error string or null. */
export function validateTemplate(data: Data): string | null {
  if (data.category != null && !TEMPLATE_CATEGORIES.includes(data.category as never))
    return "Invalid category";
  if (data.channel != null && !TEMPLATE_CHANNELS.includes(data.channel as never))
    return "Invalid channel";
  if (data.attachKind != null && !TEMPLATE_ATTACH_KINDS.includes(data.attachKind as never))
    return "Invalid attachment type";
  return null;
}

/** Seed the built-in system templates for this company once (idempotent). */
async function seedIfEmpty(companyId: string) {
  const count = await prisma.messageTemplate.count();
  if (count > 0) return;
  await prisma.messageTemplate.createMany({
    data: SYSTEM_TEMPLATES.map((t) => ({
      companyId,
      name: t.name,
      category: t.category,
      channel: t.channel,
      entityType: t.entityType,
      subject: t.subject,
      body: t.body,
      attachPdf: t.attachPdf,
      attachKind: t.attachKind,
      isSystem: true,
    })),
  });
}

async function GET_handler() {
  try {
    await seedIfEmpty(requireCompanyId());
    const templates = await prisma.messageTemplate.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const userName = request.headers.get("x-user-name") || "";
    const body = (await request.json().catch(() => ({}))) as Data;

    const data = pickTemplateData(body);
    if (!data.name || typeof data.name !== "string" || !(data.name as string).trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }
    const err = validateTemplate(data);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const template = await prisma.messageTemplate.create({
      data: {
        companyId: requireCompanyId(),
        name: data.name as string,
        category: (data.category as string) ?? "General",
        channel: (data.channel as string) ?? "EMAIL",
        entityType: (data.entityType as string) ?? "",
        toExpr: (data.toExpr as string) ?? "",
        ccExpr: (data.ccExpr as string) ?? "",
        bccExpr: (data.bccExpr as string) ?? "",
        subject: (data.subject as string) ?? "",
        body: (data.body as string) ?? "",
        attachPdf: (data.attachPdf as boolean) ?? false,
        attachKind: (data.attachKind as string) ?? "none",
        isActive: (data.isActive as boolean) ?? true,
        isSystem: false,
        createdById: userId || null,
        createdByName: userName,
      },
    });

    logAudit({
      userId,
      entity: "MessageTemplate",
      entityId: template.id,
      action: "CREATE",
      after: { name: template.name, channel: template.channel },
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
