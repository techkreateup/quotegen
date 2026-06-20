import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        payments: { orderBy: { paidDate: "desc" } },
      },
    });
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...sub,
      nextRenewalDate: sub.nextRenewalDate.toISOString().split("T")[0],
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
      payments: sub.payments.map((p) => ({
        ...p,
        paidDate: p.paidDate.toISOString().split("T")[0],
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    console.error("GET /api/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function PUT_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.payments;
    delete data._count;

    const updateData: Record<string, unknown> = { ...data };
    if (data.amount !== undefined) updateData.amount = Number(data.amount);
    if (data.nextRenewalDate) updateData.nextRenewalDate = new Date(data.nextRenewalDate);

    const sub = await prisma.subscription.update({ where: { id }, data: updateData });
    return NextResponse.json(sub);
  } catch (err: unknown) {
    console.error("PUT /api/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETE_handler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Delete related transactions, then payments, then subscription
    const payments = await prisma.subscriptionPayment.findMany({ where: { subscriptionId: id }, select: { id: true } });
    const paymentIds = payments.map((p) => p.id);
    if (paymentIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { subscriptionPaymentId: { in: paymentIds } } });
    }
    await prisma.subscriptionPayment.deleteMany({ where: { subscriptionId: id } });
    await prisma.subscription.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/subscriptions/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const PUT = withApi(PUT_handler);
export const DELETE = withApi(DELETE_handler);
