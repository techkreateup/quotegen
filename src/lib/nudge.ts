import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { LAUNCH } from "@/lib/features";
import { notifyCompany } from "@/lib/notify";

const DAY = 24 * 60 * 60 * 1000;

export interface NudgeResult {
  nudged: number;
  skipped: number;
  total: number;
  emailed: number;
  whatsapped: number;
}

/**
 * Re-engage inactive companies across all channels: in-app banner (always),
 * email + WhatsApp where contact details exist. Skips companies that already
 * have an active "We miss you" nudge so we never spam. Used by both the manual
 * Super Admin action and the scheduled cron job.
 */
export async function nudgeInactive(opts: { days?: number; adminId?: string; companyIds?: string[] }): Promise<NudgeResult> {
  const days = Math.max(1, opts.days || 30);
  const adminId = opts.adminId || "system";
  const cutoff = new Date(Date.now() - days * DAY);

  let targetIds = opts.companyIds ?? [];
  if (targetIds.length === 0) {
    const dormant = await prismaUnscoped.company.findMany({
      where: { isActive: true, usageEvents: { none: { createdAt: { gte: cutoff } } } },
      select: { id: true },
    });
    targetIds = dormant.map((c) => c.id);
  }

  const existing = await prismaUnscoped.platformAnnouncement.findMany({
    where: { isActive: true, audience: { in: targetIds }, title: { startsWith: "We miss you" } },
    select: { audience: true },
  });
  const already = new Set(existing.map((e) => e.audience));
  const toNudge = targetIds.filter((id) => !already.has(id));

  const title = "We miss you 👋";
  const body = `Your workspace is waiting — every feature is free for ${LAUNCH.freeMonths} months. Send an invoice, track payments, or run payroll in minutes.`;
  const expires = new Date(Date.now() + 14 * DAY);

  let emailed = 0;
  let whatsapped = 0;

  if (toNudge.length > 0) {
    await prismaUnscoped.platformAnnouncement.createMany({
      data: toNudge.map((id) => ({ title, body, severity: "INFO", audience: id, isActive: true, endsAt: expires, createdById: adminId })),
    });
    const results = await Promise.all(
      toNudge.map((id) => notifyCompany(id, { title, body, link: process.env.APP_URL, channels: { inApp: false, email: true, whatsapp: true } }))
    );
    emailed = results.filter((r) => r.email).length;
    whatsapped = results.filter((r) => r.whatsapp).length;
  }

  logAudit({ userId: adminId, entity: "PlatformAnnouncement", entityId: "bulk", action: "NUDGE_INACTIVE", after: { nudged: toNudge.length, skipped: already.size, emailed, whatsapped, days } });

  return { nudged: toNudge.length, skipped: already.size, total: targetIds.length, emailed, whatsapped };
}
