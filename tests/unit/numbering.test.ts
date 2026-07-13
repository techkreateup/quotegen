import { describe, it, expect } from "vitest";
import { trailingNum } from "@/lib/numbering";
import { currentFyLabel, expandFyTokens } from "@/lib/fy";

describe("trailingNum", () => {
  it("extracts trailing integers", () => {
    expect(trailingNum("Q00042")).toBe(42);
    expect(trailingNum("INV/25-26/00007")).toBe(7);
    expect(trailingNum("NGI-3")).toBe(3);
  });
  it("returns 0 when no trailing number", () => {
    expect(trailingNum("DRAFT")).toBe(0);
    expect(trailingNum("")).toBe(0);
    expect(trailingNum(null)).toBe(0);
    expect(trailingNum(undefined)).toBe(0);
  });
  it("ignores embedded numbers that are not trailing", () => {
    expect(trailingNum("FY25-INV-abc")).toBe(0);
  });
});

describe("currentFyLabel (Indian FY, April start)", () => {
  it("May 2026 falls in FY 2026-27", () => {
    expect(currentFyLabel(4, new Date("2026-05-15"))).toEqual({ short: "26-27", full: "2026-2027" });
  });
  it("Feb 2026 falls in FY 2025-26 (before April)", () => {
    expect(currentFyLabel(4, new Date("2026-02-15"))).toEqual({ short: "25-26", full: "2025-2026" });
  });
  it("April 1 boundary starts the new FY", () => {
    expect(currentFyLabel(4, new Date("2026-04-01")).short).toBe("26-27");
    expect(currentFyLabel(4, new Date("2026-03-31")).short).toBe("25-26");
  });
  it("falsy startMonth defaults to April", () => {
    expect(currentFyLabel(0, new Date("2026-05-15")).short).toBe("26-27");
  });
});

describe("expandFyTokens", () => {
  const fy = { short: "25-26", full: "2025-2026" };
  it("expands {FY} and {FYFULL}, all occurrences", () => {
    expect(expandFyTokens("INV/{FY}/", fy)).toBe("INV/25-26/");
    expect(expandFyTokens("{FYFULL}-{FY}-{FY}", fy)).toBe("2025-2026-25-26-25-26");
  });
  it("leaves plain prefixes untouched", () => {
    expect(expandFyTokens("PO-", fy)).toBe("PO-");
  });
});
