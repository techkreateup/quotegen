import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reminder = await prisma.invoiceReminder.findUnique({ where: { id }, include: { invoice: { select: { invoiceNo: true, totalAmount: true, client: { select: { businessName: true } } } } } });
  if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...reminder,
    invoiceNo: reminder.invoice.invoiceNo,
    clientName: reminder.invoice.client.businessName,
    amount: reminder.invoice.totalAmount,
    sentAt: reminder.sentAt.toISOString(),
  });
}

async function DELETE_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.invoiceReminder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const GET = withApi(GET_handler);
export const DELETE = withApi(DELETE_handler);
