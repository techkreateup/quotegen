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
  defaultCc?: string;     // per-client default CC (comma-separated)
  defaultBcc?: string;    // per-client default BCC
  label: string;          // e.g. "Invoice INV-0042"
  pdfElementId?: string;  // DOM id the view page renders for PDF attachment
}

export interface CompanyBlock {
  name: string; email: string; phone: string;
  logoUrl: string; address: string; gstin: string; website: string; themeColor: string;
}

async function companyBlock(): Promise<CompanyBlock> {
  const s = await prisma.companySettings.findFirst();
  const addr = [s?.address, s?.city, s?.state, s?.pincode].filter(Boolean).join(", ");
  // Email clients block data: URIs in <img>. If the logo is a data URI, point it
  // at our public hosted-logo route so it renders inline as a normal image.
  const rawLogo = s?.logoUrl || "";
  const logoUrl = rawLogo.startsWith("data:") && s?.companyId
    ? `${APP}/api/public/company-logo?c=${s.companyId}`
    : rawLogo;
  return {
    name: s?.businessName || "",
    email: s?.email || "",
    phone: s?.phones?.[0] || "",
    logoUrl,
    address: addr,
    gstin: s?.gstin || "",
    website: s?.website || "",
    themeColor: s?.themeColor || "#4F46E5",
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
        defaultCc: inv.client.defaultCc,
        defaultBcc: inv.client.defaultBcc,
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
        defaultCc: q.client.defaultCc,
        defaultBcc: q.client.defaultBcc,
        label: `Quotation ${q.quotationNo}`,
        pdfElementId: "quotation-pdf",
      };
    }

    case "purchaseBill": {
      const b = await prisma.purchaseBill.findUnique({
        where: { id: entityId },
        include: { vendor: true },
      });
      if (!b) return null;
      const paid = await prisma.vendorPayment.aggregate({ _sum: { amount: true }, where: { vendorId: b.vendorId } });
      // Approx per-bill balance: total minus this vendor's paid pool (no per-bill
      // allocation exists yet). stopOnPaid still fires once the pool covers the total.
      const paidSum = paid._sum.amount ?? 0;
      const balance = Math.max(0, b.totalAmount - Math.min(paidSum, b.totalAmount));
      const due = b.dueDate ?? new Date(new Date(b.billDate).getTime() + 30 * 86400_000);
      return {
        context: {
          currency: "INR",
          company,
          vendor: { name: b.vendor.name, email: b.vendor.email, phone: b.vendor.phone || "" },
          bill: {
            number: b.billNo,
            total: b.totalAmount,
            balance,
            dueDate: due.toISOString().split("T")[0],
          },
          link: `${APP}/purchase-bills`,
        },
        defaultEmail: b.vendor.email,
        defaultPhone: b.vendor.phone || "",
        label: `Vendor Bill ${b.billNo}`,
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
        defaultCc: client?.defaultCc,
        defaultBcc: client?.defaultBcc,
        label: `Receipt ${r.receiptNo}`,
        pdfElementId: "receipt-pdf",
      };
    }

    default:
      return null;
  }
}
