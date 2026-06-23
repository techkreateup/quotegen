// ─────────────────────────────────────────────────────────────────────────────
// Decision Advisor — cohort backoff resolver (serving side).
//
// Published stats already passed the privacy release gate at aggregation time,
// so a row's mere existence means it is safe to serve. Backoff therefore just
// finds the MOST SPECIFIC level (0 = exact peer group) that has a published row
// for the requested discount band, then borrows the next level up as the shrink
// prior. If even the global level is absent (true cold start), the caller gets
// null and shows a "still learning" state — the advisor never blocks the page.
// ─────────────────────────────────────────────────────────────────────────────

import { CohortFeatures, CohortLevel, cohortKey, statKey } from "./cohort";
import { betaMean, jeffreysPosterior } from "./estimators";

/** Published win-rate counts for one (cohort, band). */
export interface StatRow {
  wins: number;
  trials: number;
  tenantCount: number;
}

/** Looks up a published row by its stat key, or null if not published. */
export type StatLookup = (key: string) => StatRow | null;

export interface ResolvedCohort {
  level: CohortLevel;
  row: StatRow;
  /** Win-rate of the next level up, for shrinkage. Falls back to 0.5. */
  parentMean: number;
}

/**
 * Resolve the most specific published cohort for a (features, band).
 * Returns null when nothing is published at any level for this band.
 */
export function resolveCohort(
  features: CohortFeatures,
  band: string,
  lookup: StatLookup
): ResolvedCohort | null {
  for (const level of [0, 1, 2, 3, 4] as CohortLevel[]) {
    const row = lookup(statKey(cohortKey(features, level), band));
    if (!row) continue;

    // Parent mean = first published level strictly broader than this one.
    let parentMean = 0.5;
    for (const up of ([level + 1, level + 2, level + 3, level + 4] as number[])) {
      if (up > 4) break;
      const parent = lookup(statKey(cohortKey(features, up as CohortLevel), band));
      if (parent) {
        parentMean = betaMean(jeffreysPosterior(parent.wins, parent.trials));
        break;
      }
    }
    return { level, row, parentMean };
  }
  return null;
}

/** Human label for a resolved cohort level, used in the evidence string. */
export function levelLabel(level: CohortLevel): string {
  switch (level) {
    case 0: return "your exact peer group";
    case 1: return "your industry & region";
    case 2: return "your industry";
    case 3: return "all businesses in this currency";
    case 4: return "all businesses";
  }
}
