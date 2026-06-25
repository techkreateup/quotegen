import { prismaUnscoped } from "@/lib/db";
import { PLANS, PLAN_DEFS, FEATURE_KEYS, type Plan, type PlanDef } from "@/lib/features";

// Super-admin-editable plan catalogue, backed by the PlanDefinition table.
// Rows override the static defaults in features.ts; missing plans fall back to
// the defaults. Cached briefly so signup / landing / sidebar reads are cheap.

let cache: { defs: PlanDef[]; at: number } | null = null;
const TTL = 30_000;

export function invalidatePlanCache() {
  cache = null;
}

/** Full ordered list of plan definitions (DB overrides merged onto defaults). */
export async function getPlanDefinitions(): Promise<PlanDef[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.defs;

  let rows: Array<{ name: string; description: string; features: unknown; maxUsers: number | null; comingSoon: boolean; price: string; priceInPaise: number; yearlyPriceInPaise: number | null; billingPeriod: string; trialDurationDays: number; sortOrder: number }> = [];
  try {
    rows = await prismaUnscoped.planDefinition.findMany();
  } catch {
    // Table may not exist yet (pre-migration) — fall back to static defaults.
    rows = [];
  }
  const byName = new Map(rows.map((r) => [r.name, r]));

  const defs: PlanDef[] = PLANS.map((name) => {
    const fallback = PLAN_DEFS[name];
    const row = byName.get(name);
    if (!row) return fallback;
    const features = Array.isArray(row.features)
      ? (row.features as string[]).filter((f) => FEATURE_KEYS.includes(f))
      : fallback.features;
    return {
      name: name as Plan,
      description: row.description || fallback.description,
      features,
      maxUsers: row.maxUsers,
      comingSoon: row.comingSoon,
      price: row.price || fallback.price,
      priceInPaise: row.priceInPaise ?? fallback.priceInPaise,
      yearlyPriceInPaise: row.yearlyPriceInPaise ?? null,
      billingPeriod: row.billingPeriod || fallback.billingPeriod,
      trialDurationDays: row.trialDurationDays ?? fallback.trialDurationDays,
    };
  });

  cache = { defs, at: Date.now() };
  return defs;
}

export async function getPlanDef(name: Plan): Promise<PlanDef | undefined> {
  return (await getPlanDefinitions()).find((p) => p.name === name);
}

/** Admin-configured free-access window in days (from the Free plan). Defaults to 90. */
export async function getFreeTrialDurationDays(): Promise<number> {
  const free = await getPlanDef("Free");
  return free?.trialDurationDays ?? 90;
}

/**
 * Feature keys that are "premium" (gem marker) = anything NOT in the entry paid
 * tier (Starter). Editing Starter's feature list in the admin reshapes the gems
 * everywhere. Falls back to "not in Free's permanent core" if Starter is absent.
 */
export async function getPremiumFeatureKeys(): Promise<string[]> {
  const defs = await getPlanDefinitions();
  const entry = defs.find((p) => p.name === "Starter") ?? defs.find((p) => p.name === "Free");
  const included = new Set(entry?.features ?? []);
  return FEATURE_KEYS.filter((k) => !included.has(k));
}
