import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

function addCycleToDate(date: Date, cycle: string): Date {
  const d = new Date(date);
  switch (cycle) {
    case "Monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "Quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "Yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

async function POST_handler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();

    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

    const amount = Number(data.amount || sub.amount);
    const paidDate = data.paidDate ? new Date(data.paidDate) : new Date();
    const notes = data.notes || "";

    const companyId = requireCompanyId();
    // Create payment
    const payment = await prisma.subscriptionPayment.create({
      data: {
        companyId,
        subscriptionId: id,
        amount,
        paidDate,
        notes,
      },
    });

    // Calculate next renewal date
    const nextRenewalDate = addCycleToDate(sub.nextRenewalDate, sub.billingCycle);

    // Update subscription's next renewal date
    await prisma.subscription.update({
      where: { id },
      data: { nextRenewalDate },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        companyId,
        date: paidDate,
        type: "Subscription",
        category: "Subscription",
        description: `Subscription: ${sub.name}`,
        amount,
        direction: "OUT",
        referenceType: "subscription",
        referenceId: sub.id,
        subscriptionPaymentId: payment.id,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/subscriptions/[id]/pay error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler);
