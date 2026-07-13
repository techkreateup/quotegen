import { describe, it, expect } from "vitest";
import { computeMatchLines, type PoLineIn } from "@/lib/three-way-match";

const po: PoLineIn[] = [
  { id: "L1", itemName: "Steel Rod 12mm", hsnSac: "7214", gstRate: 18, quantity: 100, rate: 50 },
  { id: "L2", itemName: "Cement Bag", hsnSac: "2523", gstRate: 28, quantity: 20, rate: 400 },
];

describe("computeMatchLines", () => {
  it("clean match → no flags", () => {
    const lines = computeMatchLines(
      po,
      [{ itemName: "Steel Rod 12mm", quantity: 100, poLineItemId: "L1" }, { itemName: "Cement Bag", quantity: 20, poLineItemId: "L2" }],
      [{ itemName: "Steel Rod 12mm", quantity: 100, rate: 50, amount: 5000, poLineItemId: "L1" }, { itemName: "Cement Bag", quantity: 20, rate: 400, amount: 8000, poLineItemId: "L2" }],
      5,
    );
    expect(lines.every((l) => l.flag === null)).toBe(true);
    expect(lines[0].receivedQty).toBe(100);
  });

  it("keys on poLineItemId — survives an item rename on the bill", () => {
    const lines = computeMatchLines(
      po,
      [{ itemName: "TMT Rod 12 mm (renamed)", quantity: 100, poLineItemId: "L1" }],
      [{ itemName: "TMT Rod 12 mm (renamed)", quantity: 100, rate: 50, amount: 5000, poLineItemId: "L1" }],
      5,
    );
    expect(lines[0].receivedQty).toBe(100);
    expect(lines[0].billedQty).toBe(100);
    expect(lines[0].flag).toBeNull();
  });

  it("legacy rows without poLineItemId fall back to normalized name", () => {
    const lines = computeMatchLines(
      po,
      [{ itemName: "  steel  rod 12MM ", quantity: 60, poLineItemId: null }],
      [{ itemName: "STEEL ROD 12mm", quantity: 60, rate: 50, amount: 3000 }],
      5,
    );
    expect(lines[0].receivedQty).toBe(60);
    expect(lines[0].billedQty).toBe(60);
  });

  it("sums partial receipts across multiple GRNs", () => {
    const lines = computeMatchLines(
      po,
      [
        { itemName: "Steel Rod 12mm", quantity: 40, poLineItemId: "L1" },
        { itemName: "Steel Rod 12mm", quantity: 60, poLineItemId: "L1" },
      ],
      [],
      5,
    );
    expect(lines[0].receivedQty).toBe(100);
  });

  it("flags over_bill beyond tolerance", () => {
    const lines = computeMatchLines(
      po,
      [{ itemName: "Steel Rod 12mm", quantity: 100, poLineItemId: "L1" }],
      [{ itemName: "Steel Rod 12mm", quantity: 110, rate: 50, amount: 5500, poLineItemId: "L1" }],
      5,
    );
    expect(lines[0].flag).toBe("over_bill");
  });

  it("flags short_supply below tolerance", () => {
    const lines = computeMatchLines(
      po,
      [{ itemName: "Steel Rod 12mm", quantity: 100, poLineItemId: "L1" }],
      [{ itemName: "Steel Rod 12mm", quantity: 80, rate: 50, amount: 4000, poLineItemId: "L1" }],
      5,
    );
    expect(lines[0].flag).toBe("short_supply");
  });

  it("flags rate_variance when qty is fine but price crept", () => {
    const lines = computeMatchLines(
      po,
      [{ itemName: "Steel Rod 12mm", quantity: 100, poLineItemId: "L1" }],
      [{ itemName: "Steel Rod 12mm", quantity: 100, rate: 60, amount: 6000, poLineItemId: "L1" }],
      5,
    );
    expect(lines[0].flag).toBe("rate_variance");
    expect(lines[0].rateVariancePct).toBe(20);
  });

  it("within-tolerance variance is not flagged", () => {
    const lines = computeMatchLines(
      po,
      [{ itemName: "Steel Rod 12mm", quantity: 100, poLineItemId: "L1" }],
      [{ itemName: "Steel Rod 12mm", quantity: 104, rate: 51, amount: 5304, poLineItemId: "L1" }],
      5,
    );
    expect(lines[0].flag).toBeNull();
  });

  it("nothing received yet → no false over_bill (flags need received > 0)", () => {
    const lines = computeMatchLines(
      po,
      [],
      [{ itemName: "Steel Rod 12mm", quantity: 100, rate: 50, amount: 5000, poLineItemId: "L1" }],
      5,
    );
    expect(lines[0].flag).toBeNull();
    expect(lines[0].receivedQty).toBe(0);
  });

  it("zero-qty PO line does not divide by zero", () => {
    const lines = computeMatchLines(
      [{ id: "Z", itemName: "Freight", hsnSac: "", gstRate: 0, quantity: 0, rate: 0 }],
      [], [], 5,
    );
    expect(lines[0].qtyVariancePct).toBe(0);
    expect(lines[0].rateVariancePct).toBe(0);
  });
});
