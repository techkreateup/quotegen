import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

async function POST_handler(request: NextRequest) {
  const { clients, quotations, invoices, paymentReceipts, settings } = await request.json();
  const companyId = requireCompanyId();
  const results = { clients: 0, quotations: 0, invoices: 0, receipts: 0, settings: false };

  // Migrate settings
  if (settings) {
    const { themeColor, contactFooter, quotationPrefix, invoicePrefix, receiptPrefix,
      nextQuotationNo, nextInvoiceNo, nextReceiptNo, ...rest } = settings;
    await prisma.companySettings.upsert({
      where: { companyId },
      update: { ...rest, themeColor, contactFooter, quotationPrefix, invoicePrefix, receiptPrefix,
        nextQuotationNo, nextInvoiceNo, nextReceiptNo },
      create: { companyId, ...rest, themeColor, contactFooter, quotationPrefix, invoicePrefix,
        receiptPrefix, nextQuotationNo, nextInvoiceNo, nextReceiptNo },
    });
    results.settings = true;
  }

  // Migrate clients
  if (clients?.length) {
    for (const c of clients) {
      const existing = await prisma.client.findUnique({ where: { id: c.id } });
      if (existing) continue;
      const status = c.status === "At Risk" ? "AtRisk" : (c.status || "Active");
      await prisma.client.create({
        data: {
          companyId,
          id: c.id,
          businessName: c.businessName || "",
          industry: c.industry || "",
          country: c.country || "India",
          city: c.city || "",
          phones: c.phones || [],
          email: c.email || "",
          gstin: c.gstin || "",
          pan: c.pan || "",
          status,
          address: c.address || "",
          logoUrl: c.logoUrl || "",
        },
      });
      results.clients++;
    }
  }

  // Migrate quotations
  if (quotations?.length) {
    for (const q of quotations) {
      const existing = await prisma.quotation.findUnique({ where: { id: q.id } });
      if (existing) continue;
      const clientExists = await prisma.client.findUnique({ where: { id: q.clientId } });
      if (!clientExists) continue;
      await prisma.quotation.create({
        data: {
          companyId,
          id: q.id,
          quotationNo: q.quotationNo,
          title: q.title || "Quotation",
          quotationDate: new Date(q.quotationDate),
          dueDate: q.dueDate ? new Date(q.dueDate) : null,
          clientId: q.clientId,
          subtotal: q.subtotal || 0,
          totalDiscount: q.totalDiscount || 0,
          totalCgst: q.totalCgst || 0,
          totalSgst: q.totalSgst || 0,
          additionalCharges: q.additionalCharges || 0,
          additionalChargesLabel: q.additionalChargesLabel || "",
          roundOff: q.roundOff || 0,
          totalAmount: q.totalAmount || 0,
          status: q.status || "Draft",
          notes: q.notes || "",
          termsAndConditions: q.termsAndConditions || "",
          items: {
            create: (q.items || []).map((item: Record<string, unknown>, i: number) => {
              const { id: _id, ...rest } = item;
              return { ...rest, sortOrder: i } as Record<string, unknown>;
            }),
          },
        },
      });
      results.quotations++;
    }
  }

  // Migrate invoices
  if (invoices?.length) {
    for (const inv of invoices) {
      const existing = await prisma.invoice.findUnique({ where: { id: inv.id } });
      if (existing) continue;
      const clientExists = await prisma.client.findUnique({ where: { id: inv.clientId } });
      if (!clientExists) continue;
      const status = inv.status === "Partially Paid" ? "PartiallyPaid" : (inv.status || "Draft");
      await prisma.invoice.create({
        data: {
          companyId,
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          title: inv.title || "Invoice",
          invoiceDate: new Date(inv.invoiceDate),
          dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
          clientId: inv.clientId,
          quotationId: inv.quotationId || null,
          subtotal: inv.subtotal || 0,
          totalDiscount: inv.totalDiscount || 0,
          totalCgst: inv.totalCgst || 0,
          totalSgst: inv.totalSgst || 0,
          additionalCharges: inv.additionalCharges || 0,
          additionalChargesLabel: inv.additionalChargesLabel || "",
          roundOff: inv.roundOff || 0,
          totalAmount: inv.totalAmount || 0,
          status,
          paymentDate: inv.paymentDate ? new Date(inv.paymentDate) : null,
          notes: inv.notes || "",
          termsAndConditions: inv.termsAndConditions || "",
          items: {
            create: (inv.items || []).map((item: Record<string, unknown>, i: number) => {
              const { id: _id, ...rest } = item;
              return { ...rest, sortOrder: i } as Record<string, unknown>;
            }),
          },
        },
      });
      results.invoices++;
    }
  }

  // Migrate payment receipts
  if (paymentReceipts?.length) {
    for (const r of paymentReceipts) {
      const existing = await prisma.paymentReceipt.findUnique({ where: { id: r.id } });
      if (existing) continue;
      const invoiceExists = await prisma.invoice.findUnique({ where: { id: r.invoiceId } });
      const clientExists = await prisma.client.findUnique({ where: { id: r.clientId } });
      if (!invoiceExists || !clientExists) continue;
      await prisma.paymentReceipt.create({
        data: {
          companyId,
          id: r.id,
          receiptNo: r.receiptNo,
          receiptDate: new Date(r.receiptDate),
          invoiceId: r.invoiceId,
          clientId: r.clientId,
          amount: r.amount || 0,
          paymentMethod: r.paymentMethod || "",
          referenceNo: r.referenceNo || "",
          status: r.status || "Settled",
          notes: r.notes || "",
        },
      });
      results.receipts++;
    }
  }

  return NextResponse.json({ success: true, imported: results });
}

export const POST = withApi(POST_handler);
