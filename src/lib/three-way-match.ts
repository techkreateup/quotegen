// 3-way match (Track A A4) — reconciles a Purchase Order against its GRNs and
// Vendor Bills. For each line item, compares ordered vs received vs billed
// (qty × rate) and flags any variance beyond the company's `matchTolerancePct`.
// The output feeds the /purchase-orders/[id]/reconcile view and the "Raise
// Debit Note for variance" one-click action.

import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

export interface MatchLine {
  itemName: string;
  hsnSac: string;
  gstRate: number;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  poRate: number;
  billRate: number;
  orderedValue: number;
  receivedValue: number;
  billedValue: number;
  qtyVariancePct: number;   // (billed − received) / ordered × 100
  rateVariancePct: number;  // (bill − PO) / PO × 100
  flag: null | "short_supply" | "over_bill" | "rate_variance";
}

export interface MatchReport {
  purchaseOrderId: string;
  purchaseOrderNo: string;
  tolerancePct: number;
  totals: {
    ordered: number; received: number; billed: number; debitNoted: number;
    payable: number; // billed − debitNoted
  };
  lines: MatchLine[];
  flaggedCount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── pure core (unit-testable, no prisma) ────────────────────────────────────
export interface PoLineIn { id: string; itemName: string; hsnSac: string; gstRate: number; quantity: number; rate: number }
export interface RecvLineIn { itemName: string; quantity: number; poLineItemId?: string | null }
export interface BillLineIn { itemName: string; quantity: number; rate: number; amount: number; poLineItemId?: string | null }

export function computeMatchLines(
  poItems: PoLineIn[],
  grnItems: RecvLineIn[],
  billItems: BillLineIn[],
  tolerancePct: number,
): MatchLine[] {
  // Key by originating PO line id when stamped (robust to renames); fall back
  // to normalized itemName for legacy/manual lines.
  const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const keyOf = (l: { poLineItemId?: string | null; itemName: string }) =>
    l.poLineItemId ?? `name:${nameKey(l.itemName)}`;

  const received = new Map<string, number>();
  for (const it of grnItems) {
    const k = keyOf(it);
    received.set(k, (received.get(k) ?? 0) + it.quantity);
  }
  const billed = new Map<string, { qty: number; value: number; rateSum: number; n: number }>();
  for (const it of billItems) {
    const k = keyOf(it);
    const cur = billed.get(k) ?? { qty: 0, value: 0, rateSum: 0, n: 0 };
    cur.qty += it.quantity; cur.value += it.amount; cur.rateSum += it.rate; cur.n += 1;
    billed.set(k, cur);
  }

  return poItems.map((it) => {
    // A PO line's counterparts may be keyed by id (new) or name (legacy) — merge both.
    const nk = `name:${nameKey(it.itemName)}`;
    const recv = (received.get(it.id) ?? 0) + (received.get(nk) ?? 0);
    const bId = billed.get(it.id); const bName = billed.get(nk);
    const bill = bId || bName
      ? {
          qty: (bId?.qty ?? 0) + (bName?.qty ?? 0),
          rateSum: (bId?.rateSum ?? 0) + (bName?.rateSum ?? 0),
          n: (bId?.n ?? 0) + (bName?.n ?? 0),
        }
      : null;
    const billedQty = bill?.qty ?? 0;
    const billRate = bill && bill.n > 0 ? bill.rateSum / bill.n : it.rate;
    const orderedValue = round2(it.quantity * it.rate);
    const receivedValue = round2(recv * it.rate);
    const billedValue = round2(billedQty * billRate);
    const qtyVariancePct = it.quantity > 0 ? round2(((billedQty - recv) / it.quantity) * 100) : 0;
    const rateVariancePct = it.rate > 0 ? round2(((billRate - it.rate) / it.rate) * 100) : 0;
    let flag: MatchLine["flag"] = null;
    if (recv > 0 && billedQty > recv * (1 + tolerancePct / 100)) flag = "over_bill";
    else if (recv > 0 && billedQty < recv * (1 - tolerancePct / 100)) flag = "short_supply";
    else if (Math.abs(rateVariancePct) > tolerancePct) flag = "rate_variance";
    return {
      itemName: it.itemName, hsnSac: it.hsnSac, gstRate: it.gstRate,
      orderedQty: it.quantity, receivedQty: recv, billedQty,
      poRate: it.rate, billRate: round2(billRate),
      orderedValue, receivedValue, billedValue,
      qtyVariancePct, rateVariancePct, flag,
    };
  });
}

export async function threeWayMatch(purchaseOrderId: string): Promise<MatchReport> {
  const companyId = requireCompanyId();

  const [po, grns, bills, dnRows] = await Promise.all([
    prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.goodsReceiptNote.findMany({
      where: { purchaseOrderId },
      include: { items: true },
    }),
    prisma.purchaseBill.findMany({
      where: { purchaseOrderId },
      include: { items: true, debitNotes: { select: { totalAmount: true, status: true } } },
    }),
    // If ever we allow DebitNote to reference a PO directly this widens easily.
    Promise.resolve([]),
  ]);
  if (!po) throw new Error("Purchase order not found");
  void dnRows;

  const settings = await prisma.companySettings.findUnique({ where: { companyId }, select: { matchTolerancePct: true } });
  const tolerancePct = settings?.matchTolerancePct ?? 5;

  const lines: MatchLine[] = computeMatchLines(
    po.items,
    grns.flatMap((g) => g.items),
    bills.flatMap((b) => b.items),
    tolerancePct,
  );

  const orderedTotal = round2(lines.reduce((s, l) => s + l.orderedValue, 0));
  const receivedTotal = round2(lines.reduce((s, l) => s + l.receivedValue, 0));
  const billedTotal = round2(bills.reduce((s, b) => s + b.totalAmount, 0));
  const debitNoted = round2(bills.reduce((s, b) => s + b.debitNotes.filter(d => d.status !== "Cancelled").reduce((x, d) => x + d.totalAmount, 0), 0));

  return {
    purchaseOrderId, purchaseOrderNo: po.purchaseOrderNo, tolerancePct,
    totals: {
      ordered: orderedTotal, received: receivedTotal, billed: billedTotal, debitNoted,
      payable: round2(billedTotal - debitNoted),
    },
    lines,
    flaggedCount: lines.filter(l => l.flag).length,
  };
}
