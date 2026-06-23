// ─────────────────────────────────────────────────────────────────────────────
// Decision Advisor — recommendation assembler (serving plane).
//
// Pure function: given a draft deal's generalized features and a lookup over the
// published (k-anonymized, DP-noised) cohort stats, produce a win-probability
// estimate for the current discount and, when the data supports it, a better
// discount suggestion. Every output carries its evidence (deals, tenants, which
// peer level it came from) so the UI can show confidence and never over-claim.
//
// It NEVER throws and NEVER blocks: with no qualifying cohort it returns a
// "learning" status. No tenant's raw data is touched here — only the global,
// already-released aggregates.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DealFeatures,
  DISCOUNT_BAND_LIST,
  discountBandMidpoint,
  toCohortFeatures,
} from "./cohort";
import { StatLookup, levelLabel, resolveCohort } from "./backoff";
import {
  betaMean,
  credibleInterval95,
  rankDiscountOptions,
  shrunkPosterior,
} from "./estimators";

export interface QuoteAdvice {
  status: "ok" | "learning";
  /** Discount band the draft currently sits in. */
  currentBand: string;
  /** Posterior win probability at the current band (0–1). */
  winProbability: number | null;
  /** 95% credible interval for winProbability. */
  confidenceLow: number | null;
  confidenceHigh: number | null;
  basedOn: { deals: number; tenants: number; level: number; levelLabel: string } | null;
  /** Optional: a discount band with materially better expected value. */
  suggestion: {
    band: string;
    winProbability: number;
    /** Percentage-point change in win probability vs. the current band. */
    winProbDeltaPts: number;
  } | null;
  /** Plain-English evidence line for display. */
  evidence: string;
}

/** Require a suggested band to beat the current one by ≥5% expected value. */
const SUGGESTION_EV_MARGIN = 1.05;

export function adviseQuote(deal: DealFeatures, lookup: StatLookup): QuoteAdvice {
  const features = toCohortFeatures(deal);
  const learning: QuoteAdvice = {
    status: "learning",
    currentBand: features.discountBand,
    winProbability: null,
    confidenceLow: null,
    confidenceHigh: null,
    basedOn: null,
    suggestion: null,
    evidence: "Still learning — not enough comparable deals across companies yet.",
  };

  const current = resolveCohort(features, features.discountBand, lookup);
  if (!current) return learning;

  const curPost = shrunkPosterior(current.row.wins, current.row.trials, current.parentMean);
  const curProb = betaMean(curPost);
  const [lo, hi] = credibleInterval95(curPost);
  const curEV = curProb * (1 - discountBandMidpoint(features.discountBand) / 100);

  // Evaluate every discount band that has a published cohort, for the suggestion.
  const perBand: { band: string; winProb: number; midpointPct: number; ev: number }[] = [];
  for (const band of DISCOUNT_BAND_LIST) {
    const r = resolveCohort(features, band, lookup);
    if (!r) continue;
    const prob = betaMean(shrunkPosterior(r.row.wins, r.row.trials, r.parentMean));
    const mid = discountBandMidpoint(band);
    perBand.push({ band, winProb: prob, midpointPct: mid, ev: prob * (1 - mid / 100) });
  }

  const ranked = rankDiscountOptions(perBand);
  const best = ranked[0];
  let suggestion: QuoteAdvice["suggestion"] = null;
  if (best && best.band !== features.discountBand && best.expectedValue > curEV * SUGGESTION_EV_MARGIN) {
    suggestion = {
      band: best.band,
      winProbability: best.winProb,
      winProbDeltaPts: Math.round((best.winProb - curProb) * 100),
    };
  }

  return {
    status: "ok",
    currentBand: features.discountBand,
    winProbability: curProb,
    confidenceLow: lo,
    confidenceHigh: hi,
    basedOn: {
      deals: current.row.trials,
      tenants: current.row.tenantCount,
      level: current.level,
      levelLabel: levelLabel(current.level),
    },
    suggestion,
    evidence: `Based on ${current.row.trials} comparable quotes across ${current.row.tenantCount} companies in ${levelLabel(current.level)}.`,
  };
}
