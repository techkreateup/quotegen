// ─── Inventory ledger (Tier 2) ───────────────────────────────────────────────
// Append-only signed StockMovement rows per tracked CatalogItem.
// GRN posting = stock in (+), Delivery Challan = stock out (−), manual
// adjustments via /api/inventory. Invoices do NOT move stock — goods leave on
// the challan. Lines are linked to catalog items by exact (case-insensitive)
// name; untracked or unmatched lines are silently skipped so documents with
// free-text lines keep working.

import type prismaDefault from "@/lib/db";

type Tx = Parameters<Parameters<typeof prismaDefault.$transaction>[0]>[0];

export interface StockLine { itemName: string; quantity: number }

/**
 * Post movements for a document's lines inside the SAME transaction that
 * created the document. `direction` +1 receives stock, −1 issues it.
 * Idempotent per (refType, refId): a re-run posts nothing.
 */
export async function postStockMovements(
  tx: Tx,
  args: {
    companyId: string;
    kind: "grn_in" | "challan_out";
    refType: "GoodsReceiptNote" | "DeliveryChallan";
    refId: string;
    refNo: string;
    lines: StockLine[];
    direction: 1 | -1;
    userId?: string;
  }
): Promise<number> {
  const existing = await tx.stockMovement.findFirst({
    where: { refType: args.refType, refId: args.refId }, select: { id: true },
  });
  if (existing) return 0;

  const tracked = await tx.catalogItem.findMany({
    where: { trackStock: true, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });
  if (tracked.length === 0) return 0;
  const byName = new Map(tracked.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const rows = args.lines
    .map((l) => ({ catalogItemId: byName.get(l.itemName.trim().toLowerCase()), qty: l.quantity }))
    .filter((r): r is { catalogItemId: string; qty: number } => !!r.catalogItemId && r.qty > 0)
    .map((r) => ({
      companyId: args.companyId,
      catalogItemId: r.catalogItemId,
      qty: args.direction * r.qty,
      kind: args.kind,
      refType: args.refType,
      refId: args.refId,
      refNo: args.refNo,
      createdById: args.userId ?? "",
    }));
  if (rows.length === 0) return 0;
  await tx.stockMovement.createMany({ data: rows });
  return rows.length;
}

/** Remove a document's ledger rows (soft-delete of the GRN/challan, or before a
 *  repost when its lines were edited). */
export async function removeStockMovements(tx: Tx, refType: "GoodsReceiptNote" | "DeliveryChallan", refId: string): Promise<void> {
  await tx.stockMovement.deleteMany({ where: { refType, refId } });
}

/** Re-derive a document's ledger rows from its CURRENT lines: remove + post.
 *  Used after a PUT that replaced items and after a recycle-bin restore. */
export async function repostStockForDoc(tx: Tx, refType: "GoodsReceiptNote" | "DeliveryChallan", refId: string): Promise<void> {
  await removeStockMovements(tx, refType, refId);
  if (refType === "GoodsReceiptNote") {
    const grn = await tx.goodsReceiptNote.findFirst({ where: { id: refId, deletedAt: null }, include: { items: true } });
    if (!grn) return;
    await postStockMovements(tx, {
      companyId: grn.companyId, kind: "grn_in", refType, refId, refNo: grn.grnNo,
      lines: grn.items.map((it) => ({ itemName: it.itemName, quantity: it.quantity })), direction: 1,
    });
  } else {
    const dc = await tx.deliveryChallan.findFirst({ where: { id: refId, deletedAt: null }, include: { items: true } });
    if (!dc) return;
    await postStockMovements(tx, {
      companyId: dc.companyId, kind: "challan_out", refType, refId, refNo: dc.challanNo,
      lines: dc.items.map((it) => ({ itemName: it.itemName, quantity: it.quantity })), direction: -1,
    });
  }
}

export interface StockLevel {
  catalogItemId: string; name: string; unit: string;
  lowStockThreshold: number; onHand: number; low: boolean;
}

/** Current stock per tracked item (Σ signed movements). Tenant-scoped by the prisma extension. */
export async function getStockLevels(prisma: Tx): Promise<StockLevel[]> {
  const items = await prisma.catalogItem.findMany({
    where: { trackStock: true, deletedAt: null },
    select: { id: true, name: true, unit: true, lowStockThreshold: true },
    orderBy: { name: "asc" },
  });
  if (items.length === 0) return [];
  const sums = await prisma.stockMovement.groupBy({
    by: ["catalogItemId"],
    where: { catalogItemId: { in: items.map((i) => i.id) } },
    _sum: { qty: true },
  });
  const byId = new Map(sums.map((s) => [s.catalogItemId, s._sum.qty ?? 0]));
  return items.map((i) => {
    const onHand = Math.round(((byId.get(i.id) ?? 0) + Number.EPSILON) * 100) / 100;
    return {
      catalogItemId: i.id, name: i.name, unit: i.unit,
      lowStockThreshold: i.lowStockThreshold, onHand,
      low: i.lowStockThreshold > 0 && onHand <= i.lowStockThreshold,
    };
  });
}
