import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { buildEntityContext } from "@/lib/message-context";
import { renderTemplate, resolveRecipients } from "@/lib/merge";
import { sendMessage } from "@/lib/messaging";

type Data = Record<string, unknown>;

/** Recent sends for an entity → powers the "last sent" indicator. */
async function GET_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || "";
    const entityId = searchParams.get("entityId") || "";
    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
    }
    const logs = await prisma.messageLog.findMany({
      where: { entityType, entityId },
      orderBy: { sentAt: "desc" },
      take: 8,
      select: { id: true, channel: true, toAddr: true, subject: true, status: true, sentAt: true, sentByName: true },
    });
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const userName = request.headers.get("x-user-name") || "";
    const body = (await request.json().catch(() => ({}))) as Data;

    const entityType = String(body.entityType || "");
    const entityId = String(body.entityId || "");
    const channel = body.channel === "WHATSAPP" ? "WHATSAPP" : "EMAIL";
    const preview = body.preview === true;

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
    }

    const ec = await buildEntityContext(entityType, entityId);
    if (!ec) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const ctx = ec.context;

    let tpl: { subject: string; body: string; toExpr: string; ccExpr: string; bccExpr: string } | null = null;
    if (body.templateId) {
      tpl = await prisma.messageTemplate.findUnique({
        where: { id: String(body.templateId) },
        select: { subject: true, body: true, toExpr: true, ccExpr: true, bccExpr: true },
      });
    }

    // Subject/body: explicit override (from the dialog) wins over the template.
    const subject = renderTemplate(String(body.subject ?? tpl?.subject ?? ""), ctx, { escape: false });
    const renderedBody = renderTemplate(String(body.body ?? tpl?.body ?? ""), ctx, { escape: true });

    // Recipients: explicit > template expression > the record's default contact.
    const defaultRecipient = channel === "EMAIL" ? ec.defaultEmail : ec.defaultPhone;
    const toCandidates = body.to != null
      ? resolveRecipients(String(body.to), ctx)
      : tpl?.toExpr ? resolveRecipients(tpl.toExpr, ctx) : [];
    const to = toCandidates[0] || defaultRecipient || "";
    const extraTo = toCandidates.slice(1);
    const cc = [
      ...extraTo,
      ...(body.cc != null ? resolveRecipients(String(body.cc), ctx) : tpl?.ccExpr ? resolveRecipients(tpl.ccExpr, ctx) : []),
    ];
    const bcc = body.bcc != null ? resolveRecipients(String(body.bcc), ctx) : tpl?.bccExpr ? resolveRecipients(tpl.bccExpr, ctx) : [];

    if (preview) {
      return NextResponse.json({ to, cc, bcc, subject, body: renderedBody, channel, label: ec.label });
    }

    const attachment = body.attachment as { filename: string; content: string } | undefined;
    const result = await sendMessage({
      channel,
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject,
      body: renderedBody,
      entityType,
      entityId,
      templateId: body.templateId ? String(body.templateId) : undefined,
      sentById: userId,
      sentByName: userName,
      attachments: attachment?.content ? [attachment] : undefined,
    });

    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
