// ─────────────────────────────────────────────────────────────────────────────
// Decision Advisor — cohort keys & generalisation.
//
// A "cohort" groups comparable deals so the advisor can benchmark like with like.
// To defend against re-identification, every dimension is GENERALISED before it
// becomes part of a key: amounts are bucketed, geography is coarsened to state
// (never city), niche/free-text values collapse to "Other". No PII (names,
// GSTIN, emails, phones) ever enters a cohort key.
//
// Cohorts form a hierarchy from most- to least-specific. Backoff (see
// backoff.ts) walks UP this hierarchy until it reaches a level that has enough
// data to clear the privacy gate — the n-gram "stupid backoff" idea applied to
// business cohorts. The discount band is NOT part of the cohort itself; it is a
// sub-key, because the whole point is to compare win-rates ACROSS discount bands
// within the same cohort.
// ─────────────────────────────────────────────────────────────────────────────

import { CURRENCIES } from "@/lib/currency";

const KNOWN_CURRENCIES = new Set<string>(CURRENCIES.map((c) => c.code));

/** Raw, per-deal facts the advisor needs. Derived from a quotation + its client. */
export interface DealFeatures {
  industry: string;
  region: string; // client state
  currency: string;
  amount: number; // total amount in the deal's own currency
  discountPct: number; // overall discount as a percentage of subtotal
}

export interface CohortFeatures {
  industry: string;
  region: string;
  currency: string;
  amountBucket: string;
  discountBand: string;
}

// ── Generalisation helpers ────────────────────────────────────────────────────

/** Collapse free-text to a small, stable, non-identifying token. */
function normalizeCategory(raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "Other";
  // Cap length and lowercase so "IT Services" / "it services " collapse together.
  return v.slice(0, 40).toLowerCase();
}

function normalizeCurrency(raw: string): string {
  const code = (raw || "INR").toUpperCase();
  return KNOWN_CURRENCIES.has(code) ? code : "OTHER";
}

// Amount buckets (thresholds in the deal's own currency). Currency is part of the
// key, so e.g. ₹ deals and $ deals never share a bucket even at the same number.
const AMOUNT_THRESHOLDS: [number, string][] = [
  [10_000, "<10k"],
  [50_000, "10k-50k"],
  [100_000, "50k-1L"],
  [500_000, "1L-5L"],
  [1_000_000, "5L-10L"],
  [5_000_000, "10L-50L"],
];
export function amountBucket(amount: number): string {
  const a = Math.max(0, amount || 0);
  for (const [ceil, label] of AMOUNT_THRESHOLDS) if (a < ceil) return label;
  return "50L+";
}

// Discount bands. The midpoint is used as a crude margin proxy when ranking
// discount options (a 30% discount sacrifices ~30% of headline margin).
const DISCOUNT_BANDS: { band: string; max: number; mid: number }[] = [
  { band: "0%", max: 0.0001, mid: 0 },
  { band: "0-5%", max: 5, mid: 2.5 },
  { band: "5-10%", max: 10, mid: 7.5 },
  { band: "10-15%", max: 15, mid: 12.5 },
  { band: "15-20%", max: 20, mid: 17.5 },
  { band: "20-30%", max: 30, mid: 25 },
  { band: "30%+", max: Infinity, mid: 40 },
];
export function discountBand(pct: number): string {
  const p = Math.max(0, pct || 0);
  for (const b of DISCOUNT_BANDS) if (p <= b.max) return b.band;
  return "30%+";
}
export const DISCOUNT_BAND_LIST = DISCOUNT_BANDS.map((b) => b.band);
export function discountBandMidpoint(band: string): number {
  return DISCOUNT_BANDS.find((b) => b.band === band)?.mid ?? 0;
}

// ── Building cohort features & keys ───────────────────────────────────────────

/** Rebuild cohort features from an already-generalized stored event. */
export function cohortFeaturesFromEvent(e: {
  industry: string;
  region: string;
  currency: string;
  amountBucket: string;
  discountBand: string;
}): CohortFeatures {
  return {
    industry: normalizeCategory(e.industry),
    region: normalizeCategory(e.region),
    currency: normalizeCurrency(e.currency),
    amountBucket: e.amountBucket,
    discountBand: e.discountBand,
  };
}

export function toCohortFeatures(f: DealFeatures): CohortFeatures {
  return {
    industry: normalizeCategory(f.industry),
    region: normalizeCategory(f.region),
    currency: normalizeCurrency(f.currency),
    amountBucket: amountBucket(f.amount),
    discountBand: discountBand(f.discountPct),
  };
}

// Cohort levels, most specific (0) → least specific (4 = global). Each level is
// the set of dimensions that define the cohort at that granularity.
export type CohortLevel = 0 | 1 | 2 | 3 | 4;

function dimsForLevel(c: CohortFeatures, level: CohortLevel): Record<string, string> {
  switch (level) {
    case 0: return { industry: c.industry, region: c.region, currency: c.currency, amt: c.amountBucket };
    case 1: return { industry: c.industry, region: c.region, currency: c.currency };
    case 2: return { industry: c.industry, currency: c.currency };
    case 3: return { currency: c.currency };
    case 4: return {};
  }
}

/** Canonical, order-stable cohort key for a level (excludes the discount band). */
export function cohortKey(c: CohortFeatures, level: CohortLevel): string {
  const dims = dimsForLevel(c, level);
  const entries = Object.entries(dims).sort(([a], [b]) => a.localeCompare(b));
  const body = entries.map(([k, v]) => `${k}=${v}`).join("|");
  return `L${level}:${body}`;
}

/** All cohort keys (level 0 → 4) an event contributes to, for rollup at ingest-time. */
export function ancestorCohortKeys(c: CohortFeatures): { level: CohortLevel; key: string }[] {
  return ([0, 1, 2, 3, 4] as CohortLevel[]).map((level) => ({ level, key: cohortKey(c, level) }));
}

/** A win-rate stat is stored per (cohort key, discount band). */
export function statKey(cohortKeyStr: string, band: string): string {
  return `${cohortKeyStr}#${band}`;
}
