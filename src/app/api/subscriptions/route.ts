import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

async function GET_handler() {
  try {
    const subs = await prisma.subscription.findMany({
      include: { payments: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    });

    const mapped = subs.map((s) => ({
      ...s,
      nextRenewalDate: s.nextRenewalDate.toISOString().split("T")[0],
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      _count: { payments: s.payments.length },
      payments: undefined,
    }));

    return NextResponse.json(mapped);
  } catch (err: unknown) {
    console.error("GET /api/subscriptions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, vendor, amount, billingCycle, nextRenewalDate, status, notes } = data;

    const sub = await prisma.subscription.create({
      data: {
        companyId: requireCompanyId(),
        name,
        vendor: vendor || "",
        amount: Number(amount),
        billingCycle,
        nextRenewalDate: new Date(nextRenewalDate),
        status: status || "Active",
        notes: notes || "",
      },
    });

    return NextResponse.json(sub, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/subscriptions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
