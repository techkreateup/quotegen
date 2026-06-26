import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { cronAuthError } from "@/lib/cron-auth";

const GRACE_DAYS = 30;

// Daily hard-delete of companies past their deletion grace period (DPDP 2.3).
// CRON_SECRET-gated. Company relations cascade, so deleting the company row
// removes all tenant data.
//
//   GET /api/cron/purge-deleted
//   Authorization: Bearer <CRON_SECRET>
async function run(request: NextRequest) {
  const authErr = cronAuthError(request);
  if (authErr) return authErr;

  const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000);
  const due = await prismaUnscoped.company.findMany({
    where: { deletionRequestedAt: { lt: cutoff }, isActive: false },
    select: { id: true, name: true },
  });

  let purged = 0;
  for (const c of due) {
    try {
      await prismaUnscoped.company.delete({ where: { id: c.id } });
      purged++;
    } catch (err) {
      console.error(`[purge-deleted] failed for ${c.id}:`, (err as Error).message);
    }
  }

  // Webhook event log retention — keep 90 days of inbound provider events for
  // debugging, then drop. Payload contains customer email/phone, so keeping
  // forever is a needless PII surface and unbounded table growth.
  const webhookCutoff = new Date(Date.now() - 90 * 86_400_000);
  let webhookPurged = 0;
  try {
    const result = await prismaUnscoped.webhookEvent.deleteMany({
      where: { createdAt: { lt: webhookCutoff } },
    });
    webhookPurged = result.count;
  } catch (err) {
    console.error(`[purge-deleted] webhook event purge failed:`, (err as Error).message);
  }

  console.log(`[purge-deleted] hard-deleted ${purged} company(ies) past ${GRACE_DAYS}d grace; ${webhookPurged} webhook event(s) past 90d`);
  return NextResponse.json({ purged, webhookPurged });
}

export const GET = run;
