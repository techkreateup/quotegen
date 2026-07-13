// ─── GSTR-2B reconciliation (Tier 2) ─────────────────────────────────────────
// Pure functions: parse the government GSTR-2B JSON (as downloaded from the
// GST portal) and reconcile its B2B invoices against recorded PurchaseBills.
// Outcomes:
//   matched          — same supplier GSTIN + doc no, values agree (₹1 tolerance)
//   value_mismatch   — found but taxable/total differs beyond tolerance
//   missing_in_books — in 2B but no bill recorded (ITC available, unclaimed)
//   missing_in_2b    — bill recorded but supplier didn't file (ITC at risk)

export interface B2BDoc {
  supplierGstin: string;
  supplierName: string;
  docNo: string;
  docDate: string;
  taxableValue: number;
  igst: number; cgst: number; sgst: number;
  total: number;
}

export interface BookBill {
  id: string;
  billNo: string;
  vendorName: string;
  vendorGstin: string;
  totalAmount: number;
  subtotal: number;
}

export type ReconStatus = "matched" | "value_mismatch" | "missing_in_books" | "missing_in_2b";
export interface ReconLine {
  status: ReconStatus;
  supplierGstin: string;
  supplierName: string;
  docNo: string;
  b2bTotal: number | null;
  bookTotal: number | null;
  billId: string | null;
  note: string;
}

const normNo = (s: string) => s.trim().toUpperCase().replace(/[\/\-\s]/g, "");

/** Parse the portal's GSTR-2B JSON. Tolerates both the raw download shape
 *  ({ data: { docdata: { b2b: [...] } } }) and an already-unwrapped docdata. */
export function parseGstr2b(json: unknown): B2BDoc[] {
  const root = json as Record<string, unknown>;
  const data = (root?.data ?? root) as Record<string, unknown>;
  const docdata = (data?.docdata ?? data) as Record<string, unknown>;
  const b2b = docdata?.b2b;
  if (!Array.isArray(b2b)) return [];
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return b2b.flatMap((sup) => {
    const s = sup as Record<string, unknown>;
    const invs = Array.isArray(s.inv) ? s.inv : [];
    return invs.map((raw) => {
      const i = raw as Record<string, unknown>;
      const igst = num(i.igst), cgst = num(i.cgst), sgst = num(i.sgst);
      const txval = num(i.txval);
      return {
        supplierGstin: String(s.ctin ?? ""),
        supplierName: String(s.trdnm ?? ""),
        docNo: String(i.inum ?? ""),
        docDate: String(i.dt ?? ""),
        taxableValue: txval,
        igst, cgst, sgst,
        total: num(i.val) || txval + igst + cgst + sgst,
      };
    });
  }).filter((d) => d.supplierGstin && d.docNo);
}

export function reconcile2b(b2bDocs: B2BDoc[], bills: BookBill[], toleranceRupees = 1): ReconLine[] {
  const billKey = (gstin: string, no: string) => `${gstin.trim().toUpperCase()}|${normNo(no)}`;
  const billMap = new Map<string, BookBill>();
  for (const b of bills) if (b.vendorGstin) billMap.set(billKey(b.vendorGstin, b.billNo), b);

  const seenBillIds = new Set<string>();
  const lines: ReconLine[] = b2bDocs.map((d) => {
    const bill = billMap.get(billKey(d.supplierGstin, d.docNo));
    if (!bill) {
      return { status: "missing_in_books", supplierGstin: d.supplierGstin, supplierName: d.supplierName, docNo: d.docNo, b2bTotal: d.total, bookTotal: null, billId: null, note: "Supplier filed this invoice — no matching bill recorded" };
    }
    seenBillIds.add(bill.id);
    const diff = Math.abs(bill.totalAmount - d.total);
    if (diff > toleranceRupees) {
      return { status: "value_mismatch", supplierGstin: d.supplierGstin, supplierName: d.supplierName, docNo: d.docNo, b2bTotal: d.total, bookTotal: bill.totalAmount, billId: bill.id, note: `Differs by ₹${Math.round(diff)}` };
    }
    return { status: "matched", supplierGstin: d.supplierGstin, supplierName: d.supplierName, docNo: d.docNo, b2bTotal: d.total, bookTotal: bill.totalAmount, billId: bill.id, note: "" };
  });

  for (const b of bills) {
    if (!seenBillIds.has(b.id)) {
      lines.push({
        status: "missing_in_2b", supplierGstin: b.vendorGstin, supplierName: b.vendorName, docNo: b.billNo,
        b2bTotal: null, bookTotal: b.totalAmount, billId: b.id,
        note: b.vendorGstin ? "Recorded in books — supplier has not filed (ITC at risk)" : "Vendor has no GSTIN on file — cannot match",
      });
    }
  }
  return lines;
}
