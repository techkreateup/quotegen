import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { sanitizeLineItems } from "@/lib/line-items";

function advanceDate(date: Date, frequency: string): Date {
  const next = new Date(date);
  switch (frequency) {
    case "Weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "Monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "Quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "Yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

async function POST_handler() {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dueRecurring = await prisma.recurringInvoice.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: today },
      },
      include: { client: true },
    });

    const generated: string[] = [];

    const companyId = requireCompanyId();
    for (const rec of dueRecurring) {
      // Parse items from stored JSON, stripping any stale relation keys
      const itemsCreate = sanitizeLineItems(rec.items) as never;

      const invoice = await prisma.$transaction(async (tx) => {
        const { formatted: invoiceNo } = await nextDocNumber(tx, "nextInvoiceNo");
        return tx.invoice.create({
          data: {
            companyId,
            invoiceNo,
            title: rec.title,
            invoiceDate: new Date(),
            clientId: rec.clientId,
            subtotal: rec.subtotal,
            totalAmount: rec.totalAmount,
            notes: rec.notes,
            termsAndConditions: rec.termsAndConditions,
            status: "Unpaid",
            items: { create: itemsCreate },
          },
        });
      });

      // Advance next due date
      const nextDueDate = advanceDate(rec.nextDueDate, rec.frequency);
      await prisma.recurringInvoice.update({
        where: { id: rec.id },
        data: {
          nextDueDate,
          lastGeneratedAt: new Date(),
        },
      });

      generated.push(invoice.invoiceNo);
    }

    return NextResponse.json({
      message: `Generated ${generated.length} invoice(s)`,
      invoices: generated,
    });
  } catch (err: unknown) {
    console.error("POST /api/recurring-invoices/generate error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withApi(POST_handler);
