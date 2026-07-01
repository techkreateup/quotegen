import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const ALLOWED = ["assetType", "tag", "description", "value", "issuedDate", "expectedReturn", "returnedDate", "status", "recoveryAmount", "notes"] as const;
const DATE_FIELDS = new Set(["issuedDate", "expectedReturn", "returnedDate"]);
function clean(b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (!(k in b)) continue;
    const v = b[k];
    if (v == null || v === "") { if (DATE_FIELDS.has(k)) out[k] = null; continue; }
    out[k] = DATE_FIELDS.has(k) ? new Date(v as string) : v;
  }
  return out;
}

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.employeeAsset.update({ where: { id }, data: clean(await req.json()) as never });
  return NextResponse.json(row);
}
async function DELETE_handler(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.employeeAsset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
