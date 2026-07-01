import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fnf = await prisma.finalSettlement.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!fnf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const assets = await prisma.employeeAsset.findMany({ where: { employeeId: fnf.employeeId } });
  return NextResponse.json({ ...fnf, assets });
}
async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const k of ["status", "notes"]) if (k in body) data[k] = body[k];
  const row = await prisma.finalSettlement.update({ where: { id }, data: data as never });
  return NextResponse.json(row);
}
async function DELETE_handler(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.finalSettlement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
