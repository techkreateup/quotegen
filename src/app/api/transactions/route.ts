import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { parse, transactionSchema } from "@/lib/schemas";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get("type");
    const direction = sp.get("direction");
    const from = sp.get("from");
    const to = sp.get("to");
    const pageParam = sp.get("page");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (direction) where.direction = direction;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to + "T23:59:59.999Z");
    }

    const mapTx = (t: { date: Date; createdAt: Date; updatedAt: Date; [key: string]: unknown }) => ({
      ...t,
      date: fmtDate(t.date),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    });

    if (!pageParam) {
      const transactions = await prisma.transaction.findMany({ where, orderBy: { date: "desc" } });
      return NextResponse.json(transactions.map(mapTx));
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { date: "desc" }, skip, take: limit }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({
      data: transactions.map(mapTx),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    console.error("GET /api/transactions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(transactionSchema, data);
    if (!v.ok) return v.response!;

    const transaction = await prisma.transaction.create({
      data: {
        companyId: requireCompanyId(),
        date: new Date(data.date),
        type: data.type,
        category: data.category || "",
        description: data.description || "",
        amount: Number(data.amount),
        direction: data.direction,
        notes: data.notes || "",
      },
    });

    return NextResponse.json(
      {
        ...transaction,
        date: fmtDate(transaction.date),
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("POST /api/transactions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
