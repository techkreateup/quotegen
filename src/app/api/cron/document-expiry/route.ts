import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { cronAuthError } from "@/lib/cron-auth";
import { notifyCompany } from "@/lib/notify";

// Weekly document-expiry sweep. Notifies each company (in-app + email) about
// documents that have expired or expire within the horizon, so licenses / GST
// certs / IDs / contracts never lapse silently. CRON_SECRET-gated.
//
//   GET /api/cron/document-expiry
//   Authorization: Bearer <CRON_SECRET>
const HORIZON_DAYS = 30;

async function run(request: NextRequest) {
  const authErr = cronAuthError(request);
  if (authErr) return authErr;

  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);

  const docs = await prismaUnscoped.document.findMany({
    where: { expiresAt: { not: null, lte: horizon } },
    select: { companyId: true, name: true, expiresAt: true },
    orderBy: { expiresAt: "asc" },
  });

  const byCompany = new Map<string, { name: string; expiresAt: Date | null }[]>();
  for (const d of docs) {
    const list = byCompany.get(d.companyId) ?? [];
    list.push({ name: d.name, expiresAt: d.expiresAt });
    byCompany.set(d.companyId, list);
  }

  let notified = 0;
  for (const [companyId, list] of byCompany) {
    const lines = list
      .slice(0, 10)
      .map((d) => {
        const days = Math.ceil((new Date(d.expiresAt!).getTime() - now.getTime()) / 86_400_000);
        return `• ${d.name} — ${days < 0 ? "EXPIRED" : `${days} day(s) left`}`;
      })
      .join("<br>");
    const more = list.length > 10 ? `<br>…and ${list.length - 10} more.` : "";
    await notifyCompany(companyId, {
      title: `${list.length} document(s) need attention`,
      body: `The following documents have expired or expire soon:<br><br>${lines}${more}`,
      link: "/documents",
      channels: { inApp: true, email: true, whatsapp: false },
    });
    notified++;
  }

  return NextResponse.json({ ok: true, companiesNotified: notified, documents: docs.length });
}

export const GET = run;
export const POST = run;
