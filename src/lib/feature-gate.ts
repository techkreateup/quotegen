import { prismaUnscoped } from "@/lib/db";
import { hasFeature, resolveFeatures, MODULE_TO_FEATURE, type FeatureMap } from "@/lib/features";

// In-memory cache of a company's feature override map, mirroring the
// company-active cache in with-api.ts (fine for a single instance; move to Redis
// when scaling horizontally).
const cache = new Map<string, { overrides: FeatureMap; at: number }>();
const TTL = 60_000;

async function getOverrides(companyId: string): Promise<FeatureMap> {
  const hit = cache.get(companyId);
  if (hit && Date.now() - hit.at < TTL) return hit.overrides;
  const company = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: { featureOverrides: true },
  });
  const overrides = (company?.featureOverrides as FeatureMap) ?? {};
  cache.set(companyId, { overrides, at: Date.now() });
  return overrides;
}

/** Call when a company's features change so enforcement applies immediately. */
export function invalidateFeatureCache(companyId: string) {
  cache.delete(companyId);
}

/** Is a single feature enabled for the company? */
export async function hasCompanyFeature(companyId: string, featureKey: string): Promise<boolean> {
  return hasFeature(await getOverrides(companyId), featureKey);
}

/** Is the tenant module behind a feature flag, and if so is it enabled? */
export async function isModuleEnabled(companyId: string, module: string): Promise<boolean> {
  const featureKey = MODULE_TO_FEATURE[module];
  if (!featureKey) return true; // module not feature-gated
  return hasFeature(await getOverrides(companyId), featureKey);
}

/** Full resolved feature map for the company (for the tenant UI to hide nav). */
export async function getCompanyFeatures(companyId: string): Promise<FeatureMap> {
  return resolveFeatures(await getOverrides(companyId));
}
