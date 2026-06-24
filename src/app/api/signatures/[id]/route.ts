import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Update / deactivate a library signature (tenant-scoped via the extension).
async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.signature.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Signature not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 120);
  if (typeof body.role === "string") data.role = body.role.trim().slice(0, 80);
  if (typeof body.imageUrl === "string" && body.imageUrl.trim()) data.imageUrl = body.imageUrl.trim();
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.signature.update({ where: { id }, data });
  return NextResponse.json({ signature: updated });
}

async function DELETE_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.signature.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Signature not found" }, { status: 404 });
  await prisma.signature.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
