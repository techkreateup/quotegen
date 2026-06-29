// ─── Entity → merge context (Track B / Sprint B3, server-side) ───────────────
// Builds the {{merge}} context for a given document so message templates render
// with real data, plus the default recipient and a viewable link. Uses the
// scoped Prisma client, so a foreign id simply yields null.

import prisma from "@/lib/db";
import type { MergeContext } from "@/lib/merge";

const APP = process.env.APP_URL?.startsWith("http")
  ? process.env.APP_URL
  : "https://quotegen.kreateup.in";

export interface EntityContext {
  context: MergeContext;
  defaultEmail: string;
  defaultPhone: string;
  label: string;          // e.g. "Invoice INV-0042"
  pdfElementId?: string;  // DOM id the view page renders for PDF attachment
}

async function companyBlock() {
  const s = await prisma.companySettings.findFirst();
  return {
    name: s?.businessName || "",
    email: s?.email || "",
    phone: s?.phones?.[0] || "",
  };
}

/** Build the merge context for a supported entity, or null if not found. */
export async function buildEntityContext(
  entityType: string,
  entityId: string
): Promise<EntityContext | null> {
  const company = await companyBlock();

  switch (entityType) {
    case "invoice": {
      const inv = await prisma.invoice.findUnique({
        where: { id: entityId },
        include: { client: true, receipts: true },
      });
      if (!inv) return null;
      const paid = inv.receipts.reduce((s, r) => s + r.amount, 0);
      return {
        context: {
          currency: inv.currency,
          company,
          client: { name: inv.client.businessName, email: inv.client.email, phone: inv.client.phones?.[0] || "" },
          invoice: {
            number: inv.invoiceNo,
            total: inv.totalAmount,
            balance: Math.max(0, inv.totalAmount - paid),
            dueDate: inv.dueDate ?? "",
          },
          link: `${APP}/invoices/view?id=${inv.id}`,
        },
        defaultEmail: inv.client.email,
        defaultPhone: inv.client.phones?.[0] || "",
        label: `Invoice ${inv.invoiceNo}`,
        pdfElementId: "invoice-pdf",
      };
    }

    case "quotation": {
      const q = await prisma.quotation.findUnique({
        where: { id: entityId },
        include: { client: true },
      });
      if (!q) return null;
      return {
        context: {
          currency: q.currency,
          company,
          client: { name: q.client.businessName, email: q.client.email, phone: q.client.phones?.[0] || "" },
          quotation: {
            number: q.quotationNo,
            total: q.totalAmount,
            validTill: q.dueDate ?? "",
          },
          link: `${APP}/quotations/view?id=${q.id}`,
        },
        defaultEmail: q.client.email,
        defaultPhone: q.client.phones?.[0] || "",
        label: `Quotation ${q.quotationNo}`,
        pdfElementId: "quotation-pdf",
      };
    }

    case "receipt": {
      const r = await prisma.paymentReceipt.findUnique({ where: { id: entityId } });
      if (!r) return null;
      const client = await prisma.client.findUnique({ where: { id: r.clientId } });
      return {
        context: {
          currency: "INR",
          company,
          client: { name: client?.businessName || "", email: client?.email || "", phone: client?.phones?.[0] || "" },
          receipt: { number: r.receiptNo, amount: r.amount },
          link: `${APP}/payment-receipts/view?id=${r.id}`,
        },
        defaultEmail: client?.email || "",
        defaultPhone: client?.phones?.[0] || "",
        label: `Receipt ${r.receiptNo}`,
        pdfElementId: "receipt-pdf",
      };
    }

    default:
      return null;
  }
}
