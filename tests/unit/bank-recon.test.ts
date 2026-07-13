import { describe, it, expect } from "vitest";
import { parseBankCsv, reconcile, type OpenDoc } from "@/lib/bank-recon";

const invoices: OpenDoc[] = [
  { id: "i1", number: "INV/25-26/00042", party: "Acme Traders", partyId: "c1", outstanding: 11800 },
  { id: "i2", number: "INV/25-26/00043", party: "Bharat Steels", partyId: "c2", outstanding: 5000 },
];
const bills: OpenDoc[] = [
  { id: "b1", number: "VB-778", party: "Kumar Suppliers", partyId: "v1", outstanding: 2360 },
];

describe("parseBankCsv", () => {
  it("parses credit/debit columns and skips bank boilerplate above the header", () => {
    const csv = `My Bank Ltd\nStatement for June\nDate,Narration,Chq/Ref No,Debit,Credit\n01/06/2026,NEFT ACME TRADERS INV2526 00042,UTR123,,11800.00\n02/06/2026,UPI KUMAR SUPPLIERS,REF9,"2,360.00",`;
    const rows = parseBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(11800);
    expect(rows[1].amount).toBe(-2360);
    expect(rows[0].reference).toBe("UTR123");
  });

  it("parses a single signed Amount column with CR/DR tags", () => {
    const csv = `Date,Description,Amount\n03/06/2026,IMPS FROM BHARAT,5000 CR\n04/06/2026,CHARGES,25 DR`;
    const rows = parseBankCsv(csv);
    expect(rows[0].amount).toBe(5000);
    expect(rows[1].amount).toBe(-25);
  });

  it("returns [] when no recognizable header exists", () => {
    expect(parseBankCsv("just,some,junk\n1,2,3")).toEqual([]);
  });
});

describe("reconcile", () => {
  it("matches by invoice number in narration → high confidence", () => {
    const [s] = reconcile(
      [{ date: "01/06", description: "NEFT ACME INV/25-26/00042", amount: 11800, reference: "" }],
      invoices, bills,
    );
    expect(s.docId).toBe("i1");
    expect(s.confidence).toBe("high");
    expect(s.side).toBe("receivable");
  });

  it("matches unique exact amount → medium; amount+party → high", () => {
    const [amtOnly] = reconcile([{ date: "", description: "RTGS SOMEONE", amount: 5000, reference: "" }], invoices, bills);
    expect(amtOnly.docId).toBe("i2");
    expect(amtOnly.confidence).toBe("medium");
    const [both] = reconcile([{ date: "", description: "RTGS BHARAT STEELS", amount: 5000, reference: "" }], invoices, bills);
    expect(both.confidence).toBe("high");
  });

  it("routes debits to the payable pool", () => {
    const [s] = reconcile([{ date: "", description: "NEFT TO KUMAR SUPPLIERS VB-778", amount: -2360, reference: "" }], invoices, bills);
    expect(s.side).toBe("payable");
    expect(s.docId).toBe("b1");
  });

  it("does not reuse a confidently-matched doc for a second row", () => {
    const rows = [
      { date: "", description: "INV/25-26/00042 part 1", amount: 11800, reference: "" },
      { date: "", description: "INV/25-26/00042 duplicate", amount: 11800, reference: "" },
    ];
    const [a, b] = reconcile(rows, invoices, bills);
    expect(a.docId).toBe("i1");
    expect(b.docId).not.toBe("i1");
  });

  it("no signal → none", () => {
    const [s] = reconcile([{ date: "", description: "ATM WDL", amount: 999, reference: "" }], invoices, bills);
    expect(s.confidence).toBe("none");
    expect(s.docId).toBeNull();
  });
});
