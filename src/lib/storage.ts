import { prismaUnscoped } from "@/lib/db";

// ── Storage model ────────────────────────────────────────────────────────────
// The platform has ONE shared pool of storage (one UploadThing account = 2GB on
// the free plan). That total is shared across ALL tenants, so we enforce TWO
// ceilings on every upload:
//   1. a per-company quota (default 200MB) so no single tenant drains the pool,
//   2. the platform total safety ceiling.
// Both the total and the per-company default are super-admin-editable via
// PlatformSetting, so when capacity grows (UploadThing upgrade or a new pool)
// the limits can be raised without a deploy. See /admin/storage.

export const DEFAULT_TOTAL_BYTES = 2 * 1024 ** 3; // 2 GB (UploadThing free)
export const DEFAULT_COMPANY_BYTES = 200 * 1024 ** 2; // 200 MB per company

export const STORAGE_TOTAL_KEY = "storage_total_bytes";
export const STORAGE_COMPANY_KEY = "storage_company_bytes";
export const ACTIVE_POOL_KEY = "storage_active_pool";
export const PRIMARY_POOL = "primary";

async function settingNumber(key: string, def: number): Promise<number> {
  try {
    const row = await prismaUnscoped.platformSetting.findUnique({ where: { key } });
    const n = Number(row?.value);
    return Number.isFinite(n) && n > 0 ? n : def;
  } catch {
    return def;
  }
}

export async function getStorageConfig() {
  const [totalBytes, perCompanyBytes] = await Promise.all([
    settingNumber(STORAGE_TOTAL_KEY, DEFAULT_TOTAL_BYTES),
    settingNumber(STORAGE_COMPANY_KEY, DEFAULT_COMPANY_BYTES),
  ]);
  return { totalBytes, perCompanyBytes, safetyBytes: Math.floor(totalBytes * 0.95) };
}

export async function globalStorageBytes(): Promise<number> {
  const agg = await prismaUnscoped.document.aggregate({ _sum: { sizeBytes: true } });
  return agg._sum.sizeBytes ?? 0;
}

export async function companyStorageBytes(companyId: string): Promise<number> {
  const agg = await prismaUnscoped.document.aggregate({
    where: { companyId },
    _sum: { sizeBytes: true },
  });
  return agg._sum.sizeBytes ?? 0;
}

export async function companyQuotaBytes(companyId: string): Promise<number> {
  const c = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: { storageQuotaBytes: true },
  });
  if (c?.storageQuotaBytes != null) return c.storageQuotaBytes;
  const { perCompanyBytes } = await getStorageConfig();
  return perCompanyBytes;
}

/**
 * Reject (throw) if accepting `incomingBytes` more for this company would breach
 * either its own quota or the platform total. Called in the upload middleware.
 */
export async function assertStorageAvailable(companyId: string, incomingBytes: number): Promise<void> {
  const cfg = await getStorageConfig();
  const [globalUsed, companyUsed, quota] = await Promise.all([
    globalStorageBytes(),
    companyStorageBytes(companyId),
    companyQuotaBytes(companyId),
  ]);
  if (companyUsed + incomingBytes > quota) {
    throw new Error(
      `Your storage limit (${formatBytes(quota)}) is reached. Delete some documents or ask your admin to raise the limit.`
    );
  }
  if (globalUsed + incomingBytes > cfg.safetyBytes) {
    throw new Error("Platform storage is full. Please contact support.");
  }
}

// ── Storage pools (multi-account scaling) ────────────────────────────────────
// Each pool is one UploadThing account. The primary uses UPLOADTHING_TOKEN; add
// more by setting UPLOADTHING_TOKEN_<NAME> (e.g. UPLOADTHING_TOKEN_POOL2). The
// super admin can switch which pool new uploads target once a pool is live.

export async function activePool(): Promise<string> {
  try {
    const row = await prismaUnscoped.platformSetting.findUnique({ where: { key: ACTIVE_POOL_KEY } });
    return row?.value || PRIMARY_POOL;
  } catch {
    return PRIMARY_POOL;
  }
}

/** Resolve the UploadThing token for a given pool, or undefined if not configured. */
export function poolToken(pool: string): string | undefined {
  if (pool === PRIMARY_POOL) return process.env.UPLOADTHING_TOKEN;
  return process.env[`UPLOADTHING_TOKEN_${pool.toUpperCase()}`];
}

/** All pools that have a token configured in the environment. */
export function configuredPools(): string[] {
  const pools = new Set<string>();
  if (process.env.UPLOADTHING_TOKEN) pools.add(PRIMARY_POOL);
  for (const k of Object.keys(process.env)) {
    const m = k.match(/^UPLOADTHING_TOKEN_(.+)$/);
    if (m) pools.add(m[1].toLowerCase());
  }
  return [...pools];
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
