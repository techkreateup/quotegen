import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { logAudit } from "@/lib/audit";

const ALLOWED = ["employeeId", "assetType", "tag", "description", "value", "issuedDate", "expectedReturn", "returnedDate", "status", "recoveryAmount", "notes"] as const;
const DATE_FIELDS = new Set(["issuedDate", "expectedReturn", "returnedDate"]);

function clean(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v == null || v === "") { if (DATE_FIELDS.has(k)) out[k] = null; continue; }
    out[k] = DATE_FIELDS.has(k) ? new Date(v as string) : v;
  }
  return out;
}

async function GET_handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const employeeId = sp.get("employeeId");
  const where = employeeId ? { employeeId } : {};
  const rows = await prisma.employeeAsset.findMany({ where, orderBy: { issuedDate: "desc" }, include: { employee: { select: { name: true, employeeCode: true } } } });
  return NextResponse.json(rows);
}

async function POST_handler(req: NextRequest) {
  const body = await req.json();
  if (!body.employeeId || !body.assetType) return NextResponse.json({ error: "employeeId and assetType required" }, { status: 400 });
  const data = clean(body);
  if (!data.issuedDate) data.issuedDate = new Date();
  const row = await prisma.employeeAsset.create({ data: { companyId: requireCompanyId(), ...data } as never });
  logAudit({ userId: req.headers.get("x-user-id") || "system", entity: "EmployeeAsset", entityId: row.id, action: "CREATE", after: { assetType: row.assetType, tag: row.tag, employeeId: row.employeeId } });
  return NextResponse.json(row, { status: 201 });
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler, { requireVerified: true });
