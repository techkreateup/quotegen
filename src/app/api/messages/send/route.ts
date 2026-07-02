import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { buildEntityContext } from "@/lib/message-context";
import { renderTemplate, resolveRecipients } from "@/lib/merge";
import { sendMessage } from "@/lib/messaging";
import { enrollEntity } from "@/lib/cadence";
import type { EmailBrand } from "@/lib/email-template";

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
    const userEmail = request.headers.get("x-user-email") || "";
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

    // Do-not-contact hard block for client-facing sends (compliance / unsubscribe).
    // Preview stays available so the user can see WHY the send is blocked.
    if (!preview) {
      const clientCtx = (ctx as { client?: { doNotContact?: boolean } }).client;
      if (clientCtx?.doNotContact) {
        return NextResponse.json({ error: "Client is marked do-not-contact. Sending is blocked." }, { status: 403 });
      }
    }

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
    // Company brand block (name/logo/address…) drives the From display name and
    // the branded email shell. Manual sends appear from the company, with the
    // sending user as Reply-To and auto-CC'd so replies + copies reach them.
    const company = ctx.company as { name?: string } | undefined;
    const fromName = company?.name || undefined;
    const autoCc = channel === "EMAIL" && userEmail ? [userEmail] : [];

    const cc = Array.from(new Set([
      ...extraTo,
      ...(body.cc != null
        ? resolveRecipients(String(body.cc), ctx)
        : ec.defaultCc ? resolveRecipients(ec.defaultCc, ctx)
        : tpl?.ccExpr ? resolveRecipients(tpl.ccExpr, ctx) : []),
      ...autoCc,
    ].filter((a) => a && a !== to)));
    const bcc = body.bcc != null
      ? resolveRecipients(String(body.bcc), ctx)
      : ec.defaultBcc ? resolveRecipients(ec.defaultBcc, ctx)
      : tpl?.bccExpr ? resolveRecipients(tpl.bccExpr, ctx) : [];

    if (preview) {
      const previewBody = channel === "EMAIL" && ec.unsubscribeUrl
        ? `${renderedBody}<p style="margin-top:32px;padding-top:12px;border-top:1px solid #E5E7EB;font-size:11px;color:#94A3B8;text-align:center">Don't want automated reminders? <a href="${ec.unsubscribeUrl}" style="color:#6366F1">Unsubscribe</a></p>`
        : renderedBody;
      return NextResponse.json({ to, cc, bcc, subject, body: previewBody, channel, label: ec.label, fromName, unsubscribeUrl: ec.unsubscribeUrl });
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
      fromName,
      replyTo: channel === "EMAIL" ? (userEmail || undefined) : undefined,
      brand: channel === "EMAIL" ? (ctx.company as EmailBrand) : undefined,
      unsubscribeUrl: channel === "EMAIL" ? ec.unsubscribeUrl : undefined,
    });

    // Auto-enrol into the matching reminder cadence on first successful send, so
    // dunning / quote follow-ups start automatically. Best-effort: never fail the
    // send because enrolment hiccuped.
    if (result.status === "sent") {
      const trigger = entityType === "invoice" ? "ar_dunning" : entityType === "quotation" ? "quote_followup" : null;
      if (trigger) {
        try { await enrollEntity(trigger, entityType, entityId); } catch { /* best-effort */ }
      }
    }

    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
