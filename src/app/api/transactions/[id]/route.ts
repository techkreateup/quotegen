import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, transactionUpdateSchema } from "@/lib/schemas";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function GET_handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transaction = await prisma.transaction.findUnique({ where: { id } });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...transaction,
      date: fmtDate(transaction.date),
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    });
  } catch (err: unknown) {
    console.error("GET /api/transactions/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function PUT_handler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(transactionUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;

    const updates: Record<string, unknown> = {};
    if (data.date !== undefined) updates.date = new Date(data.date);
    if (data.type !== undefined) updates.type = data.type;
    if (data.category !== undefined) updates.category = data.category;
    if (data.description !== undefined) updates.description = data.description;
    if (data.amount !== undefined) updates.amount = Number(data.amount);
    if (data.direction !== undefined) updates.direction = data.direction;
    if (data.notes !== undefined) updates.notes = data.notes;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      ...transaction,
      date: fmtDate(transaction.date),
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    });
  } catch (err: unknown) {
    console.error("PUT /api/transactions/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transaction = await prisma.transaction.findUnique({ where: { id } });
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.referenceType) {
      return NextResponse.json(
        { error: "Cannot delete auto-generated transactions. Only manual entries can be deleted." },
        { status: 400 }
      );
    }

    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/transactions/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
