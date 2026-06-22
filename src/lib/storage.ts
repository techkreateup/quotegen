import { prismaUnscoped } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

// ── Storage model (DB-managed multi-pool) ────────────────────────────────────
// Storage is a set of POOLS, each one an UploadThing account. Pools come from:
//   • the environment — UPLOADTHING_TOKEN ("primary") + UPLOADTHING_TOKEN_<NAME>,
//   • the StoragePool table — added by the super admin at /admin/storage (token
//     encrypted at rest). DB pools override env pools of the same name.
// Total platform capacity = sum of every pool's capacity, so adding an account
// instantly grows capacity. Each Document records its pool (Document.storagePool)
// so a company's files can span pools and deletion always uses the right account.
//
// There is NO fixed per-company limit — companies draw from the shared pool. The
// super admin may set an optional per-company override (Company.storageQuotaBytes).

const MB = 1024 * 1024;
export const DEFAULT_POOL_CAPACITY = 2 * 1024 ** 3; // 2 GB
export const POOL_CAPACITY_KEY = "storage_pool_capacity_bytes";
export const ACTIVE_POOL_KEY = "storage_active_pool";
export const PRIMARY_POOL = "primary";

export interface PoolInfo {
  name: string;
  label: string;
  token?: string;
  capacityBytes: number;
  isActive: boolean;
  source: "env" | "db";
  hasToken: boolean;
}

async function settingNumber(key: string, def: number): Promise<number> {
  try {
    const row = await prismaUnscoped.platformSetting.findUnique({ where: { key } });
    const n = Number(row?.value);
    return Number.isFinite(n) && n > 0 ? n : def;
  } catch {
    return def;
  }
}

/** Default per-pool capacity for env pools (editable setting). */
export async function poolCapacityBytes(): Promise<number> {
  return settingNumber(POOL_CAPACITY_KEY, DEFAULT_POOL_CAPACITY);
}

function envPools(cap: number): PoolInfo[] {
  const out: PoolInfo[] = [];
  if (process.env.UPLOADTHING_TOKEN)
    out.push({ name: PRIMARY_POOL, label: "Primary", token: process.env.UPLOADTHING_TOKEN, capacityBytes: cap, isActive: false, source: "env", hasToken: true });
  for (const k of Object.keys(process.env)) {
    const m = k.match(/^UPLOADTHING_TOKEN_(.+)$/);
    if (m) {
      const name = m[1].toLowerCase();
      out.push({ name, label: name, token: process.env[k], capacityBytes: cap, isActive: false, source: "env", hasToken: !!process.env[k] });
    }
  }
  return out;
}

async function dbPools(): Promise<PoolInfo[]> {
  try {
    const rows = await prismaUnscoped.storagePool.findMany();
    return rows.map((r) => {
      let token: string | undefined;
      try { token = decryptSecret(r.tokenEnc); } catch { token = undefined; }
      return {
        name: r.name,
        label: r.label || r.name,
        token,
        capacityBytes: (r.capacityMb || 2048) * MB,
        isActive: r.isActive,
        source: "db" as const,
        hasToken: !!token,
      };
    });
  } catch {
    return [];
  }
}

/** All pools (env + DB; DB wins on name collision). */
export async function listPools(): Promise<PoolInfo[]> {
  const cap = await poolCapacityBytes();
  const byName = new Map<string, PoolInfo>();
  for (const p of envPools(cap)) byName.set(p.name, p);
  for (const p of await dbPools()) byName.set(p.name, p);
  if (byName.size === 0)
    byName.set(PRIMARY_POOL, { name: PRIMARY_POOL, label: "Primary", capacityBytes: cap, isActive: true, source: "env", hasToken: false });
  return [...byName.values()];
}

export async function poolToken(name: string): Promise<string | undefined> {
  return (await listPools()).find((p) => p.name === name)?.token;
}

export async function activePool(): Promise<string> {
  const pools = await listPools();
  const dbActive = pools.find((p) => p.isActive);
  if (dbActive) return dbActive.name;
  try {
    const row = await prismaUnscoped.platformSetting.findUnique({ where: { key: ACTIVE_POOL_KEY } });
    if (row?.value && pools.some((p) => p.name === row.value)) return row.value;
  } catch {
    /* fall through */
  }
  return pools[0]?.name ?? PRIMARY_POOL;
}

export async function poolUsage(): Promise<Record<string, number>> {
  const [grouped, pools] = await Promise.all([
    prismaUnscoped.document.groupBy({ by: ["storagePool"], _sum: { sizeBytes: true } }),
    listPools(),
  ]);
  const usage: Record<string, number> = {};
  for (const p of pools) usage[p.name] = 0;
  for (const g of grouped) usage[g.storagePool] = (usage[g.storagePool] ?? 0) + (g._sum.sizeBytes ?? 0);
  return usage;
}

export async function globalStorageBytes(): Promise<number> {
  const agg = await prismaUnscoped.document.aggregate({ _sum: { sizeBytes: true } });
  return agg._sum.sizeBytes ?? 0;
}

export async function companyStorageBytes(companyId: string): Promise<number> {
  const agg = await prismaUnscoped.document.aggregate({ where: { companyId }, _sum: { sizeBytes: true } });
  return agg._sum.sizeBytes ?? 0;
}

export async function storageOverview() {
  const [pools, usage] = await Promise.all([listPools(), poolUsage()]);
  const list = pools.map((p) => ({
    name: p.name,
    label: p.label,
    usedBytes: usage[p.name] ?? 0,
    capacityBytes: p.capacityBytes,
    hasToken: p.hasToken,
    isActive: p.isActive,
    source: p.source,
  }));
  const totalCapacity = list.reduce((a, b) => a + b.capacityBytes, 0);
  const totalUsed = Object.values(usage).reduce((a, b) => a + b, 0);
  return { pools: list, totalCapacity, totalUsed, safetyBytes: Math.floor(totalCapacity * 0.95) };
}

/** Pool new uploads should target: active pool if it has space, else any pool with room. */
export async function resolveUploadPool(): Promise<string> {
  const [active, pools, usage] = await Promise.all([activePool(), listPools(), poolUsage()]);
  const find = (n: string) => pools.find((p) => p.name === n);
  const free = (p: PoolInfo) => p.capacityBytes - (usage[p.name] ?? 0);
  const a = find(active);
  if (a?.hasToken && free(a) > a.capacityBytes * 0.02) return active;
  const fb = pools.find((p) => p.hasToken && free(p) > p.capacityBytes * 0.02);
  return fb?.name ?? active;
}

/** Per-company override quota (bytes) or null (no per-company cap). */
export async function companyQuotaBytes(companyId: string): Promise<number | null> {
  const c = await prismaUnscoped.company.findUnique({ where: { id: companyId }, select: { storageQuotaBytes: true } });
  return c?.storageQuotaBytes ?? null;
}

export async function assertStorageAvailable(companyId: string, incomingBytes: number): Promise<void> {
  const ov = await storageOverview();
  if (ov.totalUsed + incomingBytes > ov.safetyBytes) {
    throw new Error("Platform storage is full. Please contact support to add capacity.");
  }
  const override = await companyQuotaBytes(companyId);
  if (override != null) {
    const used = await companyStorageBytes(companyId);
    if (used + incomingBytes > override) {
      throw new Error(`Your storage limit (${formatBytes(override)}) is reached. Delete some documents or ask your admin to raise it.`);
    }
  }
}

export function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
