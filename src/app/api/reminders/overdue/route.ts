import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * GET /api/reminders/overdue
 * Returns all Unpaid/Overdue invoices with due dates in the past, sorted by days overdue desc.
 */
async function GET_handler() {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["Unpaid", "Overdue", "PartiallyPaid"] },
        dueDate: { lt: now },
      },
      include: {
        client: { select: { businessName: true, email: true, phones: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    const result = invoices.map((inv) => {
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - (inv.dueDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24))
      );
      return {
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        clientName: inv.client.businessName,
        clientEmail: inv.client.email || "",
        clientPhones: inv.client.phones || [],
        totalAmount: inv.totalAmount,
        dueDate: inv.dueDate?.toISOString().split("T")[0] || "",
        status: inv.status,
        daysOverdue,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/reminders/overdue error:", e);
    return NextResponse.json({ error: "Failed to fetch overdue invoices" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
