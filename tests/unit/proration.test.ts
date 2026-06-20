import { describe, it, expect } from "vitest";
import { computeProration, periodDays, periodEnd } from "@/lib/proration";

const DAY = 24 * 60 * 60 * 1000;

describe("proration — upgrades only, credit unused", () => {
  it("charges full price when there is no live billing window", () => {
    const r = computeProration({
      currentPriceInPaise: 0,
      newPriceInPaise: 99900,
      periodStart: null,
      periodEnd: null,
    });
    expect(r.isUpgrade).toBe(true);
    expect(r.creditInPaise).toBe(0);
    expect(r.chargeInPaise).toBe(99900);
  });

  it("credits the unused half of the current plan on a mid-cycle upgrade", () => {
    const now = new Date("2026-06-20T00:00:00Z");
    const start = new Date(now.getTime() - 15 * DAY); // 15 days into a 30-day window
    const end = new Date(now.getTime() + 15 * DAY); // 15 days remaining
    const r = computeProration({
      currentPriceInPaise: 49900, // Starter ₹499
      newPriceInPaise: 99900, // Professional ₹999
      periodStart: start,
      periodEnd: end,
      now,
    });
    expect(r.isUpgrade).toBe(true);
    // ~half of ₹499 = ₹249.50 → 24950 paise credit
    expect(r.creditInPaise).toBe(24950);
    expect(r.chargeInPaise).toBe(99900 - 24950);
    expect(r.remainingDays).toBe(15);
  });

  it("does not prorate a downgrade (new price ≤ current)", () => {
    const now = new Date();
    const r = computeProration({
      currentPriceInPaise: 99900,
      newPriceInPaise: 49900,
      periodStart: new Date(now.getTime() - 10 * DAY),
      periodEnd: new Date(now.getTime() + 20 * DAY),
      now,
    });
    expect(r.isUpgrade).toBe(false);
    expect(r.creditInPaise).toBe(0);
    expect(r.chargeInPaise).toBe(49900);
  });

  it("gives no credit once the window has fully elapsed", () => {
    const now = new Date();
    const r = computeProration({
      currentPriceInPaise: 49900,
      newPriceInPaise: 99900,
      periodStart: new Date(now.getTime() - 40 * DAY),
      periodEnd: new Date(now.getTime() - 10 * DAY), // ended 10 days ago
      now,
    });
    expect(r.creditInPaise).toBe(0);
    expect(r.chargeInPaise).toBe(99900);
  });

  it("clamps credit so the charge is never negative", () => {
    const now = new Date();
    const r = computeProration({
      currentPriceInPaise: 200000, // current plan dearer than the target
      newPriceInPaise: 250000,
      periodStart: new Date(now.getTime() - 1 * DAY),
      periodEnd: new Date(now.getTime() + 29 * DAY),
      now,
    });
    expect(r.chargeInPaise).toBeGreaterThanOrEqual(0);
  });
});

describe("period helpers", () => {
  it("maps billing periods to day counts", () => {
    expect(periodDays("monthly")).toBe(30);
    expect(periodDays("yearly")).toBe(365);
    expect(periodDays("one-time")).toBe(0);
    expect(periodDays("weird")).toBe(30); // defaults to monthly
  });

  it("computes a period end from a start", () => {
    const start = new Date("2026-06-20T00:00:00Z");
    expect(periodEnd(start, "monthly").getTime()).toBe(start.getTime() + 30 * DAY);
  });
});
