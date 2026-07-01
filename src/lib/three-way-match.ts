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

  // Aggregate GRN + Bill quantities per item name (simple match key).
  const receivedByName = new Map<string, { qty: number }>();
  for (const g of grns) for (const it of g.items) {
    const k = it.itemName.trim().toLowerCase();
    const cur = receivedByName.get(k) ?? { qty: 0 };
    cur.qty += it.quantity;
    receivedByName.set(k, cur);
  }
  const billedByName = new Map<string, { qty: number; value: number; rateSum: number; n: number }>();
  for (const b of bills) for (const it of b.items) {
    const k = it.itemName.trim().toLowerCase();
    const cur = billedByName.get(k) ?? { qty: 0, value: 0, rateSum: 0, n: 0 };
    cur.qty += it.quantity;
    cur.value += it.amount;
    cur.rateSum += it.rate;
    cur.n += 1;
    billedByName.set(k, cur);
  }

  const lines: MatchLine[] = po.items.map((it) => {
    const k = it.itemName.trim().toLowerCase();
    const received = receivedByName.get(k)?.qty ?? 0;
    const bill = billedByName.get(k);
    const billedQty = bill?.qty ?? 0;
    const billRate = bill && bill.n > 0 ? bill.rateSum / bill.n : it.rate;
    const orderedValue = round2(it.quantity * it.rate);
    const receivedValue = round2(received * it.rate);
    const billedValue = round2(billedQty * billRate);
    const qtyVariancePct = it.quantity > 0 ? round2(((billedQty - received) / it.quantity) * 100) : 0;
    const rateVariancePct = it.rate > 0 ? round2(((billRate - it.rate) / it.rate) * 100) : 0;
    let flag: MatchLine["flag"] = null;
    if (received > 0 && billedQty > received * (1 + tolerancePct / 100)) flag = "over_bill";
    else if (received > 0 && billedQty < received * (1 - tolerancePct / 100)) flag = "short_supply";
    else if (Math.abs(rateVariancePct) > tolerancePct) flag = "rate_variance";
    return {
      itemName: it.itemName, hsnSac: it.hsnSac, gstRate: it.gstRate,
      orderedQty: it.quantity, receivedQty: received, billedQty,
      poRate: it.rate, billRate: round2(billRate),
      orderedValue, receivedValue, billedValue,
      qtyVariancePct, rateVariancePct, flag,
    };
  });

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
