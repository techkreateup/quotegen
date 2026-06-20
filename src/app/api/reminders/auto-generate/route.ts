import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

/**
 * POST /api/reminders/auto-generate
 * Find overdue/unpaid invoices and create reminder records at 3, 7, 14, 30 day thresholds.
 */
async function POST_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    const now = new Date();
    let newCount = 0;

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["Unpaid", "Overdue"] },
        dueDate: { not: null },
      },
      include: {
        client: { select: { businessName: true, email: true } },
      },
    });

    const thresholds: { days: number; type: string }[] = [
      { days: 3, type: "3_day" },
      { days: 7, type: "7_day" },
      { days: 14, type: "14_day" },
      { days: 30, type: "30_day" },
    ];

    for (const inv of invoices) {
      if (!inv.dueDate) continue;
      const daysOverdue = Math.floor(
        (now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      for (const threshold of thresholds) {
        if (daysOverdue >= threshold.days) {
          // Check if already sent
          const existing = await prisma.invoiceReminder.findFirst({
            where: { invoiceId: inv.id, type: threshold.type },
          });

          if (!existing) {
            const sentTo = inv.client.email || "no-email@unknown.com";
            await prisma.invoiceReminder.create({
              data: {
                companyId: requireCompanyId(),
                invoiceId: inv.id,
                type: threshold.type,
                sentTo,
                status: "sent",
                notes: `Auto-generated ${threshold.type} reminder for ${inv.invoiceNo}`,
              },
            });

            // Also create a notification if userId is provided
            if (userId) {
              await prisma.notification.create({
                data: {
                  userId,
                  type: "OverdueInvoice",
                  title: `${threshold.type.replace("_", "-")} reminder sent for ${inv.invoiceNo}`,
                  body: `Reminder sent to ${sentTo} for â‚¹${inv.totalAmount.toLocaleString("en-IN")} from ${inv.client.businessName}`,
                  link: `/invoices/view?id=${inv.id}`,
                },
              });
            }

            newCount++;
          }
        }
      }
    }

    return NextResponse.json({ generated: newCount });
  } catch (e) {
    console.error("POST /api/reminders/auto-generate error:", e);
    return NextResponse.json({ error: "Failed to auto-generate reminders" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler);
