import { describe, it, expect } from "vitest";
import {
  passesReleaseGate,
  PRIVACY,
  tenantHash,
  noisyCount,
} from "@/lib/advisor/privacy";
import {
  amountBucket,
  discountBand,
  cohortKey,
  statKey,
  toCohortFeatures,
  ancestorCohortKeys,
} from "@/lib/advisor/cohort";
import {
  shrunkPosterior,
  betaMean,
  credibleInterval95,
  rankDiscountOptions,
} from "@/lib/advisor/estimators";
import { resolveCohort, type StatRow } from "@/lib/advisor/backoff";
import { adviseQuote } from "@/lib/advisor/recommend";

describe("privacy gate", () => {
  it("suppresses when too few tenants", () => {
    expect(passesReleaseGate({ n: 100, tenantCount: 4, topTenantRecords: 20 })).toBe(false);
  });
  it("suppresses when too few records", () => {
    expect(passesReleaseGate({ n: 29, tenantCount: 10, topTenantRecords: 3 })).toBe(false);
  });
  it("suppresses a dominant contributor", () => {
    // one tenant supplies 60% of 100 records
    expect(passesReleaseGate({ n: 100, tenantCount: 6, topTenantRecords: 60 })).toBe(false);
  });
  it("passes when all guards are satisfied", () => {
    expect(passesReleaseGate({ n: 100, tenantCount: 8, topTenantRecords: 20 })).toBe(true);
  });
});

describe("tenant hashing", () => {
  it("is deterministic and one-way (not the raw id)", () => {
    const h1 = tenantHash("company_abc");
    const h2 = tenantHash("company_abc");
    expect(h1).toBe(h2);
    expect(h1).not.toContain("company_abc");
    expect(h1).toHaveLength(64); // sha256 hex
  });
  it("differs across companies", () => {
    expect(tenantHash("a")).not.toBe(tenantHash("b"));
  });
});

describe("dp noise", () => {
  it("never returns a negative count", () => {
    for (let i = 0; i < 200; i++) expect(noisyCount(0)).toBeGreaterThanOrEqual(0);
  });
});

describe("cohort generalisation", () => {
  it("buckets amounts", () => {
    expect(amountBucket(5_000)).toBe("<10k");
    expect(amountBucket(25_000)).toBe("10k-50k");
    expect(amountBucket(4_000_000)).toBe("10L-50L");
    expect(amountBucket(9_999_999)).toBe("50L+");
  });
  it("bands discounts", () => {
    expect(discountBand(0)).toBe("0%");
    expect(discountBand(7)).toBe("5-10%");
    expect(discountBand(45)).toBe("30%+");
  });
  it("produces stable, order-independent keys", () => {
    const f = toCohortFeatures({ industry: "IT", region: "TN", currency: "INR", amount: 25_000, discountPct: 7 });
    expect(cohortKey(f, 0)).toBe(cohortKey(f, 0));
    // level 4 (global) carries no dims
    expect(cohortKey(f, 4)).toBe("L4:");
  });
  it("rolls an event up into 5 ancestor levels", () => {
    const f = toCohortFeatures({ industry: "IT", region: "TN", currency: "INR", amount: 25_000, discountPct: 7 });
    expect(ancestorCohortKeys(f)).toHaveLength(5);
  });
});

describe("estimators", () => {
  it("returns the prior when the leaf has no data (cold start)", () => {
    const post = shrunkPosterior(0, 0, 0.7);
    expect(betaMean(post)).toBeCloseTo(0.7, 5);
  });
  it("converges to the empirical rate with lots of data", () => {
    const post = shrunkPosterior(900, 1000, 0.2); // 90% wins, prior says 20%
    expect(betaMean(post)).toBeGreaterThan(0.85); // data dominates the prior
  });
  it("produces a valid credible interval", () => {
    const [lo, hi] = credibleInterval95(shrunkPosterior(50, 100, 0.5));
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeLessThan(hi);
  });
  it("ranks discount options by expected value, not raw win-rate", () => {
    const ranked = rankDiscountOptions([
      { band: "0%", winProb: 0.5, midpointPct: 0 }, // EV 0.50
      { band: "30%+", winProb: 0.6, midpointPct: 40 }, // EV 0.36 — higher win, lower value
    ]);
    expect(ranked[0].band).toBe("0%");
  });
});

describe("backoff + advise (no raw data leaves the tenant)", () => {
  // Build a tiny published cohort store for one peer group.
  const f = toCohortFeatures({ industry: "it", region: "tn", currency: "INR", amount: 25_000, discountPct: 7 });
  const store = new Map<string, StatRow>();
  // exact leaf for the 5-10% band, plus a broader parent
  store.set(statKey(cohortKey(f, 0), "5-10%"), { wins: 70, trials: 100, tenantCount: 8 });
  store.set(statKey(cohortKey(f, 0), "30%+"), { wins: 40, trials: 100, tenantCount: 8 });
  store.set(statKey(cohortKey(f, 2), "5-10%"), { wins: 200, trials: 400, tenantCount: 20 });
  const lookup = (k: string) => store.get(k) ?? null;

  it("resolves the most specific published level", () => {
    const r = resolveCohort(f, "5-10%", lookup);
    expect(r?.level).toBe(0);
  });

  it("returns a 'learning' state when nothing is published", () => {
    const advice = adviseQuote(
      { industry: "unknown", region: "zz", currency: "INR", amount: 25_000, discountPct: 7 },
      () => null
    );
    expect(advice.status).toBe("learning");
    expect(advice.winProbability).toBeNull();
  });

  it("gives a win probability + evidence for a known cohort", () => {
    const advice = adviseQuote(
      { industry: "it", region: "tn", currency: "INR", amount: 25_000, discountPct: 7 },
      lookup
    );
    expect(advice.status).toBe("ok");
    expect(advice.winProbability).toBeGreaterThan(0.5);
    expect(advice.basedOn?.tenants).toBe(8);
    expect(advice.evidence).toMatch(/companies/);
  });
});
