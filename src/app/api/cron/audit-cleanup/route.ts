import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { cronAuthError } from "@/lib/cron-auth";
import { getAuditRetentionDays, getUsageRetentionDays } from "@/lib/retention";

// Daily storage-retention cleanup. CRON_SECRET-gated (same pattern as
// nudge-inactive). Uses the UNSCOPED client so the configured windows apply to
// EVERY company's data plus platform-level rows — one policy, all tenants.
//
//   GET /api/cron/audit-cleanup
//   Authorization: Bearer <CRON_SECRET>
//
// • AuditLog  — pruned at audit_retention_days (default 15), across all companies.
// • UsageEvent — pruned at usage_retention_days (default 365). A long window so
//   analytics/growth/inactivity reports (all ≤ 90d lookbacks) are never affected.
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function run(request: NextRequest) {
  const authErr = cronAuthError(request);
  if (authErr) return authErr;

  const auditRetentionDays = await getAuditRetentionDays();
  const usageRetentionDays = await getUsageRetentionDays();

  const auditCutoff = daysAgo(auditRetentionDays);
  const usageCutoff = daysAgo(usageRetentionDays);

  const [audit, usage] = await Promise.all([
    prismaUnscoped.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
    prismaUnscoped.usageEvent.deleteMany({ where: { createdAt: { lt: usageCutoff } } }),
  ]);

  console.log(
    `[audit-cleanup] deleted ${audit.count} audit log(s) older than ${auditRetentionDays}d (all companies); ` +
      `${usage.count} usage event(s) older than ${usageRetentionDays}d.`
  );
  return NextResponse.json({
    deleted: audit.count,
    retentionDays: auditRetentionDays,
    usageDeleted: usage.count,
    usageRetentionDays,
  });
}

export const GET = run;
export const POST = run;
