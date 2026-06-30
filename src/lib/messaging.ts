// ─── Messaging engine (Track B / Sprint B1) ──────────────────────────────────
// Renders {{merge}} templates, resolves recipients, and dispatches email/WhatsApp
// through the existing senders — writing every attempt to MessageLog. This is the
// single backbone behind document "Send/Share", dunning cadences, and follow-up
// nudges. It is **fail-open** (an infra failure logs a failed row and returns,
// never throwing into the request/cron path; LEARNING §2.3).

import prisma from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getTenantContext } from "@/lib/tenant-context";
import { htmlToText, type Channel } from "@/lib/merge";
import { wrapBrandedEmail, resolveEmailLogo, type EmailBrand } from "@/lib/email-template";

// Re-export the client-safe merge helpers so existing importers (and tests) keep
// working through messaging.ts. The implementations live in merge.ts (no server
// deps) so client components can import them directly.
export {
  renderTemplate,
  resolveRecipients,
  extractMergeKeys,
  htmlToText,
  escapeHtml,
} from "@/lib/merge";
export type { Channel, MergeContext } from "@/lib/merge";

// ── Dispatch ──────────────────────────────────────────────────────────────────

export interface SendMessageInput {
  channel: Channel;
  to: string;                 // single recipient (caller fans out if needed)
  cc?: string[];
  bcc?: string[];
  subject?: string;           // email only; already rendered
  body: string;               // already rendered (HTML for email, text/HTML for WA)
  // Linkage + audit
  entityType?: string;
  entityId?: string;
  templateId?: string;
  sentById?: string;
  sentByName?: string;
  // Idempotency for automated (cadence) sends; omit for manual sends.
  dedupeKey?: string;
  // PDF/file attachments (email only). `content` is base64.
  attachments?: { filename: string; content: string }[];
  // Sender display name (company name) + Reply-To. The actual From address stays
  // our verified domain — only the friendly name changes (deliverability-safe).
  fromName?: string;
  replyTo?: string;
  // When provided (email), the body is wrapped in the branded HTML shell.
  brand?: EmailBrand;
}

export interface SendResult {
  ok: boolean;
  status: "sent" | "failed" | "skipped";
  logId?: string;
  reason?: string;
}

/**
 * Dispatch one message and record it in MessageLog. Fail-open: provider errors
 * are caught and logged as a `failed` row; the function never throws. When a
 * `dedupeKey` is supplied and a row already exists for it, the send is skipped
 * (so a cron retry can't double-send). Requires tenant context (scoped prisma).
 */
export async function sendMessage(input: SendMessageInput): Promise<SendResult> {
  const {
    channel, to, cc, bcc, subject, body,
    entityType = "", entityId = "", templateId,
    sentById, sentByName = "", dedupeKey, attachments,
    fromName, replyTo, brand,
  } = input;

  // No recipient → record a skipped row so the UI can show "no contact".
  if (!to || !to.trim()) {
    await writeLog({ channel, to: "", cc, bcc, subject, body, entityType, entityId, templateId, sentById, sentByName, dedupeKey, status: "skipped", provider: "", error: "no recipient" });
    return { ok: false, status: "skipped", reason: "no recipient" };
  }

  // Idempotency: if this dedupeKey was already used, skip silently.
  if (dedupeKey) {
    try {
      const existing = await prisma.messageLog.findFirst({ where: { dedupeKey }, select: { id: true } });
      if (existing) return { ok: true, status: "skipped", logId: existing.id, reason: "duplicate" };
    } catch {
      // If the dedupe check itself fails, fall through and attempt the send.
    }
  }

  let delivered = false;
  let provider = "";
  let error = "";

  try {
    if (channel === "EMAIL") {
      provider = process.env.RESEND_API_KEY ? "resend" : "dev";
      // Logo is a hosted URL (data: URIs are rewritten upstream) → render inline.
      const html = brand ? wrapBrandedEmail(body, brand, resolveEmailLogo(brand.logoUrl)) : body;
      delivered = await sendEmail({
        to,
        subject: subject || "",
        html,
        cc,
        bcc,
        replyTo,
        fromName,
        attachments,
      });
    } else {
      provider = process.env.WHATSAPP_TOKEN ? "whatsapp-cloud" : "dev";
      delivered = await sendWhatsApp({ to, text: htmlToText(body) });
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "send error";
  }

  // In dev (no provider key) the senders return false but didn't truly fail —
  // record as `sent` so local flows are testable, distinct from a real failure.
  const status: "sent" | "failed" = delivered || provider === "dev" ? "sent" : "failed";

  const logId = await writeLog({
    channel, to, cc, bcc, subject, body, entityType, entityId, templateId,
    sentById, sentByName, dedupeKey, status, provider, error,
  });

  return { ok: status === "sent", status, logId, reason: error || undefined };
}

interface LogInput {
  channel: Channel; to: string; cc?: string[]; bcc?: string[];
  subject?: string; body: string; entityType: string; entityId: string;
  templateId?: string; sentById?: string; sentByName: string;
  dedupeKey?: string; status: string; provider: string; error: string;
}

/** Persist a MessageLog row. Fail-open: a logging failure is swallowed (we never
 *  want auditing to break the actual send/cron). Returns the id when written. */
async function writeLog(l: LogInput): Promise<string | undefined> {
  // companyId is also stamped by the tenant Prisma extension at runtime; we set
  // it explicitly so the static create type is satisfied (same pattern as
  // src/lib/activity.ts). No tenant context → nothing to log against.
  const companyId = getTenantContext()?.companyId;
  if (!companyId) return undefined;
  try {
    const row = await prisma.messageLog.create({
      data: {
        companyId,
        channel: l.channel,
        templateId: l.templateId ?? null,
        entityType: l.entityType,
        entityId: l.entityId,
        toAddr: l.to,
        ccAddr: (l.cc ?? []).join(", "),
        bccAddr: (l.bcc ?? []).join(", "),
        subject: l.subject ?? "",
        body: l.body,
        status: l.status,
        provider: l.provider,
        error: l.error,
        dedupeKey: l.dedupeKey ?? null,
        sentById: l.sentById ?? null,
        sentByName: l.sentByName,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    // Unique-violation on (companyId, dedupeKey) = concurrent duplicate; benign.
    console.error("[messaging] MessageLog write failed:", err);
    return undefined;
  }
}
