// ─────────────────────────────────────────────────────────────────────────────
// Decision Advisor — privacy core.
//
// The advisor is a CROSS-TENANT learning engine: it learns from every company's
// outcomes and serves benchmarks back to each tenant. That deliberately crosses
// the isolation boundary the rest of the app enforces (see src/lib/db.ts), so
// privacy is not a feature here — it IS the algorithm. Nothing identifying ever
// leaves a tenant; only aggregate statistics that survive ALL of the guards
// below are ever published or served.
//
// Guarantees enforced here:
//   1. Tenant identity is one-way hashed (HMAC) before it touches the event log.
//   2. k-anonymity: a cohort stat is published only if backed by ≥ K distinct
//      tenants AND ≥ N records.
//   3. Dominance: suppressed if any single tenant contributes too large a share
//      (otherwise a rival's data is just mirrored back).
//   4. Contribution capping: each tenant's weight per cohort is clipped, which
//      both keeps "whale" tenants from skewing medians AND bounds the
//      sensitivity for differential-privacy noise.
//   5. Differential privacy: calibrated Laplace noise on published counts.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";

// ── Tunable parameters (single source of truth; logged with each published stat)
export const PRIVACY = {
  /** Distinct companies required before a cohort statistic may be published. */
  K_TENANTS_MIN: 5,
  /** Outcome records required before a cohort statistic may be published. */
  N_RECORDS_MIN: 30,
  /** Suppress a cohort if one tenant contributes more than this share of it. */
  DOMINANCE_MAX: 0.4,
  /** Max records counted per tenant per cohort (clip → DP sensitivity bound). */
  PER_TENANT_CAP: 25,
  /** Differential-privacy budget per published count, per recompute. */
  DP_EPSILON: 1.0,
  /** Half-life (days) for exponential time-decay of an event's weight. */
  DECAY_HALFLIFE_DAYS: 365,
  /** Beta-prior strength used when shrinking a thin cohort toward its parent. */
  PRIOR_STRENGTH: 10,
} as const;

// ── Tenant pseudonymisation ──────────────────────────────────────────────────
// HMAC-SHA256 over the companyId with a server-only salt. One-way: the event log
// stores only this hash, so a leak of the advisor tables cannot be mapped back to
// a company. The salt MUST be stable (rotating it orphans historical events) and
// secret — without it the hash would be a trivially reversible hash of a cuid.
function advisorSalt(): string {
  return process.env.ADVISOR_SALT || process.env.JWT_SECRET || "dev-only-advisor-salt";
}

export function tenantHash(companyId: string): string {
  return crypto.createHmac("sha256", advisorSalt()).update(companyId).digest("hex");
}

// ── Differential privacy ──────────────────────────────────────────────────────
// Laplace mechanism. Sensitivity is bounded by PER_TENANT_CAP (one tenant can
// change any cohort count by at most that much, because we clip their weight),
// so scale = sensitivity / epsilon.
export function laplaceNoise(epsilon: number = PRIVACY.DP_EPSILON): number {
  const scale = PRIVACY.PER_TENANT_CAP / Math.max(epsilon, 1e-6);
  // Inverse-CDF sampling of Laplace(0, scale) from a uniform on (-0.5, 0.5).
  const u = Math.random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

/** Add DP noise to a non-negative count and round to a sane non-negative integer. */
export function noisyCount(trueCount: number, epsilon: number = PRIVACY.DP_EPSILON): number {
  return Math.max(0, Math.round(trueCount + laplaceNoise(epsilon)));
}

// ── Publish gate ──────────────────────────────────────────────────────────────
export interface CohortReleaseInput {
  /** Total records in the cohort (after per-tenant capping). */
  n: number;
  /** Distinct contributing tenants. */
  tenantCount: number;
  /** Largest single tenant's record count in this cohort (after capping). */
  topTenantRecords: number;
}

/** True only when a cohort statistic is safe to publish/serve. Fail closed. */
export function passesReleaseGate({ n, tenantCount, topTenantRecords }: CohortReleaseInput): boolean {
  if (n < PRIVACY.N_RECORDS_MIN) return false;
  if (tenantCount < PRIVACY.K_TENANTS_MIN) return false;
  if (n > 0 && topTenantRecords / n > PRIVACY.DOMINANCE_MAX) return false;
  return true;
}

/** Exponential time-decay weight for an event of a given age. */
export function decayWeight(ageDays: number): number {
  if (ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / PRIVACY.DECAY_HALFLIFE_DAYS);
}
