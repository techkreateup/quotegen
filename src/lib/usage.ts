import { prismaUnscoped } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

/**
 * Fire-and-forget usage analytics event. companyId/userId default to the
 * current tenant context when available.
 */
export function track(
  event: string,
  metadata?: Record<string, unknown>,
  ids?: { companyId?: string | null; userId?: string | null }
) {
  const ctx = getTenantContext();
  prismaUnscoped.usageEvent
    .create({
      data: {
        event,
        metadata: (metadata as never) ?? undefined,
        companyId: ids?.companyId !== undefined ? ids.companyId : ctx?.companyId ?? null,
        userId: ids?.userId !== undefined ? ids.userId : ctx?.userId ?? null,
      },
    })
    .catch((err) => console.error("Usage tracking failed:", err));
}
