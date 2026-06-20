// Shared line-item normaliser for quotations, invoices and credit notes.
//
// When a document is created from another (e.g. converting a quotation to an
// invoice), the source line items carry relation/foreign keys — id, quotationId,
// invoiceId, creditNoteId, and nested relation objects — that don't exist on the
// target's line-item table. Spreading them straight into a Prisma `create` throws
// "Unknown argument". This whitelists only the real columns.

const LINE_ITEM_FIELDS = [
  "itemName",
  "description",
  "hsnSac",
  "gstRate",
  "quantity",
  "rate",
  "discountType",
  "discountValue",
  "discountAmount",
  "amount",
  "cgst",
  "sgst",
  "igst",
  "total",
] as const;

type RawItem = Record<string, unknown>;

/** Returns clean `{ ...fields, sortOrder }` rows ready for a nested `create`. */
export function sanitizeLineItems(items: unknown): Record<string, unknown>[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw: RawItem, i: number) => {
    const clean: Record<string, unknown> = { sortOrder: i };
    for (const field of LINE_ITEM_FIELDS) {
      if (raw[field] !== undefined && raw[field] !== null) clean[field] = raw[field];
    }
    return clean;
  });
}
