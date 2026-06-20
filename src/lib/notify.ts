import { prismaUnscoped } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp";

export interface NotifyResult {
  inApp: number; // per-user bell notifications created
  email: boolean; // whether an email was actually dispatched
  whatsapp: boolean; // whether a WhatsApp message was actually dispatched
  emailTo: string | null;
  whatsappTo: string | null;
}

interface NotifyOpts {
  title: string;
  body: string;
  link?: string;
  /** Which channels to attempt. In-app always recommended; email/whatsapp only if contact exists. */
  channels?: { inApp?: boolean; email?: boolean; whatsapp?: boolean };
}

function htmlWrap(title: string, body: string, link?: string): string {
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
    <h2 style="color:#4F46E5">${title}</h2>
    <p style="color:#334155;line-height:1.6">${body}</p>
    ${link ? `<p><a href="${link}" style="display:inline-block;background:#6366F1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Open QuoteGen</a></p>` : ""}
  </div>`;
}

/**
 * Deliver a message to a company across the requested channels. Falls back
 * gracefully: email/WhatsApp only fire if the company has that contact detail,
 * and the underlying senders log-instead-of-send when unconfigured (dev).
 * In-app is always available (per-user Notification rows → the bell).
 */
export async function notifyCompany(companyId: string, opts: NotifyOpts): Promise<NotifyResult> {
  const ch = { inApp: true, email: true, whatsapp: true, ...(opts.channels ?? {}) };
  const result: NotifyResult = { inApp: 0, email: false, whatsapp: false, emailTo: null, whatsappTo: null };

  const company = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: {
      settings: { select: { email: true, phones: true } },
      users: { where: { isActive: true, companyId: { not: null } }, select: { id: true, email: true, platformRole: true } },
    },
  });
  if (!company) return result;

  // In-app: a bell notification for every active user in the company.
  if (ch.inApp && company.users.length) {
    await prismaUnscoped.notification.createMany({
      data: company.users.map((u) => ({
        userId: u.id,
        type: "General" as const,
        title: opts.title,
        body: opts.body,
        link: opts.link ?? null,
        isRead: false,
      })),
    });
    result.inApp = company.users.length;
  }

  // Email: settings email, else the first company admin's email.
  const adminEmail =
    company.settings?.email?.trim() ||
    company.users.find((u) => u.platformRole === "COMPANY_ADMIN")?.email ||
    company.users[0]?.email ||
    null;
  if (ch.email && adminEmail) {
    result.emailTo = adminEmail;
    result.email = await sendEmail({ to: adminEmail, subject: opts.title, html: htmlWrap(opts.title, opts.body, opts.link) });
  }

  // WhatsApp: first phone on the company settings.
  const phone = company.settings?.phones?.find((p) => p && p.trim());
  if (ch.whatsapp && phone) {
    result.whatsappTo = phone;
    result.whatsapp = await sendWhatsApp({ to: phone, text: `${opts.title}\n\n${opts.body}` });
  }

  return result;
}
