import { requireCompanyId } from "@/lib/tenant-context";
import type prismaDefault from "@/lib/db";

type Tx = Parameters<Parameters<typeof prismaDefault.$transaction>[0]>[0];

export type DocCounter =
  | "nextQuotationNo"
  | "nextInvoiceNo"
  | "nextReceiptNo"
  | "nextVoucherNo"
  | "nextEmployeeNo"
  | "nextCreditNoteNo";

const PREFIX_FIELD: Record<DocCounter, string | null> = {
  nextQuotationNo: "quotationPrefix",
  nextInvoiceNo: "invoicePrefix",
  nextReceiptNo: "receiptPrefix",
  nextVoucherNo: "voucherPrefix",
  nextEmployeeNo: null,
  nextCreditNoteNo: "creditNotePrefix",
};

/**
 * Atomically claims the next document number for the current company.
 * Must be called inside the same transaction that creates the document —
 * the row-level lock on CompanySettings serializes concurrent claims.
 */
export async function nextDocNumber(
  tx: Tx,
  counter: DocCounter,
  pad = 5
): Promise<{ number: number; formatted: string }> {
  const companyId = requireCompanyId();
  const updated = await tx.companySettings.update({
    where: { companyId },
    data: { [counter]: { increment: 1 } },
  });
  const settings = updated as unknown as Record<string, unknown>;
  const number = (settings[counter] as number) - 1;
  const prefixField = PREFIX_FIELD[counter];
  const prefix = prefixField ? String(settings[prefixField] ?? "") : "";
  return { number, formatted: `${prefix}${String(number).padStart(pad, "0")}` };
}
