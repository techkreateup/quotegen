// Document lineage (Track D traceability). Given any sell-side document, returns
// the connected documents up-stream (where it came from) and down-stream (what it
// produced), so every view can render the full chain
// Quotation → Sales Order → Delivery Challan → Invoice and never dead-ends.
//
// Runs inside tenant context (scoped prisma) — call only from withApi handlers.

import prisma from "@/lib/db";

export type DocKind = "quotation" | "salesOrder" | "deliveryChallan" | "invoice" | "purchaseOrder" | "goodsReceiptNote" | "purchaseBill" | "debitNote";

export interface RelatedDoc {
  kind: DocKind;
  label: string;   // "Quotation", "Sales Order", …
  no: string;      // document number
  href: string;    // view link
  status: string;
}

export interface Lineage {
  source: RelatedDoc[];   // documents this one was created from (up-stream)
  children: RelatedDoc[]; // documents created from this one (down-stream)
}

const HREF: Record<DocKind, string> = {
  quotation: "/quotations/view?id=",
  salesOrder: "/sales-orders/view?id=",
  deliveryChallan: "/delivery-challans/view?id=",
  invoice: "/invoices/view?id=",
  purchaseOrder: "/purchase-orders/view?id=",
  goodsReceiptNote: "/goods-receipts/view?id=",
  purchaseBill: "/purchase-bills#",
  debitNote: "/debit-notes/view?id=",
};
const LABEL: Record<DocKind, string> = {
  quotation: "Quotation",
  salesOrder: "Sales Order",
  deliveryChallan: "Delivery Challan",
  invoice: "Invoice",
  purchaseOrder: "Purchase Order",
  goodsReceiptNote: "Goods Receipt",
  purchaseBill: "Vendor Bill",
  debitNote: "Debit Note",
};

function rel(kind: DocKind, r: { id: string; no: string; status: string } | null | undefined): RelatedDoc | null {
  if (!r) return null;
  return { kind, label: LABEL[kind], no: r.no, href: `${HREF[kind]}${r.id}`, status: r.status };
}

export async function buildLineage(kind: DocKind, id: string): Promise<Lineage> {
  const source: RelatedDoc[] = [];
  const children: RelatedDoc[] = [];
  const push = (arr: RelatedDoc[], v: RelatedDoc | null) => { if (v) arr.push(v); };

  if (kind === "quotation") {
    const [sos, invs] = await Promise.all([
      prisma.salesOrder.findMany({ where: { quotationId: id }, select: { id: true, salesOrderNo: true, status: true } }),
      prisma.invoice.findMany({ where: { quotationId: id }, select: { id: true, invoiceNo: true, status: true } }),
    ]);
    sos.forEach(s => push(children, rel("salesOrder", { id: s.id, no: s.salesOrderNo, status: s.status })));
    invs.forEach(i => push(children, rel("invoice", { id: i.id, no: i.invoiceNo, status: i.status })));
  } else if (kind === "salesOrder") {
    const so = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        quotation: { select: { id: true, quotationNo: true, status: true } },
        challans: { select: { id: true, challanNo: true, status: true } },
        invoices: { select: { id: true, invoiceNo: true, status: true } },
      },
    });
    push(source, rel("quotation", so?.quotation ? { id: so.quotation.id, no: so.quotation.quotationNo, status: so.quotation.status } : null));
    so?.challans.forEach(c => push(children, rel("deliveryChallan", { id: c.id, no: c.challanNo, status: c.status })));
    so?.invoices.forEach(i => push(children, rel("invoice", { id: i.id, no: i.invoiceNo, status: i.status })));
  } else if (kind === "deliveryChallan") {
    const dc = await prisma.deliveryChallan.findUnique({
      where: { id },
      select: {
        salesOrder: { select: { id: true, salesOrderNo: true, status: true } },
        invoices: { select: { id: true, invoiceNo: true, status: true } },
      },
    });
    push(source, rel("salesOrder", dc?.salesOrder ? { id: dc.salesOrder.id, no: dc.salesOrder.salesOrderNo, status: dc.salesOrder.status } : null));
    dc?.invoices.forEach(i => push(children, rel("invoice", { id: i.id, no: i.invoiceNo, status: i.status })));
  } else if (kind === "purchaseOrder") {
    const [grns, bills] = await Promise.all([
      prisma.goodsReceiptNote.findMany({ where: { purchaseOrderId: id }, select: { id: true, grnNo: true, status: true } }),
      prisma.purchaseBill.findMany({ where: { purchaseOrderId: id }, select: { id: true, billNo: true, status: true } }),
    ]);
    grns.forEach(g => push(children, rel("goodsReceiptNote", { id: g.id, no: g.grnNo, status: g.status })));
    bills.forEach(b => push(children, { kind: "purchaseBill", label: LABEL.purchaseBill, no: b.billNo, href: HREF.purchaseBill, status: b.status }));
  } else if (kind === "goodsReceiptNote") {
    const grn = await prisma.goodsReceiptNote.findUnique({
      where: { id },
      select: { purchaseOrder: { select: { id: true, purchaseOrderNo: true, status: true } } },
    });
    push(source, rel("purchaseOrder", grn?.purchaseOrder ? { id: grn.purchaseOrder.id, no: grn.purchaseOrder.purchaseOrderNo, status: grn.purchaseOrder.status } : null));
  } else if (kind === "debitNote") {
    const dn = await prisma.debitNote.findUnique({
      where: { id },
      select: { purchaseBill: { select: { id: true, billNo: true, status: true } } },
    });
    if (dn?.purchaseBill) push(source, { kind: "purchaseBill", label: LABEL.purchaseBill, no: dn.purchaseBill.billNo, href: HREF.purchaseBill, status: dn.purchaseBill.status });
  } else if (kind === "invoice") {
    const inv = await prisma.invoice.findUnique({
      where: { id },
      select: {
        quotation: { select: { id: true, quotationNo: true, status: true } },
        salesOrder: { select: { id: true, salesOrderNo: true, status: true } },
        deliveryChallan: { select: { id: true, challanNo: true, status: true } },
      },
    });
    push(source, rel("quotation", inv?.quotation ? { id: inv.quotation.id, no: inv.quotation.quotationNo, status: inv.quotation.status } : null));
    push(source, rel("salesOrder", inv?.salesOrder ? { id: inv.salesOrder.id, no: inv.salesOrder.salesOrderNo, status: inv.salesOrder.status } : null));
    push(source, rel("deliveryChallan", inv?.deliveryChallan ? { id: inv.deliveryChallan.id, no: inv.deliveryChallan.challanNo, status: inv.deliveryChallan.status } : null));
  }

  return { source, children };
}
