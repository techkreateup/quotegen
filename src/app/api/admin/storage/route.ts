import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { storageOverview, activePool, listPools, poolUsage, ACTIVE_POOL_KEY } from "@/lib/storage";

async function GET_handler() {
  const [overview, active, grouped, companies] = await Promise.all([
    storageOverview(),
    activePool(),
    prismaUnscoped.document.groupBy({ by: ["companyId"], _sum: { sizeBytes: true }, _count: true }),
    prismaUnscoped.company.findMany({ select: { id: true, name: true, slug: true, storageQuotaBytes: true } }),
  ]);

  const usage = new Map(grouped.map((g) => [g.companyId, { used: g._sum.sizeBytes ?? 0, count: g._count }]));
  const rows = companies
    .map((c) => ({
      companyId: c.id,
      name: c.name,
      slug: c.slug,
      usedBytes: usage.get(c.id)?.used ?? 0,
      docCount: usage.get(c.id)?.count ?? 0,
      quotaBytes: c.storageQuotaBytes,
    }))
    .sort((a, b) => b.usedBytes - a.usedBytes);

  return NextResponse.json({ overview, activePool: active, companies: rows });
}

// POST: add a new UploadThing pool { name, label?, token, capacityMb? }
async function POST_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const token = String(body.token || "").trim();

  if (!name) return NextResponse.json({ error: "A pool name is required" }, { status: 400 });
  if (name === "primary") return NextResponse.json({ error: "'primary' is reserved for the env token" }, { status: 400 });
  // UploadThing v7 tokens are base64-encoded JSON containing apiKey + appId.
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    if (!decoded.apiKey || !decoded.appId) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid UploadThing token" }, { status: 400 });
  }

  const exists = await prismaUnscoped.storagePool.findUnique({ where: { name } });
  if (exists) return NextResponse.json({ error: "A pool with that name already exists" }, { status: 409 });

  await prismaUnscoped.storagePool.create({
    data: {
      name,
      label: String(body.label || name).slice(0, 60),
      tokenEnc: encryptSecret(token),
      capacityMb: Math.max(1, Math.floor(Number(body.capacityMb) || 2048)),
    },
  });
  logAudit({ userId: adminId, entity: "StoragePool", entityId: name, action: "ADD_STORAGE_POOL" });
  return NextResponse.json({ ok: true });
}

// PUT: per-company override { companyId, quotaBytes|null }, or activate a pool
// { activatePool }, or edit pool capacity { poolName, capacityMb }.
async function PUT_handler(request: NextRequest) {
  const adminId = request.headers.get("x-user-id") || "system";
  const body = await request.json().catch(() => ({}));

  if (typeof body.companyId === "string") {
    const q = body.quotaBytes;
    await prismaUnscoped.company.update({
      where: { id: body.companyId },
      data: { storageQuotaBytes: q === null || q === "" ? null : Math.max(0, Math.floor(Number(q))) },
    });
    logAudit({ userId: adminId, entity: "Company", entityId: body.companyId, action: "UPDATE_STORAGE_QUOTA" });
    return NextResponse.json({ ok: true });
  }

  if (typeof body.activatePool === "string") {
    const pools = await listPools();
    if (!pools.some((p) => p.name === body.activatePool)) return NextResponse.json({ error: "Unknown pool" }, { status: 400 });
    // DB pools carry the active flag; env pools use the setting.
    await prismaUnscoped.storagePool.updateMany({ data: { isActive: false } });
    await prismaUnscoped.storagePool.updateMany({ where: { name: body.activatePool }, data: { isActive: true } });
    await prismaUnscoped.platformSetting.upsert({ where: { key: ACTIVE_POOL_KEY }, create: { key: ACTIVE_POOL_KEY, value: body.activatePool }, update: { value: body.activatePool } });
    logAudit({ userId: adminId, entity: "StoragePool", entityId: body.activatePool, action: "ACTIVATE_STORAGE_POOL" });
    return NextResponse.json({ ok: true });
  }

  if (typeof body.poolName === "string" && body.capacityMb != null) {
    await prismaUnscoped.storagePool.updateMany({ where: { name: body.poolName }, data: { capacityMb: Math.max(1, Math.floor(Number(body.capacityMb))) } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

// DELETE: remove a DB pool ?name=  (blocked if it still holds documents).
async function DELETE_handler(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name") || "";
  const used = (await poolUsage())[name] ?? 0;
  if (used > 0) return NextResponse.json({ error: "This pool still holds documents — move or delete them first." }, { status: 409 });
  await prismaUnscoped.storagePool.deleteMany({ where: { name } });
  logAudit({ userId: request.headers.get("x-user-id") || "system", entity: "StoragePool", entityId: name, action: "DELETE_STORAGE_POOL" });
  return NextResponse.json({ ok: true });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const POST = withApi(POST_handler, { allowPlatform: true });
export const PUT = withApi(PUT_handler, { allowPlatform: true });
export const DELETE = withApi(DELETE_handler, { allowPlatform: true });
