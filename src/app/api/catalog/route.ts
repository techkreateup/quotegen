import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, catalogSchema } from "@/lib/schemas";

async function GET_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const activeOnly = searchParams.get("active") === "true";

    const where: Record<string, unknown> = { deletedAt: null };
    if (activeOnly) where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { hsnSac: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await prisma.catalogItem.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(items);
  } catch (err: unknown) {
    console.error("GET /api/catalog error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(catalogSchema, data);
    if (!v.ok) return v.response!;
    const item = await prisma.catalogItem.create({ data });
    return NextResponse.json(item, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/catalog error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
