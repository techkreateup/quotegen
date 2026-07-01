// Document "Convert" engine (Track 0.1) — the UX every competitor has: turn an
// accepted quote into a Sales Order, an SO into a Delivery Challan, and any of
// them into a tax Invoice, carrying the line items + totals and linking the
// source document. One place owns the field mapping, number-series selection and
// source-status transition so every sell-side conversion behaves identically.
//
// Sell-side chain: Quotation → SalesOrder → DeliveryChallan → Invoice
// (plus the shortcuts Quotation→Invoice and SalesOrder→Invoice).

import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber, type DocCounter } from "@/lib/numbering";
import { sanitizeLineItems } from "@/lib/line-items";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type ConvertableType = "quotation" | "salesOrder" | "deliveryChallan" | "invoice";

// Financial/content fields shared by every transactional document. Carried as-is
// from source to target so the converted doc opens pre-filled and identical.
const CARRY_FIELDS = [
  "subtotal", "totalDiscount", "totalCgst", "totalSgst", "totalIgst",
  "additionalCharges", "additionalChargesLabel", "roundOff", "totalAmount",
  "currency", "exchangeRate", "notes", "termsAndConditions",
] as const;

// Prisma delegate name + the createdAt/items include for each source type.
const DELEGATE: Record<ConvertableType, string> = {
  quotation: "quotation",
  salesOrder: "salesOrder",
  deliveryChallan: "deliveryChallan",
  invoice: "invoice",
};

// Allowed conversions and how each target is shaped.
const ALLOWED: Record<ConvertableType, ConvertableType[]> = {
  quotation: ["salesOrder", "invoice"],
  salesOrder: ["deliveryChallan", "invoice"],
  deliveryChallan: ["invoice"],
  invoice: [],
};

function carry(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of CARRY_FIELDS) if (source[f] !== undefined && source[f] !== null) out[f] = source[f];
  return out;
}

/**
 * Convert one sell-side document into the next in the chain. Runs in a single
 * transaction: claims the target's number series (self-healing), creates the
 * target with carried line items + a link back to the source, and advances the
 * source's status. Returns the created target document (with items).
 *
 * Must run inside tenant context (companyId is stamped by the scoped client).
 */
export async function convertDocument(opts: {
  fromType: ConvertableType;
  fromId: string;
  toType: ConvertableType;
}): Promise<{ id: string; number: string }> {
  const { fromType, fromId, toType } = opts;
  if (!ALLOWED[fromType]?.includes(toType)) {
    throw new ConvertError(`Cannot convert ${fromType} → ${toType}`);
  }
  const companyId = requireCompanyId();

  return prisma.$transaction(async (tx) => {
    const srcDelegate = (tx as unknown as Record<string, { findFirst: (a: unknown) => Promise<Record<string, unknown> | null> }>)[DELEGATE[fromType]];
    const source = await srcDelegate.findFirst({
      where: { id: fromId },
      // include items + client (client.gstin drives GST/non-GST invoice series)
      ...({ include: { items: { orderBy: { sortOrder: "asc" } }, client: { select: { gstin: true } } } } as object),
    });
    if (!source) throw new ConvertError(`${fromType} not found`, 404);

    const base: Record<string, unknown> = {
      clientId: source.clientId,
      ...carry(source),
      items: { create: sanitizeLineItems(source.items) },
    };

    let createdId: string;
    let number: string;

    if (toType === "salesOrder") {
      const no = (await nextDocNumber(tx, "nextSalesOrderNo")).formatted;
      const so = await tx.salesOrder.create({
        data: { ...base, salesOrderNo: no, orderDate: new Date(), quotationId: fromType === "quotation" ? fromId : null, status: "Open" } as never,
        select: { id: true },
      });
      createdId = so.id; number = no;
    } else if (toType === "deliveryChallan") {
      const no = (await nextDocNumber(tx, "nextChallanNo")).formatted;
      const dc = await tx.deliveryChallan.create({
        data: { ...base, challanNo: no, challanDate: new Date(), salesOrderId: fromType === "salesOrder" ? fromId : null, status: "Issued" } as never,
        select: { id: true },
      });
      createdId = dc.id; number = no;
    } else {
      // invoice — pick GST vs non-GST series exactly like POST /api/invoices.
      let counter: DocCounter = "nextInvoiceNo";
      const cfg = await tx.companySettings.findUnique({ where: { companyId }, select: { separateGstInvoices: true } });
      if (cfg?.separateGstInvoices) {
        const gstin = (source.client as { gstin?: string } | null)?.gstin;
        if (!gstin?.trim()) counter = "nextNonGstInvoiceNo";
      }
      const no = (await nextDocNumber(tx, counter)).formatted;
      const inv = await tx.invoice.create({
        data: {
          ...base,
          invoiceNo: no,
          invoiceDate: new Date(),
          status: "Unpaid",
          quotationId: fromType === "quotation" ? fromId : null,
          salesOrderId: fromType === "salesOrder" ? fromId : null,
          deliveryChallanId: fromType === "deliveryChallan" ? fromId : null,
        } as never,
        select: { id: true },
      });
      createdId = inv.id; number = no;
    }

    // Advance the source's lifecycle to reflect the conversion.
    await advanceSourceStatus(tx, fromType, fromId, toType);

    return { id: createdId, number };
  });
}

async function advanceSourceStatus(tx: Tx, fromType: ConvertableType, fromId: string, toType: ConvertableType) {
  try {
    if (fromType === "quotation") {
      await tx.quotation.update({ where: { id: fromId }, data: { status: "Won" } });
    } else if (fromType === "salesOrder") {
      await tx.salesOrder.update({
        where: { id: fromId },
        data: { status: toType === "invoice" ? "Invoiced" : "Delivered" },
      });
    } else if (fromType === "deliveryChallan") {
      await tx.deliveryChallan.update({ where: { id: fromId }, data: { status: "Invoiced" } });
    }
  } catch {
    // Status is advisory — never fail the conversion if the source row moved.
  }
}

/**
 * Buy-side convert: Purchase Order → Vendor Bill (PurchaseBill). Kept separate
 * from convertDocument because PurchaseBillItem has a different (leaner) column
 * set than the sell-side line items. The vendor's real bill number isn't known at
 * convert time, so billNo defaults to the PO number for the user to correct when
 * the vendor's invoice arrives. Advances the PO to "Billed".
 */
export async function convertPoToBill(poId: string): Promise<{ id: string; billNo: string }> {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!po) throw new ConvertError("Purchase order not found", 404);

    const items = po.items.map((it) => ({
      itemName: it.itemName,
      hsnSac: it.hsnSac,
      gstRate: it.gstRate,
      quantity: it.quantity,
      rate: it.rate,
      amount: it.amount,
      cgst: it.cgst,
      sgst: it.sgst,
      igst: it.igst,
      total: it.total,
    }));

    const bill = await tx.purchaseBill.create({
      data: {
        companyId: po.companyId,
        billNo: po.purchaseOrderNo, // placeholder — user replaces with vendor's bill no
        billDate: new Date(),
        vendorId: po.vendorId,
        description: `From ${po.purchaseOrderNo}`,
        subtotal: po.subtotal,
        totalCgst: po.totalCgst,
        totalSgst: po.totalSgst,
        totalIgst: po.totalIgst,
        totalAmount: po.totalAmount,
        status: "Recorded",
        purchaseOrderId: po.id,
        items: { create: items },
      } as never,
      select: { id: true, billNo: true },
    });

    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "Billed" } }).catch(() => {});
    return bill;
  });
}

/**
 * Buy-side convert: Purchase Order → Goods Receipt Note (receive the ordered
 * goods). Carries each PO line with orderedQty + received quantity defaulting to
 * the full ordered amount; the user edits quantities on the GRN for a partial
 * receipt. Advances the PO to "Received".
 */
export async function convertPoToGrn(poId: string): Promise<{ id: string; grnNo: string }> {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: poId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!po) throw new ConvertError("Purchase order not found", 404);

    const items = po.items.map((it, i) => ({
      itemName: it.itemName, description: it.description, hsnSac: it.hsnSac, gstRate: it.gstRate,
      orderedQty: it.quantity, rejectedQty: 0, quantity: it.quantity,
      rate: it.rate, discountType: it.discountType, discountValue: it.discountValue, discountAmount: it.discountAmount,
      amount: it.amount, cgst: it.cgst, sgst: it.sgst, igst: it.igst, total: it.total, sortOrder: i,
    }));

    const grnNo = (await nextDocNumber(tx, "nextGrnNo")).formatted;
    const grn = await tx.goodsReceiptNote.create({
      data: {
        companyId: po.companyId,
        grnNo,
        receiptDate: new Date(),
        vendorId: po.vendorId,
        purchaseOrderId: po.id,
        subtotal: po.subtotal,
        totalCgst: po.totalCgst,
        totalSgst: po.totalSgst,
        totalIgst: po.totalIgst,
        totalAmount: po.totalAmount,
        status: "Posted",
        items: { create: items },
      } as never,
      select: { id: true, grnNo: true },
    });

    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "Received" } }).catch(() => {});
    return grn;
  });
}

/**
 * Buy-side convert: Vendor Bill (PurchaseBill) → Debit Note. Carries the bill's
 * line items so the user can trim quantities/rates to the disputed portion
 * (short supply / rate variance / return). Reason defaults to "Short Supply".
 */
export async function convertBillToDebitNote(billId: string, reason = "Short Supply"): Promise<{ id: string; debitNoteNo: string }> {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.purchaseBill.findFirst({
      where: { id: billId },
      include: { items: true },
    });
    if (!bill) throw new ConvertError("Vendor bill not found", 404);

    const items = bill.items.map((it, i) => ({
      itemName: it.itemName, hsnSac: it.hsnSac, gstRate: it.gstRate,
      quantity: it.quantity, rate: it.rate, amount: it.amount,
      cgst: it.cgst, sgst: it.sgst, igst: it.igst, total: it.total, sortOrder: i,
    }));

    const dnNo = (await nextDocNumber(tx, "nextDebitNoteNo")).formatted;
    const dn = await tx.debitNote.create({
      data: {
        companyId: bill.companyId,
        debitNoteNo: dnNo,
        debitNoteDate: new Date(),
        vendorId: bill.vendorId,
        purchaseBillId: bill.id,
        reason,
        subtotal: bill.subtotal,
        totalCgst: bill.totalCgst,
        totalSgst: bill.totalSgst,
        totalIgst: bill.totalIgst,
        totalAmount: bill.totalAmount,
        status: "Draft",
        items: { create: items },
      } as never,
      select: { id: true, debitNoteNo: true },
    });
    return dn;
  });
}

export class ConvertError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ConvertError";
    this.status = status;
  }
}
