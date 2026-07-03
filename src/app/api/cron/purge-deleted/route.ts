import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { cronAuthError } from "@/lib/cron-auth";
import { RECYCLABLE, RETENTION_DAYS } from "@/lib/recycle-bin";
import { UTApi } from "uploadthing/server";
import { poolToken } from "@/lib/storage";

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

  // Recycle-bin retention: hard-delete tenant rows soft-deleted more than
  // RETENTION_DAYS ago. Runs unscoped (platform cron) but each delegate
  // operates by primary id, so tenant isolation is preserved.
  const rbCutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const rbCounts: Record<string, number> = {};

  // Documents get special handling — drop the UploadThing blob before deleting
  // the row so we don't leak storage. Group by pool so we only construct one
  // UTApi client per pool token.
  try {
    const staleDocs = await prismaUnscoped.document.findMany({
      where: { deletedAt: { lt: rbCutoff } },
      select: { id: true, fileKey: true, storagePool: true },
      take: 500,
    });
    const byPool = new Map<string, string[]>();
    for (const d of staleDocs) {
      if (!d.fileKey) continue;
      const arr = byPool.get(d.storagePool) ?? [];
      arr.push(d.fileKey);
      byPool.set(d.storagePool, arr);
    }
    for (const [pool, keys] of byPool) {
      try {
        const token = await poolToken(pool);
        await new UTApi(token ? { token } : undefined).deleteFiles(keys);
      } catch (err) {
        console.warn(`[purge-deleted] UT delete failed for pool ${pool}:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.warn(`[purge-deleted] document blob pre-purge failed:`, (err as Error).message);
  }

  for (const model of RECYCLABLE) {
    const key = model.charAt(0).toLowerCase() + model.slice(1);
    const delegate = (prismaUnscoped as unknown as Record<string, { deleteMany: (a: unknown) => Promise<{ count: number }> }>)[key];
    try {
      const r = await delegate.deleteMany({ where: { deletedAt: { lt: rbCutoff } } });
      rbCounts[model] = r.count;
    } catch (err) {
      rbCounts[model] = 0;
      console.error(`[purge-deleted] recycle-bin purge failed for ${model}:`, (err as Error).message);
    }
  }
  const rbTotal = Object.values(rbCounts).reduce((s, n) => s + n, 0);

  console.log(`[purge-deleted] hard-deleted ${purged} company(ies) past ${GRACE_DAYS}d grace; ${webhookPurged} webhook event(s) past 90d; ${rbTotal} recycle-bin item(s) past ${RETENTION_DAYS}d`);
  return NextResponse.json({ purged, webhookPurged, recycleBinPurged: rbCounts });
}

export const GET = run;
