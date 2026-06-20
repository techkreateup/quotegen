import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * POST /api/notifications/generate
 * Scans for actionable items and creates notifications if they don't already exist today.
 * Called on dashboard load or manually.
 */
async function POST_handler(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id") || "";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(now.getTime() + 7 * 86400000);
    const created: string[] = [];

    // Helper: only create if no similar notification exists today
    async function createIfNew(
      type: "OverdueInvoice" | "DeadlineReminder" | "RenewalReminder" | "SalaryDue" | "VoucherPending" | "General",
      title: string,
      body: string,
      link: string | null,
      dedupeKey: string
    ) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type,
          title: { contains: dedupeKey },
          createdAt: { gte: todayStart },
        },
      });
      if (!existing) {
        await prisma.notification.create({
          data: { userId, type, title, body, link },
        });
        created.push(title);
      }
    }

    // 1. Overdue Invoices
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["Unpaid", "Overdue"] },
        dueDate: { lt: now },
      },
      include: { client: { select: { businessName: true } } },
      take: 20,
    });

    for (const inv of overdueInvoices) {
      // Also auto-mark as Overdue if still "Unpaid"
      if (inv.status === "Unpaid") {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { status: "Overdue" },
        });
      }
      await createIfNew(
        "OverdueInvoice",
        `Invoice ${inv.invoiceNo} is overdue`,
        `₹${inv.totalAmount.toLocaleString("en-IN")} from ${inv.client.businessName}`,
        `/invoices/view?id=${inv.id}`,
        inv.invoiceNo
      );
    }

    // 2. Upcoming subscription renewals (within 7 days)
    const renewals = await prisma.subscription.findMany({
      where: {
        status: "Active",
        nextRenewalDate: { gte: todayStart, lte: weekFromNow },
      },
      take: 20,
    });

    for (const sub of renewals) {
      const days = Math.ceil((sub.nextRenewalDate.getTime() - now.getTime()) / 86400000);
      await createIfNew(
        "RenewalReminder",
        `${sub.name} renewal in ${days} day${days !== 1 ? "s" : ""}`,
        `₹${sub.amount.toLocaleString("en-IN")} – ${sub.billingCycle}`,
        `/subscriptions`,
        sub.name
      );
    }

    // 3. Project deadlines within 3 days
    const threeDaysOut = new Date(now.getTime() + 3 * 86400000);
    const deadlineProjects = await prisma.project.findMany({
      where: {
        status: { in: ["Pending", "InProgress"] },
        deadline: { gte: todayStart, lte: threeDaysOut },
      },
      take: 20,
    });

    for (const proj of deadlineProjects) {
      const days = Math.ceil(((proj.deadline as Date).getTime() - now.getTime()) / 86400000);
      await createIfNew(
        "DeadlineReminder",
        `Project "${proj.title}" deadline in ${days} day${days !== 1 ? "s" : ""}`,
        proj.description?.slice(0, 80) || "",
        `/projects/view?id=${proj.id}`,
        proj.title
      );
    }

    // 4. Pending salary records for current month
    const pendingSalary = await prisma.salaryRecord.findMany({
      where: {
        status: "Pending",
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
      include: { employee: { select: { name: true } } },
      take: 20,
    });

    if (pendingSalary.length > 0) {
      await createIfNew(
        "SalaryDue",
        `${pendingSalary.length} salary record${pendingSalary.length > 1 ? "s" : ""} pending`,
        pendingSalary.slice(0, 3).map((s) => s.employee.name).join(", ") + (pendingSalary.length > 3 ? ` +${pendingSalary.length - 3} more` : ""),
        `/salary`,
        `${pendingSalary.length} salary`
      );
    }

    // 5. Unacknowledged vouchers
    const unackVouchers = await prisma.paymentVoucher.count({
      where: { isAcknowledged: false },
    });

    if (unackVouchers > 0) {
      await createIfNew(
        "VoucherPending",
        `${unackVouchers} voucher${unackVouchers > 1 ? "s" : ""} pending acknowledgment`,
        "Payment vouchers awaiting employee signature",
        `/vouchers`,
        `${unackVouchers} voucher`
      );
    }

    return NextResponse.json({ generated: created.length, items: created });
  } catch (e) {
    console.error("Notification generate error:", e);
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler);
