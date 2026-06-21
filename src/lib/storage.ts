import { prismaUnscoped } from "@/lib/db";

// ── Storage model (multi-pool) ───────────────────────────────────────────────
// Storage is a set of POOLS. Each pool is one UploadThing account (primary uses
// UPLOADTHING_TOKEN; add more with UPLOADTHING_TOKEN_<NAME>). Total platform
// capacity = sum of every configured pool's capacity, so adding an account
// instantly grows capacity with no code change.
//
// There is NO fixed per-company limit. Companies draw from the shared pool;
// the super admin can optionally set a per-company override (dynamic, in /admin/
// storage) but by default a company is only bounded by the platform total.
//
// Each Document records the pool it lives in (Document.storagePool), so a single
// company's files can span pools and deletion always uses the right account.

export const DEFAULT_POOL_CAPACITY = 2 * 1024 ** 3; // 2 GB (UploadThing free)
export const POOL_CAPACITY_KEY = "storage_pool_capacity_bytes";
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

/** Per-pool capacity (same for every pool; super-admin editable). */
export async function poolCapacityBytes(): Promise<number> {
  return settingNumber(POOL_CAPACITY_KEY, DEFAULT_POOL_CAPACITY);
}

/** All pools that have a token configured in the environment. */
export function configuredPools(): string[] {
  const pools = new Set<string>();
  if (process.env.UPLOADTHING_TOKEN) pools.add(PRIMARY_POOL);
  for (const k of Object.keys(process.env)) {
    const m = k.match(/^UPLOADTHING_TOKEN_(.+)$/);
    if (m) pools.add(m[1].toLowerCase());
  }
  if (pools.size === 0) pools.add(PRIMARY_POOL);
  return [...pools];
}

/** Resolve the UploadThing token for a pool, or undefined if not configured. */
export function poolToken(pool: string): string | undefined {
  if (pool === PRIMARY_POOL) return process.env.UPLOADTHING_TOKEN;
  return process.env[`UPLOADTHING_TOKEN_${pool.toUpperCase()}`];
}

/** Bytes used per pool, from Document.storagePool sums. */
export async function poolUsage(): Promise<Record<string, number>> {
  const grouped = await prismaUnscoped.document.groupBy({
    by: ["storagePool"],
    _sum: { sizeBytes: true },
  });
  const usage: Record<string, number> = {};
  for (const p of configuredPools()) usage[p] = 0;
  for (const g of grouped) usage[g.storagePool] = g._sum.sizeBytes ?? 0;
  return usage;
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

/** Platform-wide capacity = pools × per-pool capacity. */
export async function storageOverview() {
  const [cap, usage] = await Promise.all([poolCapacityBytes(), poolUsage()]);
  const pools = configuredPools().map((name) => ({
    name,
    usedBytes: usage[name] ?? 0,
    capacityBytes: cap,
    hasToken: !!poolToken(name),
  }));
  const totalCapacity = pools.length * cap;
  const totalUsed = Object.values(usage).reduce((a, b) => a + b, 0);
  return { pools, totalCapacity, totalUsed, safetyBytes: Math.floor(totalCapacity * 0.95) };
}

export async function activePool(): Promise<string> {
  try {
    const row = await prismaUnscoped.platformSetting.findUnique({ where: { key: ACTIVE_POOL_KEY } });
    if (row?.value && configuredPools().includes(row.value)) return row.value;
  } catch {
    /* fall through */
  }
  return configuredPools()[0] ?? PRIMARY_POOL;
}

/**
 * The pool new uploads should target: the admin-selected active pool if it still
 * has space, otherwise the first configured pool with room. Read consistently
 * from stored state so the upload and its callback agree on the same pool.
 */
export async function resolveUploadPool(): Promise<string> {
  const [active, cap, usage] = await Promise.all([activePool(), poolCapacityBytes(), poolUsage()]);
  const free = (p: string) => cap - (usage[p] ?? 0);
  const minFree = cap * 0.02; // keep ~2% headroom
  if (poolToken(active) && free(active) > minFree) return active;
  const fallback = configuredPools().find((p) => poolToken(p) && free(p) > minFree);
  return fallback ?? active;
}

/** Per-company override quota (bytes) or null (no per-company cap → platform total only). */
export async function companyQuotaBytes(companyId: string): Promise<number | null> {
  const c = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: { storageQuotaBytes: true },
  });
  return c?.storageQuotaBytes ?? null;
}

/**
 * Reject (throw) if accepting `incomingBytes` would exceed the platform total or
 * (only when set) the company's explicit override. No implicit per-company cap.
 */
export async function assertStorageAvailable(companyId: string, incomingBytes: number): Promise<void> {
  const ov = await storageOverview();
  if (ov.totalUsed + incomingBytes > ov.safetyBytes) {
    throw new Error("Platform storage is full. Please contact support to add capacity.");
  }
  const override = await companyQuotaBytes(companyId);
  if (override != null) {
    const used = await companyStorageBytes(companyId);
    if (used + incomingBytes > override) {
      throw new Error(
        `Your storage limit (${formatBytes(override)}) is reached. Delete some documents or ask your admin to raise it.`
      );
    }
  }
}

export function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
