import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, recurringInvoiceUpdateSchema } from "@/lib/schemas";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recurring = await prisma.recurringInvoice.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!recurring) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...recurring,
    clientName: recurring.client.businessName,
    nextDueDate: recurring.nextDueDate.toISOString().split("T")[0],
    lastGeneratedAt: recurring.lastGeneratedAt?.toISOString().split("T")[0] || null,
  });
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    const parsed = parse(recurringInvoiceUpdateSchema, data);
    if (!parsed.ok) return parsed.response!;
    delete data.id;
    delete data.createdAt;
    delete data.client;
    delete data.clientName;
    if (data.nextDueDate) data.nextDueDate = new Date(data.nextDueDate);
    if (data.lastGeneratedAt) data.lastGeneratedAt = new Date(data.lastGeneratedAt);
    const recurring = await prisma.recurringInvoice.update({ where: { id }, data });
    return NextResponse.json(recurring);
  } catch (err: unknown) {
    console.error("PUT /api/recurring-invoices/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.recurringInvoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/recurring-invoices/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
