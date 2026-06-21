import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  getStorageConfig, globalStorageBytes, configuredPools, activePool,
  STORAGE_TOTAL_KEY, STORAGE_COMPANY_KEY, ACTIVE_POOL_KEY,
} from "@/lib/storage";

// Platform storage overview for the super admin: total used vs capacity, a
// per-company breakdown, configured storage pools, and the editable limits.
async function GET_handler() {
  const [cfg, globalUsed, grouped, companies, pools, active] = await Promise.all([
    getStorageConfig(),
    globalStorageBytes(),
    prismaUnscoped.document.groupBy({ by: ["companyId"], _sum: { sizeBytes: true }, _count: true }),
    prismaUnscoped.company.findMany({ select: { id: true, name: true, storageQuotaBytes: true } }),
    Promise.resolve(configuredPools()),
    activePool(),
  ]);

  const usage = new Map(grouped.map((g) => [g.companyId, { used: g._sum.sizeBytes ?? 0, count: g._count }]));
  const rows = companies
    .map((c) => ({
      companyId: c.id,
      name: c.name,
      usedBytes: usage.get(c.id)?.used ?? 0,
      docCount: usage.get(c.id)?.count ?? 0,
      quotaBytes: c.storageQuotaBytes,
    }))
    .sort((a, b) => b.usedBytes - a.usedBytes);

  return NextResponse.json({
    config: { ...cfg, globalUsed },
    companies: rows,
    pools,
    activePool: active,
  });
}

// Update platform storage limits / active pool, or a single company's quota.
async function PUT_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const body = await request.json().catch(() => ({}));

  // Per-company quota override: { companyId, quotaBytes|null }
  if (typeof body.companyId === "string") {
    const q = body.quotaBytes;
    await prismaUnscoped.company.update({
      where: { id: body.companyId },
      data: { storageQuotaBytes: q === null || q === "" ? null : Math.max(0, Math.floor(Number(q))) },
    });
    logAudit({ userId: adminId, entity: "Company", entityId: body.companyId, action: "UPDATE_STORAGE_QUOTA" });
    return NextResponse.json({ ok: true });
  }

  // Platform settings: { totalBytes?, perCompanyBytes?, activePool? }
  const writes: Promise<unknown>[] = [];
  const setKey = (key: string, value: string) =>
    prismaUnscoped.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } });

  if (body.totalBytes != null) writes.push(setKey(STORAGE_TOTAL_KEY, String(Math.max(0, Math.floor(Number(body.totalBytes))))));
  if (body.perCompanyBytes != null) writes.push(setKey(STORAGE_COMPANY_KEY, String(Math.max(0, Math.floor(Number(body.perCompanyBytes))))));
  if (typeof body.activePool === "string" && body.activePool) writes.push(setKey(ACTIVE_POOL_KEY, body.activePool));

  if (writes.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  await Promise.all(writes);
  logAudit({ userId: adminId, entity: "PlatformSetting", entityId: "storage", action: "UPDATE_STORAGE_SETTINGS" });
  return NextResponse.json({ ok: true });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const PUT = withApi(PUT_handler, { allowPlatform: true });
