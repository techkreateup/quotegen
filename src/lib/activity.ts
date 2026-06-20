import prisma from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export function logActivity(params: {
  entityType: string;
  entityId: string;
  action: string;
  description?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}) {
  const companyId = getTenantContext()?.companyId;
  if (!companyId) return; // entity activity is always company-scoped
  prisma.entityActivity.create({
    data: {
      companyId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      description: params.description || "",
      metadata: (params.metadata as never) ?? undefined,
      userId: params.userId || null,
    },
  }).catch(err => console.error("Activity log failed:", err));
}
