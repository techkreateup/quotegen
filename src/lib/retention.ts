import { prismaUnscoped } from "@/lib/db";

// Audit-log retention. The window is stored in PlatformSetting
// (key "audit_retention_days") and edited by super admins. Applies to EVERY
// company's audit logs as well as platform-level logs — the cleanup cron uses
// the unscoped client so a single window governs all tenants.
export const AUDIT_RETENTION_KEY = "audit_retention_days";
export const DEFAULT_AUDIT_RETENTION_DAYS = 15;
// Guard rails for the editable value (prevents an accidental near-total wipe).
export const MIN_AUDIT_RETENTION_DAYS = 7;
export const MAX_AUDIT_RETENTION_DAYS = 365;

// UsageEvent (analytics telemetry) is the other unbounded table. It is pruned
// only at a long window, safely beyond every analytics lookback in the app
// (growth ≤ 60d, inactivity nudges ≤ 90d), so pruning never corrupts reports.
export const USAGE_RETENTION_KEY = "usage_retention_days";
export const DEFAULT_USAGE_RETENTION_DAYS = 365;
export const MIN_USAGE_RETENTION_DAYS = 90;

/** Parse/clamp a retention value; falls back to the default when invalid. */
export function normalizeRetentionDays(
  raw: unknown,
  def: number,
  min: number,
  max = MAX_AUDIT_RETENTION_DAYS
): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/** Current audit retention window (days), from PlatformSetting or the default. */
export async function getAuditRetentionDays(): Promise<number> {
  try {
    const row = await prismaUnscoped.platformSetting.findUnique({ where: { key: AUDIT_RETENTION_KEY } });
    const n = Number(row?.value);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_AUDIT_RETENTION_DAYS;
  } catch {
    return DEFAULT_AUDIT_RETENTION_DAYS;
  }
}

/** Current usage-event retention window (days), from PlatformSetting or the default. */
export async function getUsageRetentionDays(): Promise<number> {
  try {
    const row = await prismaUnscoped.platformSetting.findUnique({ where: { key: USAGE_RETENTION_KEY } });
    const n = Number(row?.value);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_USAGE_RETENTION_DAYS;
  } catch {
    return DEFAULT_USAGE_RETENTION_DAYS;
  }
}
