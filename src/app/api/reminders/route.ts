import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

/**
 * GET /api/reminders
 * List all reminders, optionally filter by invoiceId
 */
async function GET_handler(request: NextRequest) {
  try {
    const invoiceId = request.nextUrl.searchParams.get("invoiceId");

    const where = invoiceId ? { invoiceId } : {};
    const reminders = await prisma.invoiceReminder.findMany({
      where,
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            totalAmount: true,
            client: { select: { businessName: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 500, // bound the result; UI paginates client-side
    });

    return NextResponse.json(
      reminders.map((r) => ({
        id: r.id,
        invoiceId: r.invoiceId,
        invoiceNo: r.invoice.invoiceNo,
        clientName: r.invoice.client.businessName,
        amount: r.invoice.totalAmount,
        type: r.type,
        sentAt: r.sentAt.toISOString(),
        sentTo: r.sentTo,
        status: r.status,
        notes: r.notes,
      }))
    );
  } catch (e) {
    console.error("GET /api/reminders error:", e);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

/**
 * POST /api/reminders
 * Manually create a reminder record
 */
async function POST_handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceId, type, sentTo, notes } = body;

    if (!invoiceId || !sentTo) {
      return NextResponse.json({ error: "invoiceId and sentTo are required" }, { status: 400 });
    }

    const reminder = await prisma.invoiceReminder.create({
      data: {
        companyId: requireCompanyId(),
        invoiceId,
        type: type || "manual",
        sentTo,
        status: "sent",
        notes: notes || "",
      },
    });

    return NextResponse.json(reminder);
  } catch (e) {
    console.error("POST /api/reminders error:", e);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
