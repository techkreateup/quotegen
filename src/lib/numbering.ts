import { requireCompanyId } from "@/lib/tenant-context";
import type prismaDefault from "@/lib/db";

type Tx = Parameters<Parameters<typeof prismaDefault.$transaction>[0]>[0];

export type DocCounter =
  | "nextQuotationNo"
  | "nextInvoiceNo"
  | "nextNonGstInvoiceNo"
  | "nextReceiptNo"
  | "nextVoucherNo"
  | "nextEmployeeNo"
  | "nextCreditNoteNo"
  | "nextProformaNo"
  | "nextSalesOrderNo"
  | "nextChallanNo"
  | "nextPoNo"
  | "nextGrnNo"
  | "nextDebitNoteNo";

const PREFIX_FIELD: Record<DocCounter, string | null> = {
  nextQuotationNo: "quotationPrefix",
  nextInvoiceNo: "invoicePrefix",
  nextNonGstInvoiceNo: "nonGstInvoicePrefix",
  nextReceiptNo: "receiptPrefix",
  nextVoucherNo: "voucherPrefix",
  nextEmployeeNo: null,
  nextCreditNoteNo: "creditNotePrefix",
  nextProformaNo: "proformaPrefix",
  nextSalesOrderNo: "salesOrderPrefix",
  nextChallanNo: "challanPrefix",
  nextPoNo: "poPrefix",
  nextGrnNo: "grnPrefix",
  nextDebitNoteNo: "debitNotePrefix",
};

// Maps a counter to the table + column that holds the issued document numbers,
// so we can self-heal a drifted counter (one that's behind the real data) before
// claiming. Drift happens when docs are imported/seeded without bumping the
// counter — the next claim then collides on the (companyId, no) unique index.
const RECONCILE_SOURCE: Record<DocCounter, [model: string, field: string] | null> = {
  nextQuotationNo: ["quotation", "quotationNo"],
  nextInvoiceNo: ["invoice", "invoiceNo"],
  nextNonGstInvoiceNo: ["invoice", "invoiceNo"],
  nextReceiptNo: ["paymentReceipt", "receiptNo"],
  nextVoucherNo: ["paymentVoucher", "voucherNo"],
  nextCreditNoteNo: ["creditNote", "creditNoteNo"],
  nextEmployeeNo: ["employee", "employeeCode"],
  nextProformaNo: ["quotation", "quotationNo"],
  nextSalesOrderNo: ["salesOrder", "salesOrderNo"],
  nextChallanNo: ["deliveryChallan", "challanNo"],
  nextPoNo: ["purchaseOrder", "purchaseOrderNo"],
  nextGrnNo: ["goodsReceiptNote", "grnNo"],
  nextDebitNoteNo: ["debitNote", "debitNoteNo"],
};

/** Highest trailing-integer in a document number string ("Q00042" → 42). */
export function trailingNum(s: unknown): number {
  const m = String(s ?? "").match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

// Re-export the client-safe FY helpers (moved to src/lib/fy.ts so editor
// previews don't drag in node:async_hooks via tenant-context).
export { currentFyLabel, expandFyTokens } from "@/lib/fy";
import { currentFyLabel, expandFyTokens } from "@/lib/fy";

/**
 * Atomically claims the next document number for the current company.
 * Must be called inside the same transaction that creates the document —
 * the row-level lock on CompanySettings serializes concurrent claims.
 *
 * Self-healing: before claiming, it reconciles the counter so it is always past
 * the highest number already issued for that document type. This makes a drifted
 * counter (which would otherwise throw a P2002 unique-constraint error on save)
 * correct itself on the next create, rather than blocking the user.
 */
export async function nextDocNumber(
  tx: Tx,
  counter: DocCounter,
  pad = 5
): Promise<{ number: number; formatted: string }> {
  const companyId = requireCompanyId();

  // Load the FY once so both reconcile and the final format use identical labels.
  const fyRow = await tx.companySettings.findUnique({
    where: { companyId }, select: { fiscalYearStart: true },
  }) as { fiscalYearStart?: number } | null;
  const fy = currentFyLabel(fyRow?.fiscalYearStart ?? 4);

  // ── self-heal drift + FY reset ───────────────────────────────────────────
  const src = RECONCILE_SOURCE[counter];
  const prefixField = PREFIX_FIELD[counter];
  if (src) {
    try {
      const [model, field] = src;
      const delegate = (tx as unknown as Record<string, { findMany: (a: unknown) => Promise<Record<string, unknown>[]> }>)[model];
      const rows = await delegate.findMany({ where: { companyId }, select: { [field]: true } });
      const cs = (await tx.companySettings.findUnique({
        where: { companyId },
        select: prefixField ? { [counter]: true, [prefixField]: true } : { [counter]: true },
      })) as unknown as Record<string, unknown> | null;
      // Two series can share one table (e.g. GST `INV` vs non-GST `NGI` invoices);
      // only reconcile against numbers carrying THIS counter's EXPANDED prefix.
      const rawPrefix = prefixField ? String(cs?.[prefixField] ?? "") : "";
      const expandedPrefix = expandFyTokens(rawPrefix, fy);
      const max = rows
        .filter((r) => !expandedPrefix || String(r[field] ?? "").startsWith(expandedPrefix))
        .reduce((m, r) => Math.max(m, trailingNum(r[field])), 0);
      const current = (cs?.[counter] as number) ?? 1;
      // GST FY reset: when the prefix carries an {FY} token AND no prior doc in
      // the current FY exists, restart the counter at 1 for the fresh series.
      if (rawPrefix.includes("{FY}") || rawPrefix.includes("{FYFULL}")) {
        if (max === 0 && current > 1) {
          await tx.companySettings.update({ where: { companyId }, data: { [counter]: 1 } });
        } else if (current <= max) {
          await tx.companySettings.update({ where: { companyId }, data: { [counter]: max + 1 } });
        }
      } else if (current <= max) {
        await tx.companySettings.update({ where: { companyId }, data: { [counter]: max + 1 } });
      }
    } catch {
      // Reconcile is best-effort — if it fails, fall through and claim anyway.
    }
  }

  const updated = await tx.companySettings.update({
    where: { companyId },
    data: { [counter]: { increment: 1 } },
  });
  const settings = updated as unknown as Record<string, unknown>;
  const number = (settings[counter] as number) - 1;
  const rawPrefix = prefixField ? String(settings[prefixField] ?? "") : "";
  const prefix = expandFyTokens(rawPrefix, fy);
  return { number, formatted: `${prefix}${String(number).padStart(pad, "0")}` };
}
