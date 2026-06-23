// ─────────────────────────────────────────────────────────────────────────────
// Decision Advisor — aggregation job (learning plane).
//
// Runs as a trusted background job (cron), OUTSIDE any tenant context, using
// prismaUnscoped. It is a FULL RECOMPUTE of the published cohort cube from the
// event log. Full recompute (vs. incremental) is the safest choice for beta:
//   • A tenant opting out or being erased (DPDP) simply stops appearing in the
//     next run — no stale aggregate can linger.
//   • Privacy gates are re-evaluated from scratch every run.
// (When event volume outgrows this, swap the inner accumulation for mergeable
//  t-digest / HLL sketches with a watermark — the published shape stays identical.)
//
// For every event we roll it up into ALL of its ancestor cohorts (level 0→4), so
// serving-time backoff is a pure lookup. Before publishing a (cohort, band) row
// we enforce: per-tenant capping → k-anonymity + dominance gate → DP noise.
// ─────────────────────────────────────────────────────────────────────────────

import { prismaUnscoped } from "@/lib/db";
import {
  CohortLevel,
  ancestorCohortKeys,
  cohortFeaturesFromEvent,
  statKey,
} from "./cohort";
import { PRIVACY, noisyCount, passesReleaseGate } from "./privacy";

const KIND = "quote_outcome";

interface CellAcc {
  level: CohortLevel;
  cohortKey: string;
  band: string;
  /** raw wins/trials per tenant hash (capped at publish time). */
  perTenant: Map<string, { wins: number; trials: number }>;
}

export interface AggregateResult {
  events: number;
  cells: number;
  published: number;
  suppressed: number;
}

/** Recompute and republish the entire quote-outcome cohort cube. */
export async function aggregateQuoteOutcomes(): Promise<AggregateResult> {
  const events = await prismaUnscoped.advisorEvent.findMany({
    where: { kind: KIND },
    select: {
      tenantHash: true,
      industry: true,
      region: true,
      currency: true,
      amountBucket: true,
      discountBand: true,
      won: true,
    },
  });

  // Build the cube: statKey → accumulator across its ancestor cohorts.
  const cube = new Map<string, CellAcc>();
  for (const e of events) {
    const features = cohortFeaturesFromEvent(e);
    for (const { level, key } of ancestorCohortKeys(features)) {
      const sk = statKey(key, features.discountBand);
      let cell = cube.get(sk);
      if (!cell) {
        cell = { level, cohortKey: key, band: features.discountBand, perTenant: new Map() };
        cube.set(sk, cell);
      }
      const t = cell.perTenant.get(e.tenantHash) ?? { wins: 0, trials: 0 };
      t.trials += 1;
      if (e.won) t.wins += 1;
      cell.perTenant.set(e.tenantHash, t);
    }
  }

  // Evaluate each cell: per-tenant cap → gate → DP noise.
  const toPublish: {
    kind: string;
    cohortKey: string;
    cohortLevel: number;
    discountBand: string;
    wins: number;
    trials: number;
    tenantCount: number;
    epsilon: number;
  }[] = [];
  let suppressed = 0;

  for (const cell of cube.values()) {
    let wins = 0;
    let trials = 0;
    let topTenantRecords = 0;
    for (const t of cell.perTenant.values()) {
      // Clip each tenant's influence; keep wins ≤ capped trials.
      const cTrials = Math.min(t.trials, PRIVACY.PER_TENANT_CAP);
      const cWins = t.trials > 0 ? Math.round(t.wins * (cTrials / t.trials)) : 0;
      wins += Math.min(cWins, cTrials);
      trials += cTrials;
      topTenantRecords = Math.max(topTenantRecords, cTrials);
    }
    const tenantCount = cell.perTenant.size;

    if (!passesReleaseGate({ n: trials, tenantCount, topTenantRecords })) {
      suppressed++;
      continue;
    }

    // Differential-privacy noise on the published counts; keep wins ≤ trials.
    const noisyTrials = Math.max(1, noisyCount(trials));
    const noisyWins = Math.min(noisyTrials, noisyCount(wins));
    toPublish.push({
      kind: KIND,
      cohortKey: cell.cohortKey,
      cohortLevel: cell.level,
      discountBand: cell.band,
      wins: noisyWins,
      trials: noisyTrials,
      tenantCount,
      epsilon: PRIVACY.DP_EPSILON,
    });
  }

  // Atomic republish: drop the old cube, write the new one.
  await prismaUnscoped.$transaction([
    prismaUnscoped.advisorCohortStat.deleteMany({ where: { kind: KIND } }),
    ...(toPublish.length
      ? [prismaUnscoped.advisorCohortStat.createMany({ data: toPublish })]
      : []),
  ]);

  return {
    events: events.length,
    cells: cube.size,
    published: toPublish.length,
    suppressed,
  };
}
