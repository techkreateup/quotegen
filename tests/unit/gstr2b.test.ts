import { describe, it, expect } from "vitest";
import { parseGstr2b, reconcile2b, type BookBill } from "@/lib/gstr2b";

const portalJson = {
  data: {
    docdata: {
      b2b: [
        {
          ctin: "33AAACX1234A1Z5", trdnm: "Kumar Suppliers",
          inv: [
            { inum: "VB-778", dt: "05-06-2026", val: 2360, txval: 2000, igst: 0, cgst: 180, sgst: 180 },
            { inum: "VB/779", dt: "06-06-2026", val: 1180, txval: 1000, igst: 180, cgst: 0, sgst: 0 },
          ],
        },
      ],
    },
  },
};

const bills: BookBill[] = [
  { id: "b1", billNo: "VB-778", vendorName: "Kumar Suppliers", vendorGstin: "33AAACX1234A1Z5", totalAmount: 2360, subtotal: 2000 },
  { id: "b2", billNo: "VB-900", vendorName: "NoFile Traders", vendorGstin: "29ZZZZZ9999Z9Z9", totalAmount: 500, subtotal: 500 },
  { id: "b3", billNo: "CASH-1", vendorName: "Local Cash Vendor", vendorGstin: "", totalAmount: 100, subtotal: 100 },
];

describe("parseGstr2b", () => {
  it("parses the portal download shape", () => {
    const docs = parseGstr2b(portalJson);
    expect(docs).toHaveLength(2);
    expect(docs[0].supplierGstin).toBe("33AAACX1234A1Z5");
    expect(docs[1].total).toBe(1180);
  });
  it("computes total from parts when val is missing", () => {
    const docs = parseGstr2b({ docdata: { b2b: [{ ctin: "X1", inv: [{ inum: "1", txval: 100, igst: 18 }] }] } });
    expect(docs[0].total).toBe(118);
  });
  it("returns [] for non-2B JSON", () => {
    expect(parseGstr2b({ hello: "world" })).toEqual([]);
  });
});

describe("reconcile2b", () => {
  it("matches ignoring doc-number separators (VB/779 vs VB-779)", () => {
    const lines = reconcile2b(parseGstr2b(portalJson), [
      ...bills,
      { id: "b4", billNo: "VB-779", vendorName: "Kumar Suppliers", vendorGstin: "33AAACX1234A1Z5", totalAmount: 1180, subtotal: 1000 },
    ]);
    expect(lines.filter((l) => l.status === "matched")).toHaveLength(2);
  });

  it("classifies all four outcomes", () => {
    const lines = reconcile2b(parseGstr2b(portalJson), bills);
    const by = (s: string) => lines.filter((l) => l.status === s);
    expect(by("matched")).toHaveLength(1);            // VB-778
    expect(by("missing_in_books")).toHaveLength(1);   // VB/779 filed, not recorded
    expect(by("missing_in_2b")).toHaveLength(2);      // b2 unfiled + b3 no GSTIN
    expect(by("missing_in_2b").find((l) => l.docNo === "CASH-1")?.note).toContain("no GSTIN");
  });

  it("flags value mismatch beyond ₹1 tolerance", () => {
    const lines = reconcile2b(parseGstr2b(portalJson), [
      { ...bills[0], totalAmount: 2400 },
    ]);
    const mm = lines.find((l) => l.docNo === "VB-778");
    expect(mm?.status).toBe("value_mismatch");
    expect(mm?.note).toContain("₹40");
  });
});
