import { prismaUnscoped } from "@/lib/db";
import { hasCompanyFeature } from "@/lib/feature-gate";

export interface SeatCheck {
  allowed: boolean;
  limit: number | null; // null = unlimited
  used: number;
}

/**
 * Checks whether a company can add another seat (login user).
 * `company.maxUsers === null` means unlimited. Counts only active users so a
 * deactivated account frees up a seat.
 */
export async function checkSeatLimit(companyId: string): Promise<SeatCheck> {
  const company = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: { maxUsers: true },
  });
  const limit = company?.maxUsers ?? null;

  const used = await prismaUnscoped.user.count({
    where: { companyId, isActive: true },
  });

  return { allowed: limit === null || used < limit, limit, used };
}

/** Convenience wrapper around the per-company feature flag system. */
export function checkFeatureAccess(companyId: string, feature: string): Promise<boolean> {
  return hasCompanyFeature(companyId, feature);
}
