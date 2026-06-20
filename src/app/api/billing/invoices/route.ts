import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/billing/invoices — list this company's GST subscription invoices.
async function GET_handler() {
  const invoices = await prisma.subscriptionInvoice.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export const GET = withApi(GET_handler);
