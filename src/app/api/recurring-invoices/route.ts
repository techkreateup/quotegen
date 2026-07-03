import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parse, recurringInvoiceSchema } from "@/lib/schemas";

async function GET_handler() {
  try {
    const recurring = await prisma.recurringInvoice.findMany({
      where: { deletedAt: null },
      include: { client: true },
      orderBy: { createdAt: "desc" },
    });
    const result = recurring.map((r) => ({
      ...r,
      clientName: r.client.businessName,
      nextDueDate: r.nextDueDate.toISOString().split("T")[0],
      lastGeneratedAt: r.lastGeneratedAt?.toISOString().split("T")[0] || null,
    }));
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("GET /api/recurring-invoices error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(recurringInvoiceSchema, data);
    if (!v.ok) return v.response!;
    data.nextDueDate = new Date(data.nextDueDate);
    const recurring = await prisma.recurringInvoice.create({ data });
    return NextResponse.json(recurring, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/recurring-invoices error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
