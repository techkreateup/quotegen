// ─── Soft-delete recycle bin ─────────────────────────────────────────────────
// Central config + helpers for the six tenant models that go through the
// recycle bin. Every DELETE endpoint for one of these types now sets
// deletedAt/By instead of hard-deleting; the recycle-bin page + API surface
// them, restore clears the flags and stamps restoredAt/By so a delete-then-
// restore sequence stays visible in the audit log (fraud trail per user req).
// Purge cron hard-deletes anything older than RETENTION_DAYS after deletion.

import prisma from "@/lib/db";

export const RETENTION_DAYS = 30;

// Recycle-bin models — keep this list narrow. New models get added case-by-case
// so we don't accidentally soft-delete something the app expects to hard-delete
// (line items, audit rows, message logs, etc.).
export const RECYCLABLE = ["Client", "Quotation", "Invoice", "Vendor", "Employee", "PurchaseBill"] as const;
export type RecyclableModel = (typeof RECYCLABLE)[number];

// Human labels for the UI.
export const MODEL_LABEL: Record<RecyclableModel, string> = {
  Client: "Client",
  Quotation: "Quotation",
  Invoice: "Invoice",
  Vendor: "Vendor",
  Employee: "Employee",
  PurchaseBill: "Vendor Bill",
};

// Map to the primary display field on each model so the recycle-bin can render
// a name/no without a per-row shape hack.
type PrimaryFieldFn = (row: Record<string, unknown>) => string;
export const PRIMARY_FIELD: Record<RecyclableModel, PrimaryFieldFn> = {
  Client: (r) => String(r.businessName ?? ""),
  Quotation: (r) => String(r.quotationNo ?? ""),
  Invoice: (r) => String(r.invoiceNo ?? ""),
  Vendor: (r) => String(r.name ?? ""),
  Employee: (r) => String(r.name ?? ""),
  PurchaseBill: (r) => String(r.billNo ?? ""),
};

export const HREF_FIELD: Record<RecyclableModel, (id: string) => string> = {
  Client: (id) => `/clients/view?id=${id}`,
  Quotation: (id) => `/quotations/view?id=${id}`,
  Invoice: (id) => `/invoices/view?id=${id}`,
  Vendor: (id) => `/vendors/view?id=${id}`,
  Employee: (id) => `/employees`,
  PurchaseBill: () => `/purchase-bills`,
};

/** Return the scoped delegate for a recyclable model. */
function delegate(model: RecyclableModel) {
  const map: Record<RecyclableModel, unknown> = {
    Client: prisma.client,
    Quotation: prisma.quotation,
    Invoice: prisma.invoice,
    Vendor: prisma.vendor,
    Employee: prisma.employee,
    PurchaseBill: prisma.purchaseBill,
  };
  return map[model] as {
    findUnique: (a: unknown) => Promise<Record<string, unknown> | null>;
    findMany: (a: unknown) => Promise<Record<string, unknown>[]>;
    update: (a: unknown) => Promise<Record<string, unknown>>;
    delete: (a: unknown) => Promise<Record<string, unknown>>;
  };
}

export async function softDelete(model: RecyclableModel, id: string, userId: string, userName: string): Promise<void> {
  const d = delegate(model);
  await d.update({
    where: { id },
    // Preserve restoredAt/By intact — the recycle-bin UI surfaces "previously
    // restored on X" as a fraud-audit trail if this row was already restored
    // once before this delete. AuditLog still receives one row per action.
    data: { deletedAt: new Date(), deletedById: userId || null, deletedByName: userName || "" } as never,
  });
}

export async function restoreRow(model: RecyclableModel, id: string, userId: string, userName: string): Promise<Record<string, unknown>> {
  const d = delegate(model);
  return d.update({
    where: { id },
    data: {
      deletedAt: null, deletedById: null, deletedByName: "",
      restoredAt: new Date(), restoredById: userId || null, restoredByName: userName || "",
    } as never,
  });
}

export async function listDeleted(): Promise<Array<{ model: RecyclableModel; id: string; label: string; deletedAt: Date; deletedByName: string; restoredAt: Date | null; restoredByName: string; href: string; }>> {
  const rows: Array<{ model: RecyclableModel; id: string; label: string; deletedAt: Date; deletedByName: string; restoredAt: Date | null; restoredByName: string; href: string }> = [];
  for (const model of RECYCLABLE) {
    const d = delegate(model);
    const found = await d.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 200 });
    for (const r of found) {
      rows.push({
        model,
        id: String(r.id),
        label: PRIMARY_FIELD[model](r) || String(r.id),
        deletedAt: r.deletedAt as Date,
        deletedByName: String(r.deletedByName ?? ""),
        restoredAt: (r.restoredAt as Date | null) ?? null,
        restoredByName: String(r.restoredByName ?? ""),
        href: HREF_FIELD[model](String(r.id)),
      });
    }
  }
  return rows.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

/** Purge rows deleted more than RETENTION_DAYS ago. Runs from the daily cron. */
export async function purgeExpired(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  let purged = 0;
  for (const model of RECYCLABLE) {
    const d = delegate(model);
    const stale = await d.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } as never });
    for (const s of stale) {
      try { await d.delete({ where: { id: String(s.id) } }); purged++; } catch { /* best-effort */ }
    }
  }
  return { purged };
}
