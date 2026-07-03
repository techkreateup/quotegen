import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaUnscoped } from "@/lib/db";
import { runWithTenant } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { sanitizeLineItems } from "@/lib/line-items";
import { enrollEntity } from "@/lib/cadence";
import { cronAuthError } from "@/lib/cron-auth";

// Daily recurring-invoice runner. Iterates every active company, finds recurring
// invoices whose nextDueDate has arrived, issues a real invoice per template
// (self-healing invoice number claim), advances the schedule, and auto-enrols
// the new invoice into the AR dunning cadence so reminders fire on the same
// engine as any other invoice. Idempotent per day: RecurringInvoice.nextDueDate
// advances the moment we generate, so a re-run won't produce duplicates.
//
//   GET /api/cron/recurring-invoices
//   Authorization: Bearer <CRON_SECRET>

function advanceDate(date: Date, frequency: string): Date {
  const next = new Date(date);
  switch (frequency) {
    case "Weekly": next.setDate(next.getDate() + 7); break;
    case "Monthly": next.setMonth(next.getMonth() + 1); break;
    case "Quarterly": next.setMonth(next.getMonth() + 3); break;
    case "Yearly": next.setFullYear(next.getFullYear() + 1); break;
    default: next.setMonth(next.getMonth() + 1);
  }
  return next;
}

async function generateForCompany(): Promise<{ generated: number; enrolled: number }> {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const due = await prisma.recurringInvoice.findMany({
    where: { isActive: true, nextDueDate: { lte: today }, deletedAt: null },
    include: { client: true },
  });

  let generated = 0, enrolled = 0;
  for (const rec of due) {
    try {
      const items = sanitizeLineItems(rec.items) as never;
      const invoice = await prisma.$transaction(async (tx) => {
        const { formatted: invoiceNo } = await nextDocNumber(tx, "nextInvoiceNo");
        return tx.invoice.create({
          data: {
            invoiceNo,
            title: rec.title,
            invoiceDate: new Date(),
            dueDate: null,
            clientId: rec.clientId,
            subtotal: rec.subtotal,
            totalAmount: rec.totalAmount,
            notes: rec.notes,
            termsAndConditions: rec.termsAndConditions,
            status: "Unpaid",
            items: { create: items },
          } as never,
          select: { id: true, invoiceNo: true },
        });
      });
      await prisma.recurringInvoice.update({
        where: { id: rec.id },
        data: { nextDueDate: advanceDate(rec.nextDueDate, rec.frequency), lastGeneratedAt: new Date() },
      });
      generated++;
      // Auto-enrol into ar_dunning so reminders fire without a manual send.
      try { await enrollEntity("ar_dunning", "invoice", invoice.id); enrolled++; } catch { /* best-effort */ }
    } catch (err) {
      console.error("[cron:recurring-invoices] failed for", rec.id, err);
    }
  }
  return { generated, enrolled };
}

async function run(request: NextRequest) {
  const authErr = cronAuthError(request);
  if (authErr) return authErr;

  const companies = await prismaUnscoped.company.findMany({
    where: { isActive: true }, select: { id: true },
  });

  let generated = 0, enrolled = 0, companiesRun = 0;
  for (const c of companies) {
    try {
      const r = await runWithTenant({ companyId: c.id, userId: "system" }, () => generateForCompany());
      generated += r.generated; enrolled += r.enrolled; companiesRun++;
    } catch (err) {
      console.error("[cron:recurring-invoices] company failed:", c.id, err);
    }
  }
  return NextResponse.json({ ok: true, companiesRun, generated, enrolled });
}

export const GET = run;
export const POST = run;
