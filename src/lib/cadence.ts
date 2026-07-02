// ─── Cadence engine (Track B / Sprint B4, server-side) ───────────────────────
// Multi-step escalating reminder sequences (AR dunning, quote follow-up). Seeds
// default cadences per company, enrolls documents, and (from the daily cron)
// dispatches each step when its scheduled date arrives. Idempotent via
// MessageLog.dedupeKey so a re-run never double-sends. All sends are best-effort
// (fail-open): one bad enrollment never blocks the batch.

import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { sendMessage } from "@/lib/messaging";
import { renderTemplate } from "@/lib/merge";
import { buildEntityContext } from "@/lib/message-context";
import { SYSTEM_TEMPLATES } from "@/lib/message-templates";
import type { EmailBrand } from "@/lib/email-template";

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Ensure the built-in message templates exist for this company (idempotent). */
export async function ensureSystemTemplates(companyId: string): Promise<void> {
  const count = await prisma.messageTemplate.count();
  if (count > 0) return;
  await prisma.messageTemplate.createMany({
    data: SYSTEM_TEMPLATES.map((t) => ({
      companyId,
      name: t.name, category: t.category, channel: t.channel, entityType: t.entityType,
      subject: t.subject, body: t.body, attachPdf: t.attachPdf, attachKind: t.attachKind,
      isSystem: true,
    })),
  });
}

// Default cadences. Steps reference a template by NAME (resolved to the company's
// seeded template id at seed time). Offsets are days from the anchor date.
interface StepDef { offsetDays: number; channel: string; templateName: string }
interface CadenceDef {
  trigger: string; name: string; anchor: string; entityType: string;
  stopOnPaid: boolean; steps: StepDef[];
}

export const DEFAULT_CADENCES: CadenceDef[] = [
  {
    trigger: "ar_dunning", name: "Invoice payment reminders", anchor: "dueDate",
    entityType: "invoice", stopOnPaid: true,
    steps: [
      { offsetDays: -3, channel: "BOTH", templateName: "Payment reminder — Gentle (before/at due)" },
      { offsetDays: 1, channel: "BOTH", templateName: "Payment reminder — Gentle (before/at due)" },
      { offsetDays: 7, channel: "BOTH", templateName: "Payment reminder — Firm (overdue)" },
      { offsetDays: 15, channel: "BOTH", templateName: "Payment reminder — Firm (overdue)" },
      { offsetDays: 30, channel: "EMAIL", templateName: "Payment reminder — Final notice" },
    ],
  },
  {
    trigger: "vendor_bill_due", name: "Vendor bill payment reminders", anchor: "dueDate",
    entityType: "purchaseBill", stopOnPaid: true,
    steps: [
      { offsetDays: -3, channel: "EMAIL", templateName: "Vendor bill — Payment due reminder" },
      { offsetDays: 0, channel: "EMAIL", templateName: "Vendor bill — Payment due reminder" },
    ],
  },
  {
    trigger: "quote_followup", name: "Quotation follow-ups", anchor: "sentDate",
    entityType: "quotation", stopOnPaid: false,
    steps: [
      { offsetDays: 2, channel: "BOTH", templateName: "Quotation — Follow-up" },
      { offsetDays: 5, channel: "BOTH", templateName: "Quotation — Follow-up" },
      { offsetDays: 10, channel: "BOTH", templateName: "Quotation — Follow-up" },
    ],
  },
];

/** Seed default cadences (and their templates) for a company, idempotent. */
export async function ensureCadences(companyId: string): Promise<void> {
  await ensureSystemTemplates(companyId);
  const templates = await prisma.messageTemplate.findMany({ select: { id: true, name: true } });
  const byName = new Map(templates.map((t) => [t.name, t.id]));

  for (const def of DEFAULT_CADENCES) {
    const existing = await prisma.cadence.findFirst({ where: { trigger: def.trigger } });
    if (existing) continue;
    await prisma.cadence.create({
      data: {
        companyId,
        name: def.name, trigger: def.trigger, anchor: def.anchor,
        entityType: def.entityType, isSystem: true, stopOnPaid: def.stopOnPaid,
        steps: {
          create: def.steps.map((s, i) => ({
            stepOrder: i, offsetDays: s.offsetDays, channel: s.channel,
            templateId: byName.get(s.templateName) ?? null,
          })),
        },
      },
    });
  }
}

/** Resolve the anchor date for an entity from its own dates. */
async function resolveAnchor(entityType: string, entityId: string): Promise<Date | null> {
  if (entityType === "invoice") {
    const inv = await prisma.invoice.findUnique({ where: { id: entityId }, select: { dueDate: true, invoiceDate: true } });
    return inv ? (inv.dueDate ?? inv.invoiceDate) : null;
  }
  if (entityType === "purchaseBill") {
    const b = await prisma.purchaseBill.findUnique({ where: { id: entityId }, select: { dueDate: true, billDate: true } });
    if (!b) return null;
    return b.dueDate ?? new Date(new Date(b.billDate).getTime() + 30 * 86400_000);
  }
  if (entityType === "quotation") {
    const q = await prisma.quotation.findUnique({ where: { id: entityId }, select: { quotationDate: true } });
    return q ? (q.quotationDate ?? new Date()) : new Date();
  }
  return new Date();
}

/**
 * Enrol a document into its cadence (idempotent on companyId+cadence+entity).
 * Called when a document is sent. Sets the anchor + first step's run date.
 */
export async function enrollEntity(trigger: string, entityType: string, entityId: string): Promise<void> {
  const companyId = requireCompanyId();
  await ensureCadences(companyId);
  const cadence = await prisma.cadence.findFirst({
    where: { trigger, isActive: true },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!cadence || cadence.steps.length === 0) return;

  const anchor = await resolveAnchor(entityType, entityId);
  if (!anchor) return;
  const firstRun = addDays(anchor, cadence.steps[0].offsetDays);

  await prisma.cadenceEnrollment.upsert({
    where: {
      companyId_cadenceId_entityType_entityId: { companyId, cadenceId: cadence.id, entityType, entityId },
    },
    create: {
      companyId, cadenceId: cadence.id, entityType, entityId,
      currentStep: 0, anchorDate: anchor, nextRunAt: firstRun, status: "active",
    },
    update: {}, // already enrolled — leave as-is
  });
}

/**
 * Process all due enrollments for the CURRENT tenant context. Returns counts.
 * Assumes it runs inside runWithTenant() (the cron sets context per company).
 */
export async function runCadencesForCompany(): Promise<{ sent: number; advanced: number; stopped: number }> {
  const now = new Date();
  let sent = 0, advanced = 0, stopped = 0;

  const enrollments = await prisma.cadenceEnrollment.findMany({
    where: { status: "active", OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
    include: { cadence: { include: { steps: { orderBy: { stepOrder: "asc" } } } } },
    take: 200,
  });

  for (const e of enrollments) {
    try {
      const steps = e.cadence.steps;
      if (e.currentStep >= steps.length) {
        await prisma.cadenceEnrollment.update({ where: { id: e.id }, data: { status: "done", nextRunAt: null } });
        continue;
      }

      // Build the entity context once (also tells us if it's paid → stop).
      const ec = await buildEntityContext(e.entityType, e.entityId);
      if (!ec) { // entity gone — stop the enrollment
        await prisma.cadenceEnrollment.update({ where: { id: e.id }, data: { status: "stopped", nextRunAt: null } });
        stopped++;
        continue;
      }
      if (e.cadence.stopOnPaid && (e.entityType === "invoice" || e.entityType === "purchaseBill")) {
        const ctx = ec.context as { invoice?: { balance?: number }; bill?: { balance?: number } };
        const balance = Number(ctx.invoice?.balance ?? ctx.bill?.balance ?? 0);
        if (balance <= 0) {
          await prisma.cadenceEnrollment.update({ where: { id: e.id }, data: { status: "stopped", nextRunAt: null } });
          stopped++;
          continue;
        }
      }

      const step = steps[e.currentStep];
      const scheduledAt = addDays(e.anchorDate ?? now, step.offsetDays);

      if (scheduledAt > now) {
        // Not due yet — park nextRunAt so we don't re-evaluate until then.
        await prisma.cadenceEnrollment.update({ where: { id: e.id }, data: { nextRunAt: scheduledAt } });
        continue;
      }

      // Dispatch this step.
      const tpl = step.templateId
        ? await prisma.messageTemplate.findUnique({ where: { id: step.templateId }, select: { subject: true, body: true } })
        : null;
      if (tpl) {
        const subject = renderTemplate(tpl.subject, ec.context, { escape: false });
        const body = renderTemplate(tpl.body, ec.context, { escape: true });
        const brand = ec.context.company as { name?: string; email?: string } | undefined;
        const channels = step.channel === "BOTH" ? ["EMAIL", "WHATSAPP"] as const : [step.channel as "EMAIL" | "WHATSAPP"];
        for (const ch of channels) {
          const to = ch === "EMAIL" ? ec.defaultEmail : ec.defaultPhone;
          if (!to) continue;
          await sendMessage({
            channel: ch, to, subject, body,
            entityType: e.entityType, entityId: e.entityId,
            templateId: step.templateId ?? undefined,
            sentByName: "Automated reminder",
            dedupeKey: `${e.id}:${step.id}:${ch}`,
            // Automated reminders show the company name and reply to the company
            // (not an individual user), and use the branded email shell.
            fromName: brand?.name || undefined,
            replyTo: ch === "EMAIL" ? (brand?.email || undefined) : undefined,
            brand: ch === "EMAIL" ? (ec.context.company as EmailBrand) : undefined,
          });
          sent++;
        }
      }

      // Advance to the next step.
      const nextStep = e.currentStep + 1;
      const nextRunAt = nextStep < steps.length ? addDays(e.anchorDate ?? now, steps[nextStep].offsetDays) : null;
      await prisma.cadenceEnrollment.update({
        where: { id: e.id },
        data: { currentStep: nextStep, nextRunAt, status: nextStep < steps.length ? "active" : "done" },
      });
      advanced++;
    } catch (err) {
      console.error("[cadence] enrollment failed:", e.id, err);
    }
  }

  return { sent, advanced, stopped };
}
