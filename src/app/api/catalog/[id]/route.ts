import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, catalogUpdateSchema } from "@/lib/schemas";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(catalogUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    delete data.id;
    delete data.createdAt;
    const item = await prisma.catalogItem.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (err: unknown) {
    console.error("PUT /api/catalog/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.catalogItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
