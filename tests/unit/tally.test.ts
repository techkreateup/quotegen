import { describe, it, expect } from "vitest";
import { tallyEnvelope, voucherXml, type TallyVoucherIn } from "@/lib/tally";

const sale: TallyVoucherIn = {
  kind: "Sales", date: "2026-06-15", number: "INV-1", party: "Acme & Co <Pvt>",
  subtotal: 1000, cgst: 90, sgst: 90, igst: 0, total: 1180,
};

describe("voucherXml", () => {
  it("balances debits and credits (Tally sign convention)", () => {
    const xml = voucherXml(sale);
    const amounts = [...xml.matchAll(/<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)].map((m) => Number(m[1]));
    expect(amounts.reduce((s, a) => s + a, 0)).toBeCloseTo(0, 2);
    expect(amounts).toContain(-1180); // Dr party
    expect(xml).toContain("Output CGST");
  });
  it("escapes XML-unsafe party names", () => {
    const xml = voucherXml(sale);
    expect(xml).toContain("Acme &amp; Co &lt;Pvt&gt;");
    expect(xml).not.toContain("<Pvt>");
  });
  it("IGST purchase uses Input IGST ledger and credits the vendor", () => {
    const xml = voucherXml({ kind: "Purchase", date: "2026-06-15", number: "VB-1", party: "Kumar", subtotal: 1000, cgst: 0, sgst: 0, igst: 180, total: 1180 });
    expect(xml).toContain("Input IGST");
    expect(xml).toContain("<AMOUNT>1180.00</AMOUNT>"); // Cr vendor positive
  });
  it("formats dates as YYYYMMDD", () => {
    expect(voucherXml(sale)).toContain("<DATE>20260615</DATE>");
  });
});

describe("tallyEnvelope", () => {
  it("wraps vouchers in an Import Data envelope with the company name", () => {
    const xml = tallyEnvelope([sale], "Test Workspace");
    expect(xml).toContain("<TALLYREQUEST>Import Data</TALLYREQUEST>");
    expect(xml).toContain("<SVCURRENTCOMPANY>Test Workspace</SVCURRENTCOMPANY>");
    expect(xml.match(/<VOUCHER /g)).toHaveLength(1);
  });
});
