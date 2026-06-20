import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";

/**
 * Auto-create a PaymentReceipt + Transaction when an invoice is marked/created as Paid.
 * Skips if a receipt already exists for the invoice.
 */
export async function autoCreateReceipt(invoiceId: string, paymentMethod = "Bank Transfer") {
  const companyId = requireCompanyId();

  const existing = await prisma.paymentReceipt.findFirst({ where: { invoiceId } });
  if (existing) return existing;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true },
  });
  if (!invoice) return null;

  return prisma.$transaction(async (tx) => {
    const { formatted: receiptNo } = await nextDocNumber(tx, "nextReceiptNo");

    const receipt = await tx.paymentReceipt.create({
      data: {
        companyId,
        receiptNo,
        receiptDate: new Date(),
        invoiceId,
        clientId: invoice.clientId,
        amount: invoice.totalAmount,
        paymentMethod,
        notes: "Auto-generated on payment",
        status: "Settled",
      },
    });

    await tx.transaction.create({
      data: {
        companyId,
        date: new Date(),
        type: "Revenue",
        category: "Revenue",
        description: `Payment received for ${invoice.invoiceNo} from ${invoice.client.businessName}`,
        amount: invoice.totalAmount,
        direction: "IN",
        referenceType: "invoice",
        referenceId: invoiceId,
        invoiceId,
      },
    });

    return receipt;
  });
}
