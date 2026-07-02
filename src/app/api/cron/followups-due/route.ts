import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { cronAuthError } from "@/lib/cron-auth";
import { notifyCompany } from "@/lib/notify";

// Daily follow-up-due sweep (Track B polish). Aggregates every open FollowUp
// whose dueAt is on/before today, groups by company, and fires a single
// in-app + email notification per company with the count + a link to the
// /follow-ups board. In-app only if email isn't configured — the goal is that
// tasks never rot silently. CRON_SECRET-gated.
//
//   GET /api/cron/followups-due
//   Authorization: Bearer <CRON_SECRET>

async function run(request: NextRequest) {
  const authErr = cronAuthError(request);
  if (authErr) return authErr;

  const now = new Date();
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

  const rows = await prismaUnscoped.followUp.findMany({
    where: { status: "open", dueAt: { not: null, lte: endOfToday } },
    select: { companyId: true, title: true, entityType: true, dueAt: true },
    orderBy: { dueAt: "asc" },
    take: 5000,
  });

  const byCompany = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byCompany.get(r.companyId) ?? [];
    arr.push(r);
    byCompany.set(r.companyId, arr);
  }

  let notified = 0;
  for (const [companyId, list] of byCompany) {
    const overdue = list.filter(r => r.dueAt && r.dueAt < now).length;
    const today = list.length - overdue;
    const preview = list
      .slice(0, 8)
      .map(r => {
        const days = Math.ceil((now.getTime() - new Date(r.dueAt!).getTime()) / 86_400_000);
        const tag = days > 0 ? `${days}d overdue` : days === 0 ? "due today" : "due soon";
        return `• ${r.title || `${r.entityType} follow-up`} — ${tag}`;
      })
      .join("<br>");
    const more = list.length > 8 ? `<br>…and ${list.length - 8} more.` : "";
    await notifyCompany(companyId, {
      title: `${list.length} follow-up${list.length === 1 ? "" : "s"} need action`,
      body: `${overdue} overdue · ${today} due today.<br><br>${preview}${more}`,
      link: "/follow-ups",
      channels: { inApp: true, email: overdue > 0, whatsapp: false },
    });
    notified++;
  }

  return NextResponse.json({ ok: true, companiesNotified: notified, followUps: rows.length });
}

export const GET = run;
export const POST = run;
