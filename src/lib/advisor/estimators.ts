// ─────────────────────────────────────────────────────────────────────────────
// Decision Advisor — statistical estimators.
//
// Win-probability is modelled as a Beta-Binomial posterior. The Beta prior is
// taken from the PARENT cohort (empirical Bayes), so a thin leaf cohort is
// shrunk toward the broader, better-evidenced estimate — James–Stein-style
// shrinkage. This is what makes the engine behave sanely at n=2 as well as
// n=2000, and it is the cold-start defence: with no leaf data the estimate is
// simply the prior.
//
// These are deterministic, explainable statistics — NOT an LLM guess. Trust in
// the number is the whole product, so the maths stays inspectable here.
// ─────────────────────────────────────────────────────────────────────────────

import { PRIVACY } from "./privacy";

export interface BetaPosterior {
  alpha: number;
  beta: number;
}

/** Mean of a Beta(alpha, beta). */
export function betaMean(p: BetaPosterior): number {
  return p.alpha / (p.alpha + p.beta);
}

/**
 * 95% credible interval via the Beta posterior's normal approximation.
 * Adequate here (we only ever serve cohorts well past the k-anonymity floor, so
 * alpha+beta is large) and avoids pulling in an incomplete-beta implementation.
 */
export function credibleInterval95(p: BetaPosterior): [number, number] {
  const a = p.alpha;
  const b = p.beta;
  const mean = a / (a + b);
  const variance = (a * b) / ((a + b) * (a + b) * (a + b + 1));
  const sd = Math.sqrt(Math.max(variance, 0));
  return [clamp01(mean - 1.96 * sd), clamp01(mean + 1.96 * sd)];
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Build the win-rate posterior for a leaf, shrinking toward the parent mean.
 *
 * The parent mean acts as the prior; PRIOR_STRENGTH is its pseudo-count weight.
 * With many leaf trials the data dominates; with few, the parent prior does.
 *
 *   alpha = wins   + strength * parentMean
 *   beta  = losses + strength * (1 - parentMean)
 *
 * @param wins        wins observed in the leaf cohort
 * @param trials      total trials observed in the leaf cohort
 * @param parentMean  win-rate of the parent (backed-off) cohort; the prior
 * @param strength    prior pseudo-count (defaults to PRIVACY.PRIOR_STRENGTH)
 */
export function shrunkPosterior(
  wins: number,
  trials: number,
  parentMean: number,
  strength: number = PRIVACY.PRIOR_STRENGTH
): BetaPosterior {
  const m = clamp01(parentMean);
  const losses = Math.max(0, trials - wins);
  return {
    alpha: Math.max(1e-6, wins + strength * m),
    beta: Math.max(1e-6, losses + strength * (1 - m)),
  };
}

/** Plain (unshrunk) Jeffreys posterior — used for a cohort that has no parent. */
export function jeffreysPosterior(wins: number, trials: number): BetaPosterior {
  const losses = Math.max(0, trials - wins);
  return { alpha: wins + 0.5, beta: losses + 0.5 };
}

export interface DiscountOption {
  band: string;
  /** Posterior win probability at this discount band. */
  winProb: number;
  /** Expected value = winProb × margin proxy. Used to rank options. */
  expectedValue: number;
}

/**
 * Rank discount bands by expected value, where the margin proxy falls as the
 * discount midpoint rises (a deeper discount wins more but earns less per deal).
 *
 *   EV(band) = P(win | band) × (1 − midpoint/100)
 *
 * Returns options sorted best-first. Bands with no qualifying data are omitted
 * by the caller before this runs.
 */
export function rankDiscountOptions(
  perBand: { band: string; winProb: number; midpointPct: number }[]
): DiscountOption[] {
  return perBand
    .map(({ band, winProb, midpointPct }) => ({
      band,
      winProb,
      expectedValue: winProb * (1 - midpointPct / 100),
    }))
    .sort((a, b) => b.expectedValue - a.expectedValue);
}
