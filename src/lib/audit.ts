import prisma from "@/lib/db";

/**
 * Log an audit event. Call from API routes after mutations.
 * Non-blocking — fires and forgets so it doesn't slow down the response.
 */
export function logAudit(params: {
  userId: string;
  entity: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
}) {
  // Fire-and-forget so audit logging never blocks the response
  prisma.auditLog
    .create({
      data: {
        userId: params.userId,
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        before: (params.before as never) ?? undefined,
        after: (params.after as never) ?? undefined,
        ip: params.ip ?? null,
      },
    })
    .catch((err) => {
      console.error("Audit log failed:", err);
    });
}
